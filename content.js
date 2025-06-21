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
        this.checkedElements = new WeakSet(); // Use WeakSet for better memory management
        this.processedStatements = new Set(); // Track processed statements
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
            'googleNaturalLanguageKey',
            'enableGoogleFactCheck',
            'enableWikipedia',
            'enableOpenAI',
            'enableGoogleNaturalLanguage'
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
            if (result.googleNaturalLanguageKey) {
                this.factCheckingService.setApiKey('googleNaturalLanguage', result.googleNaturalLanguageKey);
            }
            
            this.factCheckingService.enableSource('googleFactCheck', result.enableGoogleFactCheck !== false);
            this.factCheckingService.enableSource('wikipedia', result.enableWikipedia !== false);
            this.factCheckingService.enableSource('openai', result.enableOpenAI === true);
            this.factCheckingService.enableSource('googleNaturalLanguage', result.enableGoogleNaturalLanguage !== false);
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
                        // Only scan new elements that haven't been processed
                        if (!this.checkedElements.has(node)) {
                            this.scanElement(node);
                        }
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
            if (!this.checkedElements.has(element)) {
                this.scanElement(element);
            }
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
                // CRITICAL: Skip any element that contains our own content
                if (el.querySelector('.factchecker-tooltip') || 
                    el.querySelector('.factchecker-highlight') ||
                    el.classList.contains('factchecker-tooltip') ||
                    el.classList.contains('factchecker-highlight') ||
                    el.closest('.factchecker-tooltip') ||
                    el.closest('.factchecker-highlight')) {
                    return;
                }
                
                if (this.isValidTextElement(el)) {
                    elements.push(el);
                }
            });
        });
        
        return elements;
    }

    isValidTextElement(element) {
        // Skip if already checked
        if (this.checkedElements.has(element)) return false;

        // Prevent re-scanning elements that are already highlighted
        if (element.closest('.factchecker-highlight')) {
            return false;
        }

        // Skip if doesn't contain meaningful text
        if (!element.textContent || element.textContent.trim().length < 20) return false;
        
        // Skip if contains scripts, styles, or iframes
        if (element.querySelector('script, style, iframe')) return false;
        
        // Skip if already contains fact-checker highlights
        if (element.querySelector('.factchecker-highlight')) return false;
        
        // Skip if element is inside a fact-checker highlight
        if (element.closest('.factchecker-highlight')) return false;
        
        // Skip if element is inside a fact-checker tooltip
        if (element.closest('.factchecker-tooltip')) return false;
        
        // Skip if element is our own tooltip
        if (element.classList.contains('factchecker-tooltip')) return false;
        
        return true;
    }

    scanElement(element) {
        if (!this.isValidTextElement(element)) return;
        
        // CRITICAL: Skip if element contains our own generated content
        if (element.textContent.includes('factchecker-highlight') || 
            element.textContent.includes('factchecker-tooltip') ||
            element.innerHTML.includes('factchecker-highlight') || 
            element.innerHTML.includes('factchecker-tooltip')) {
            return;
        }
        
        // Mark element as checked
        this.checkedElements.add(element);
        
        const text = element.textContent.trim();
        
        const factualStatements = this.extractFactualStatements(text);
        
        // Limit to first 5 statements per element for performance
        const limitedStatements = factualStatements.slice(0, 5);
        
        limitedStatements.forEach(statement => {
            // Create a unique key for this statement
            const statementKey = this.generateStatementKey(statement, element);
            
            // Skip if already processed
            if (this.processedStatements.has(statementKey)) return;
            
            // Limit total facts processed per page to 20 for performance
            if (this.processedStatements.size >= 20) return;
            
            this.processedStatements.add(statementKey);
            
            this.factCheckQueue.push({
                statement: statement,
                element: element,
                originalText: text,
                statementKey: statementKey
            });
        });
        
        this.processQueue();
    }

    generateStatementKey(statement, element) {
        // Create a unique key based on statement content and element position
        const elementPath = this.getElementPath(element);
        return `${statement.toLowerCase().trim()}_${elementPath}`;
    }

    getElementPath(element) {
        // Create a simple path to identify the element
        const path = [];
        let current = element;
        
        while (current && current !== document.body) {
            const tag = current.tagName.toLowerCase();
            const index = Array.from(current.parentNode.children).indexOf(current);
            path.unshift(`${tag}:${index}`);
            current = current.parentNode;
        }
        
        return path.join('>');
    }

    extractFactualStatements(text) {
        const statements = [];
        
        // Split text into sentences more intelligently
        // First, temporarily replace decimal numbers to protect them
        let protectedText = text.replace(/(\d+)\.(\d+)/g, '$1_DECIMAL_$2');
        
        // Split on sentence endings (period, exclamation, question mark followed by space and capital letter)
        const sentences = protectedText.split(/[.!?]\s+(?=[A-Z])/).filter(s => s.trim().length > 10);
        
        sentences.forEach(sentence => {
            // Restore decimal numbers
            const restoredSentence = sentence.replace(/(\d+)_DECIMAL_(\d+)/g, '$1.$2');
            const trimmed = restoredSentence.trim();
            
            const factualPatterns = [
                /\d+%|\d+ percent|\d+ million|\d+ billion|\d+ thousand/,
                /\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/,
                /(is|are|was|were|has|have|had) (more|less|higher|lower|larger|smaller)/,
                /(always|never|every|all|none|only|exactly|precisely)/,
                /(studies show|research indicates|according to|it is known that)/,
                /(\d+ (miles|kilometers|pounds|kilograms|degrees|dollars))/,
                /([A-Z][a-z]+ (University|College|Institute|Center|Hospital))/,
                /(in \d{4}|during|since|before|after)/,
                // Add pattern for decimal numbers
                /\d+\.\d+/
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
        
        // Process multiple items concurrently for speed
        const batchSize = 3; // Process 3 facts at once
        const batch = this.factCheckQueue.splice(0, batchSize);
        
        // Process batch concurrently
        await Promise.allSettled(
            batch.map(item => this.factCheck(item))
        );
        
        // Short delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
        
        this.isProcessing = false;
        
        // Continue processing if there are more items
        if (this.factCheckQueue.length > 0) {
            setTimeout(() => this.processQueue(), 100);
        }
    }

    async factCheck(item) {
        try {
            this.factsChecked++;
            this.updateStats();
            
            // Use the enhanced fact checking service with faster processing
            const result = await this.factCheckingService.checkFact(item.statement, item.originalText);
            
            // Always highlight facts, not just issues
            this.highlightFact(item.element, item.statement, result);
            
        } catch (error) {
            console.error('Fact-checking error:', error);
            // Continue processing even if one fact fails
        }
    }

    highlightFact(element, statement, result) {
        if (!this.settings.highlightIssues) return;
        
        if (result.hasIssues) {
            this.issuesFound++;
        }
        this.updateStats();
        
        // Check if element still exists and has not been highlighted with the same statement
        if (!element.isConnected || element.querySelector(`.factchecker-highlight[data-statement="${CSS.escape(statement)}"]`)) {
            return;
        }
        
        const factStatus = this.getFactStatus(result);
        const cssClass = `factchecker-highlight ${factStatus.class}`;
        
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while((node = walker.nextNode())) {
            if (node.nodeValue.includes(statement) && !node.parentElement.closest('.factchecker-highlight')) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(node => {
            const index = node.nodeValue.indexOf(statement);
            if (index !== -1) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + statement.length);
                
                const highlightedSpan = document.createElement('span');
                highlightedSpan.className = cssClass;
                highlightedSpan.dataset.factChecked = 'true';
                highlightedSpan.dataset.statement = statement;
                
                try {
                    range.surroundContents(highlightedSpan);
                    this.attachTooltip(highlightedSpan, statement, result, factStatus);
                } catch(e) {
                    console.error("Failed to highlight text:", e);
                }
            }
        });
    }

    attachTooltip(highlightedSpan, statement, result, factStatus) {
        // Create unique tooltip ID for this highlight
        const tooltipId = 'factchecker-tooltip-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const tooltip = document.createElement('div');
        tooltip.className = 'factchecker-tooltip';
        tooltip.id = tooltipId;
        
        const tooltipContent = this.createTooltipContent(statement, result, factStatus);
        tooltip.innerHTML = tooltipContent;
        
        // Append tooltip to body for better stacking context
        document.body.appendChild(tooltip);
        
        // Store tooltip reference on the highlighted span
        highlightedSpan.dataset.tooltipId = tooltipId;
        
        highlightedSpan.addEventListener('mouseenter', (event) => {
            // Hide any other visible tooltips first
            const visibleTooltips = document.querySelectorAll('.factchecker-tooltip[style*="display: block"]');
            visibleTooltips.forEach(t => {
                if (t.id !== tooltipId) {
                    t.style.opacity = '0';
                    setTimeout(() => {
                        t.style.display = 'none';
                    }, 300);
                }
            });
            
            // First make tooltip visible to get its dimensions
            tooltip.style.display = 'block';
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
            
            // Calculate position relative to viewport
            const rect = highlightedSpan.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            // Center the tooltip horizontally on the highlighted text
            let left = rect.left + (rect.width / 2);
            
            // Ensure tooltip doesn't go off-screen horizontally
            const minLeft = tooltipRect.width / 2 + 10;
            const maxLeft = window.innerWidth - tooltipRect.width / 2 - 10;
            
            if (left < minLeft) {
                left = minLeft;
            } else if (left > maxLeft) {
                left = maxLeft;
            }
            
            // Check if there's enough space above vs below
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            const tooltipHeight = tooltipRect.height;
            const arrowHeight = 6; // Height of the arrow
            const spacing = 10; // Space between tooltip and text
            
            let top;
            if (spaceAbove >= tooltipHeight + arrowHeight + spacing) {
                // Show above the text
                top = rect.top - tooltipHeight - arrowHeight - spacing;
                tooltip.classList.remove('tooltip-below');
            } else if (spaceBelow >= tooltipHeight + arrowHeight + spacing) {
                // Show below the text
                top = rect.bottom + arrowHeight + spacing;
                tooltip.classList.add('tooltip-below');
            } else {
                // Not enough space above or below, show in the middle
                top = Math.max(10, (window.innerHeight - tooltipHeight) / 2);
                tooltip.classList.remove('tooltip-below');
            }
            
            // Apply positioning
            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';
            tooltip.style.transform = 'translateX(-50%)';
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
            
            // Clear any existing hide timeout
            if (tooltip.hideTimeout) {
                clearTimeout(tooltip.hideTimeout);
                tooltip.hideTimeout = null;
            }
        });
        
        highlightedSpan.addEventListener('mouseleave', () => {
            // Set a longer delay before hiding (2 seconds)
            tooltip.hideTimeout = setTimeout(() => {
                tooltip.style.opacity = '0';
                // Hide tooltip after fade out but keep it in DOM
                setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 300);
            }, 2000); // 2 second delay
        });
        
        // Add hover behavior to the tooltip itself
        tooltip.addEventListener('mouseenter', () => {
            // Clear hide timeout when hovering over tooltip
            if (tooltip.hideTimeout) {
                clearTimeout(tooltip.hideTimeout);
                tooltip.hideTimeout = null;
            }
        });
        
        tooltip.addEventListener('mouseleave', () => {
            // Hide tooltip when leaving the tooltip area
            tooltip.style.opacity = '0';
            setTimeout(() => {
                tooltip.style.display = 'none';
            }, 300);
        });
    }

    getFactStatus(result) {
        const confidence = result.confidence || 0.3;
        
        // Check for obvious inaccuracies first
        if (result.hasIssues && result.issues.length > 0) {
            const hasObviousInaccuracies = result.issues.some(issue => 
                issue.includes('obvious inaccuracies') || 
                issue.includes('clearly false') ||
                issue.includes('universal claims')
            );
            
            if (hasObviousInaccuracies) {
                return { class: 'false', label: 'Inaccurate', color: '#dc3545' };
            }
        }
        
        // Use the improved logic from the fact-checking service
        if (confidence >= 0.7) {
            if (result.hasIssues && result.issues.length > 0) {
                return { class: 'mixed', label: 'Mixed/Unclear', color: '#ffc107' };
            } else {
                return { class: 'true', label: 'Accurate', color: '#28a745' };
            }
        } else if (confidence >= 0.4) {
            return { class: 'mixed', label: 'Likely Accurate', color: '#ffc107' };
        } else {
            return { class: 'unverified', label: 'Unverified', color: '#6c757d' };
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
                    <div style="font-weight: bold; margin-bottom: 4px; color: #6f42c1;">🔍 Sources (click to verify):</div>
                    <div style="font-size: 11px;">
                        ${result.sources.map(source => {
                            const sourceUrl = result.urls ? result.urls.find(u => u.source === source) : null;
                            if (sourceUrl) {
                                return `<a href="${sourceUrl.url}" target="_blank" class="source-link">${source}</a>`;
                            } else {
                                return `<span class="source-badge">${source}</span>`;
                            }
                        }).join('')}
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
            if (parent) {
                parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                parent.normalize();
            }
        });
        
        // Clear tracking sets
        this.checkedElements = new WeakSet();
        this.processedStatements = new Set();
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