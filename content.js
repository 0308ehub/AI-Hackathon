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
            
            if (result.hasIssues && this.settings.highlightIssues) {
                this.highlightIssue(item.element, item.statement, result);
            }
            
        } catch (error) {
            console.error('Fact-checking error:', error);
        }
    }

    highlightIssue(element, statement, result) {
        if (!this.settings.highlightIssues) return;
        
        this.issuesFound++;
        this.updateStats();
        
        const text = element.textContent;
        const highlightedText = text.replace(
            statement,
            `<span class="factchecker-highlight" style="background: linear-gradient(120deg, #ff6b6b 0%, #ff8e8e 100%); padding: 2px 4px; border-radius: 3px; cursor: pointer; position: relative;">${statement}</span>`
        );
        
        element.innerHTML = highlightedText;
        
        const highlightedSpan = element.querySelector('.factchecker-highlight');
        if (highlightedSpan) {
            const tooltip = document.createElement('div');
            tooltip.style.cssText = `
                position: absolute;
                top: -40px;
                left: 0;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                max-width: 300px;
                z-index: 10000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            
            let tooltipContent = `
                <div style="font-weight: bold; margin-bottom: 4px;">⚠️ Fact Check Issue</div>
                <div style="margin-bottom: 6px;">${result.issues.join('<br>')}</div>
            `;
            
            if (this.settings.showSuggestions && result.suggestions.length > 0) {
                tooltipContent += `
                    <div style="font-weight: bold; margin-bottom: 4px;">💡 Suggestions:</div>
                    <div style="margin-bottom: 6px;">${result.suggestions.join('<br>')}</div>
                `;
            }
            
            if (result.sources && result.sources.length > 0) {
                tooltipContent += `
                    <div style="font-weight: bold; margin-bottom: 4px;">🔍 Sources:</div>
                    <div style="font-size: 11px; opacity: 0.8;">${result.sources.join(', ')}</div>
                `;
            }
            
            if (result.confidence) {
                const confidencePercent = Math.round(result.confidence * 100);
                tooltipContent += `
                    <div style="margin-top: 6px; font-size: 11px; opacity: 0.7;">
                        Confidence: ${confidencePercent}%
                    </div>
                `;
            }
            
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