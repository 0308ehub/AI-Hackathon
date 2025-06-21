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
        this.setupPageVisibilityListener();
        this.observePageChanges();
        
        // Only scan if enabled
        if (this.isEnabled) {
            this.scanPage();
        }
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
            'enableGoogleNaturalLanguage',
            'enableGoogleSearch'
        ], (result) => {
            const wasEnabled = this.isEnabled;
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
            this.factCheckingService.enableSource('googleSearch', result.enableGoogleSearch !== false);
            
            // Debug: Log enabled sources
            console.log('🔧 FactChecker enabled sources:', {
                wikipedia: result.enableWikipedia !== false,
                worldBank: true, // Always enabled
                googleSearch: result.enableGoogleSearch !== false,
                googleFactCheck: result.enableGoogleFactCheck !== false,
                openai: result.enableOpenAI === true,
                googleNaturalLanguage: result.enableGoogleNaturalLanguage !== false
            });
            
            // Handle state changes
            if (wasEnabled && !this.isEnabled) {
                // Extension was disabled - clear highlights
                this.clearHighlights();
            } else if (!wasEnabled && this.isEnabled) {
                // Extension was enabled - scan the page
                this.scanPage();
            }
        });
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            switch (request.action) {
                case 'toggleExtension':
                    const wasEnabled = this.isEnabled;
                    this.isEnabled = request.enabled;
                    
                    if (this.isEnabled && !wasEnabled) {
                        // Extension was enabled - scan the page
                        this.scanPage();
                    } else if (!this.isEnabled && wasEnabled) {
                        // Extension was disabled - clear highlights
                        this.clearHighlights();
                    }
                    break;
                case 'updateSettings':
                    Object.assign(this.settings, request.settings);
                    break;
            }
        });
    }

    setupPageVisibilityListener() {
        // Listen for page visibility changes (page reload, navigation)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Page became visible (reloaded or navigated back)
                if (!this.isEnabled) {
                    // If disabled, ensure no highlights exist
                    this.clearHighlights();
                }
            }
        });
        
        // Listen for page unload to clean up
        window.addEventListener('beforeunload', () => {
            if (!this.isEnabled) {
                // Clear highlights before page unload if disabled
                this.clearHighlights();
            }
        });
        
        // Listen for navigation events (for single-page applications)
        let currentUrl = window.location.href;
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                if (!this.isEnabled) {
                    // URL changed and extension is disabled - clear highlights
                    setTimeout(() => this.clearHighlights(), 100);
                }
            }
        };
        
        // Check for URL changes periodically
        setInterval(checkUrlChange, 1000);
    }

    observePageChanges() {
        const observer = new MutationObserver((mutations) => {
            // Double-check enabled state and auto-check setting
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
        // Don't scan if extension is disabled
        if (!this.isEnabled) return;
        
        // Skip if element has already been processed
        if (element.dataset.factcheckerScanned === 'true') return;
        
        // Skip if we've already processed too many facts on this page
        if (this.factsChecked >= 15) { // Limit to 15 facts per page for performance
            return;
        }
        
        const text = element.textContent.trim();
        if (text.length < 20 || text.length > 1000) return; // Skip very short or very long text
        
        // Extract factual statements
        const statements = this.extractFactualStatements(text);
        
        statements.forEach(statement => {
            // Skip if we've already processed this statement
            const statementKey = this.generateStatementKey(statement, element);
            if (this.processedStatements.has(statementKey)) return;
            
            // Skip if we've already processed too many facts
            if (this.factsChecked >= 15) return;
            
            // Mark as processed
            this.processedStatements.add(statementKey);
            
            // Add to queue for fact checking
            this.factCheckQueue.push({
                statement: statement,
                element: element,
                originalText: text
            });
        });
        
        // Mark element as scanned
        element.dataset.factcheckerScanned = 'true';
        
        // Start processing queue if not already processing
        if (!this.isProcessing) {
            setTimeout(() => this.processQueue(), 100);
        }
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
        // Don't process if extension is disabled
        if (!this.isEnabled) return;
        
        if (this.isProcessing || this.factCheckQueue.length === 0) return;
        
        this.isProcessing = true;
        
        // Process multiple items concurrently for speed - increased batch size
        const batchSize = 4; // Process 4 facts at once (increased from 3)
        const batch = this.factCheckQueue.splice(0, batchSize);
        
        // Process batch concurrently
        await Promise.allSettled(
            batch.map(item => this.factCheck(item))
        );
        
        // Shorter delay between batches for speed
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms
        
        this.isProcessing = false;
        
        // Continue processing if there are more items - faster continuation
        if (this.factCheckQueue.length > 0) {
            setTimeout(() => this.processQueue(), 50); // Reduced from 100ms
        }
    }

    async factCheck(item) {
        // Don't fact check if extension is disabled
        if (!this.isEnabled) return;
        
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
        // Don't highlight if extension is disabled
        if (!this.isEnabled) return;
        
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
            // Set a short delay before hiding (300ms)
            tooltip.hideTimeout = setTimeout(() => {
                tooltip.style.opacity = '0';
                // Hide tooltip after fade out but keep it in DOM
                setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 300);
            }, 300); // 300ms delay instead of 2000ms
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
        
        // Debug: Log the result structure
        console.log('🔍 Tooltip result:', {
            sources: result.sources,
            urls: result.urls,
            url: result.url,
            source: result.source
        });
        
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
                    <div class="tooltip-suggestions" style="font-size: 12px; line-height: 1.4;">${result.suggestions.join('<br>')}</div>
                </div>
            `;
        }
        
        if (result.sources && result.sources.length > 0) {
            content += `
                <div style="margin-bottom: 8px;">
                    <div style="font-weight: bold; margin-bottom: 4px; color:rgb(164, 151, 190);">🔍 Sources (click to verify):</div>
                    <div style="font-size: 11px;">
                        ${result.sources.map(source => {
                            // Check for URL in result.urls array (for Google Search sources)
                            const sourceUrl = result.urls ? result.urls.find(u => u.source === source) : null;
                            if (sourceUrl) {
                                return `<a href="${sourceUrl.url}" target="_blank" class="source-link">${source}</a>`;
                            } else {
                                // Check for single URL (for other sources)
                                const singleUrl = result.url && result.source === source ? result.url : null;
                                if (singleUrl) {
                                    return `<a href="${singleUrl}" target="_blank" class="source-link">${source}</a>`;
                                } else {
                                    return `<span class="source-badge">${source}</span>`;
                                }
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
        
        // Clear fact check queue and reset processing state
        this.factCheckQueue = [];
        this.isProcessing = false;
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