document.addEventListener('DOMContentLoaded', function() {
    // Get all form elements
    const elements = {
        autoCheckOnLoad: document.getElementById('autoCheckOnLoad'),
        checkDynamicContent: document.getElementById('checkDynamicContent'),
        minTextLength: document.getElementById('minTextLength'),
        highlightColor: document.getElementById('highlightColor'),
        showConfidence: document.getElementById('showConfidence'),
        tooltipPosition: document.getElementById('tooltipPosition'),
        enableGoogleFactCheck: document.getElementById('enableGoogleFactCheck'),
        enableWikipedia: document.getElementById('enableWikipedia'),
        enableOpenAI: document.getElementById('enableOpenAI'),
        enableGoogleNaturalLanguage: document.getElementById('enableGoogleNaturalLanguage'),
        enableGoogleSearch: document.getElementById('enableGoogleSearch'),
        googleFactCheckKey: document.getElementById('googleFactCheckKey'),
        openaiKey: document.getElementById('openaiKey'),
        googleNaturalLanguageKey: document.getElementById('googleNaturalLanguageKey'),
        saveBtn: document.getElementById('saveBtn'),
        status: document.getElementById('status')
    };

    // Load saved settings
    loadSettings();

    // Save button event listener
    elements.saveBtn.addEventListener('click', saveSettings);

    function loadSettings() {
        chrome.storage.local.get([
            'autoCheckOnLoad',
            'checkDynamicContent',
            'minTextLength',
            'highlightColor',
            'showConfidence',
            'tooltipPosition',
            'enableGoogleFactCheck',
            'enableWikipedia',
            'enableOpenAI',
            'enableGoogleNaturalLanguage',
            'enableGoogleSearch',
            'googleFactCheckKey',
            'openaiKey',
            'googleNaturalLanguageKey'
        ], function(result) {
            // Set default values if not found
            elements.autoCheckOnLoad.checked = result.autoCheckOnLoad !== false;
            elements.checkDynamicContent.checked = result.checkDynamicContent !== false;
            elements.minTextLength.value = result.minTextLength || 20;
            elements.highlightColor.value = result.highlightColor || 'red';
            elements.showConfidence.checked = result.showConfidence !== false;
            elements.tooltipPosition.value = result.tooltipPosition || 'above';
            elements.enableGoogleFactCheck.checked = result.enableGoogleFactCheck !== false;
            elements.enableWikipedia.checked = result.enableWikipedia !== false;
            elements.enableOpenAI.checked = result.enableOpenAI === true;
            elements.enableGoogleNaturalLanguage.checked = result.enableGoogleNaturalLanguage !== false;
            elements.enableGoogleSearch.checked = result.enableGoogleSearch !== false;
            elements.googleFactCheckKey.value = result.googleFactCheckKey || '';
            elements.openaiKey.value = result.openaiKey || '';
            elements.googleNaturalLanguageKey.value = result.googleNaturalLanguageKey || '';
        });
    }

    function saveSettings() {
        const settings = {
            autoCheckOnLoad: elements.autoCheckOnLoad.checked,
            checkDynamicContent: elements.checkDynamicContent.checked,
            minTextLength: parseInt(elements.minTextLength.value),
            highlightColor: elements.highlightColor.value,
            showConfidence: elements.showConfidence.checked,
            tooltipPosition: elements.tooltipPosition.value,
            enableGoogleFactCheck: elements.enableGoogleFactCheck.checked,
            enableWikipedia: elements.enableWikipedia.checked,
            enableOpenAI: elements.enableOpenAI.checked,
            enableGoogleNaturalLanguage: elements.enableGoogleNaturalLanguage.checked,
            enableGoogleSearch: elements.enableGoogleSearch.checked,
            googleFactCheckKey: elements.googleFactCheckKey.value.trim(),
            openaiKey: elements.openaiKey.value.trim(),
            googleNaturalLanguageKey: elements.googleNaturalLanguageKey.value.trim()
        };

        chrome.storage.local.set(settings, function() {
            showStatus('Settings saved successfully!', 'success');
            
            // Notify content scripts of settings change
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(tab => {
                    if (tab.url && tab.url.startsWith('http')) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'updateSettings',
                            settings: settings
                        }).catch(() => {
                            // Ignore errors for tabs that don't have content script
                        });
                    }
                });
            });
        });
    }

    function showStatus(message, type) {
        elements.status.textContent = message;
        elements.status.className = `status ${type}`;
        elements.status.style.display = 'block';
        
        setTimeout(() => {
            elements.status.style.display = 'none';
        }, 3000);
    }

    // Validate API keys when entered
    elements.googleFactCheckKey.addEventListener('blur', function() {
        const key = this.value.trim();
        if (key && !key.startsWith('AIza')) {
            showStatus('Google API key should start with "AIza"', 'error');
        }
    });

    elements.openaiKey.addEventListener('blur', function() {
        const key = this.value.trim();
        if (key && !key.startsWith('sk-')) {
            showStatus('OpenAI API key should start with "sk-"', 'error');
        }
    });

    elements.googleNaturalLanguageKey.addEventListener('blur', function() {
        const key = this.value.trim();
        if (key && !key.startsWith('AIza')) {
            showStatus('Google Natural Language API key should start with "AIza"', 'error');
        }
    });

    // Auto-save on some changes
    const autoSaveElements = [
        'highlightColor',
        'tooltipPosition',
        'minTextLength',
        'enableGoogleFactCheck',
        'enableWikipedia',
        'enableOpenAI',
        'enableGoogleNaturalLanguage',
        'enableGoogleSearch'
    ];

    autoSaveElements.forEach(id => {
        elements[id].addEventListener('change', function() {
            setTimeout(saveSettings, 500);
        });
    });

    // Show/hide API key fields based on checkbox states
    elements.enableGoogleFactCheck.addEventListener('change', function() {
        elements.googleFactCheckKey.style.display = this.checked ? 'block' : 'none';
        if (!this.checked) {
            elements.googleFactCheckKey.value = '';
        }
    });

    elements.enableOpenAI.addEventListener('change', function() {
        elements.openaiKey.style.display = this.checked ? 'block' : 'none';
        if (!this.checked) {
            elements.openaiKey.value = '';
        }
    });

    elements.enableGoogleNaturalLanguage.addEventListener('change', function() {
        elements.googleNaturalLanguageKey.style.display = this.checked ? 'block' : 'none';
        if (!this.checked) {
            elements.googleNaturalLanguageKey.value = '';
        }
    });

    // Initialize visibility
    elements.googleFactCheckKey.style.display = elements.enableGoogleFactCheck.checked ? 'block' : 'none';
    elements.openaiKey.style.display = elements.enableOpenAI.checked ? 'block' : 'none';
    elements.googleNaturalLanguageKey.style.display = elements.enableGoogleNaturalLanguage.checked ? 'block' : 'none';
}); 