// FactChecker Pro Content Script
class FactChecker {
    constructor() {
        this.isEnabled = true;
        this.settings = {
            autoCheck: true,
            highlightIssues: true,
            showSuggestions: true
        };
        this.factsChecked = 0;
        this.issuesFound = 0;
        this.checkedElements = new Set();
        this.factCheckQueue = [];
        this.isProcessing = false;
        
        // Initialize the fact checking service
        this.factCheckingService = new FactCheckingService();
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupMessageListener();
        this.observePageChanges();
        this.scanPage();
    }

    loadSettings() {
        chrome.storage.local.get([
            'isEnabled',
            'autoCheck',
            'highlightIssues',
            'showSuggestions',
            'googleFactCheckKey',
            'openaiKey',
            'enableGoogleFactCheck',
            'enableWikipedia',
            'enableOpenAI'
        ], (result) => {
            this.isEnabled = result.isEnabled !== false;
            this.settings.autoCheck = result.autoCheck !== false;
            this.settings.highlightIssues = result.highlightIssues !== false;
            this.settings.showSuggestions = result.showSuggestions !== false;
            
            // Configure fact checking service
            if (result.googleFactCheckKey) {
                this.factCheckingService.setApiKey('googleFactCheck', result.googleFactCheckKey);
            }
            if (result.openaiKey) {
                this.factCheckingService.setApiKey('openai', result.openaiKey);
            }
            
            this.factCheckingService.enableSource('googleFactCheck', result.enableGoogleFactCheck !== false);
            this.factCheckingService.enableSource('wikipedia', result.enableWikipedia !== false);
            this.factCheckingService.enableSource('openai', result.enableOpenAI === true);
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'toggleExtension':
                    this.isEnabled = request.enabled;
                    if (this.isEnabled) {
                        this.scanPage();
                    } else {
                        this.clearHighlights();
                    }
                    break;
                case 'updateSettings':
                    Object.assign(this.settings, request.settings);
                    break;
            }
        });
    }

    observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            if (!this.isEnabled || !this.settings.autoCheck) return;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        this.scanElement(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanPage() {
        if (!this.isEnabled) return;
        
        const textElements = this.findTextElements();
        textElements.forEach(element => {
            this.scanElement(element);
        });
    }

    findTextElements() {
        const selectors = [
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'article', 'section', 'div[class*="content"]',
            'span', 'li', 'blockquote'
        ];
        
        const elements = [];
        selectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            found.forEach(el => {
                if (this.isValidTextElement(el)) {
                    elements.push(el);
                }
            });
        });
        
        return elements;
    }

    isValidTextElement(element) {
        if (this.checkedElements.has(element)) return false;
        if (!element.textContent || element.textContent.trim().length < 20) return false;
        if (element.querySelector('script, style, iframe')) return false;
        
        return true;
    }

    scanElement(element) {
        if (!this.isValidTextElement(element)) return;
        
        this.checkedElements.add(element);
        const text = element.textContent.trim();
        
        const factualStatements = this.extractFactualStatements(text);
        
        factualStatements.forEach(statement => {
            this.factCheckQueue.push({
                statement: statement,
                element: element,
                originalText: text
            });
        });
        
        this.processQueue();
    }

    extractFactualStatements(text) {
        const statements = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        
        sentences.forEach(sentence => {
            const trimmed = sentence.trim();
            
            const factualPatterns = [
                /\d+%|\d+ percent|\d+ million|\d+ billion|\d+ thousand/,
                /\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/,
                /(is|are|was|were|has|have|had) (more|less|higher|lower|larger|smaller)/,
                /(always|never|every|all|none|only|exactly|precisely)/,
                /(studies show|research indicates|according to|it is known that)/,
                /(\d+ (miles|kilometers|pounds|kilograms|degrees|dollars))/,
                /([A-Z][a-z]+ (University|College|Institute|Center|Hospital))/,
                /(in \d{4}|during|since|before|after)/
            ];
            
            let isFactual = false;
            factualPatterns.forEach(pattern => {
                if (pattern.test(trimmed)) {
                    isFactual = true;
                }
            });
            
            if (isFactual) {
                statements.push(trimmed);
            }
        });
        
        return statements;
    }

    async processQueue() {
        if (this.isProcessing || this.factCheckQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.factCheckQueue.length > 0) {
            const item = this.factCheckQueue.shift();
            await this.factCheck(item);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.isProcessing = false;
    }

    async factCheck(item) {
        try {
            this.factsChecked++;
            this.updateStats();
            
            // Use the enhanced fact checking service
            const result = await this.factCheckingService.checkFact(item.statement, item.originalText);
            
            // Always highlight facts, not just issues
            this.highlightFact(item.element, item.statement, result);
            
        } catch (error) {
            console.error('Fact-checking error:', error);
        }
    }

    highlightFact(element, statement, result) {
        if (!this.settings.highlightIssues) return;
        
        if (result.hasIssues) {
            this.issuesFound++;
        }
        this.updateStats();
        
        const text = element.textContent;
        
        // Determine the fact status and CSS class
        const factStatus = this.getFactStatus(result);
        const cssClass = `factchecker-highlight ${factStatus.class}`;
        
        const highlightedText = text.replace(
            statement,
            `<span class="${cssClass}" style="position: relative;">${statement}</span>`
        );
        
        element.innerHTML = highlightedText;
        
        const highlightedSpan = element.querySelector('.factchecker-highlight');
        if (highlightedSpan) {
            const tooltip = document.createElement('div');
            tooltip.className = 'factchecker-tooltip';
            
            const tooltipContent = this.createTooltipContent(statement, result, factStatus);
            tooltip.innerHTML = tooltipContent;
            
            highlightedSpan.appendChild(tooltip);
            
            highlightedSpan.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
            });
            
            highlightedSpan.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
        }
    }

    getFactStatus(result) {
        const confidence = result.confidence || 0.3;
        
        if (result.hasIssues) {
            if (confidence > 0.7) {
                return { class: 'false', label: 'Inaccurate', color: '#dc3545' };
            } else {
                return { class: 'mixed', label: 'Mixed/Unclear', color: '#ffc107' };
            }
        } else {
            if (confidence > 0.7) {
                return { class: 'true', label: 'Accurate', color: '#28a745' };
            } else if (confidence > 0.4) {
                return { class: 'mixed', label: 'Likely Accurate', color: '#ffc107' };
            } else {
                return { class: 'unverified', label: 'Unverified', color: '#6c757d' };
            }
        }
    }

    createTooltipContent(statement, result, factStatus) {
        const confidencePercent = Math.round((result.confidence || 0.3) * 100);
        const accuracyClass = this.getAccuracyClass(result.confidence);
        
        let content = `
            <div class="accuracy-score ${accuracyClass}">
                <span>🎯</span>
                <span>${factStatus.label}</span>
                <span>(${confidencePercent}% confidence)</span>
            </div>
        `;
        
        if (result.issues && result.issues.length > 0) {
            content += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #ff6b6b;">⚠️ Issues Found:</div>
                    <div style="font-size: 12px; line-height: 1.4;">${result.issues.join('<br>')}</div>
                </div>
            `;
        }
        
        if (this.settings.showSuggestions && result.suggestions && result.suggestions.length > 0) {
            content += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #17a2b8;">💡 Suggestions:</div>
                    <div style="font-size: 12px; line-height: 1.4;">${result.suggestions.join('<br>')}</div>
                </div>
            `;
        }
        
        if (result.sources && result.sources.length > 0) {
            content += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: bold; margin-bottom: 4px; color: #6f42c1;">🔍 Sources:</div>
                    <div style="font-size: 11px;">
                        ${result.sources.map(source => `<span class="source-badge">${source}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (result.explanation) {
            content += `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #555; font-size: 12px; opacity: 0.8;">
                    ${result.explanation}
                </div>
            `;
        }
        
        return content;
    }

    getAccuracyClass(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.6) return 'medium';
        if (confidence >= 0.4) return 'low';
        return 'unverified';
    }

    clearHighlights() {
        const highlights = document.querySelectorAll('.factchecker-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    }

    updateStats() {
        chrome.storage.local.set({
            factsChecked: this.factsChecked,
            issuesFound: this.issuesFound
        });
        
        chrome.runtime.sendMessage({
            action: 'updateStats'
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new FactChecker();
    });
} else {
    new FactChecker();
} 