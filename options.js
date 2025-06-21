document.addEventListener('DOMContentLoaded', function() {
    // Get all form elements
    const elements = {
        autoCheckOnLoad: document.getElementById('autoCheckOnLoad'),
        checkDynamicContent: document.getElementById('checkDynamicContent'),
        minTextLength: document.getElementById('minTextLength'),
        highlightColor: document.getElementById('highlightColor'),
        showConfidence: document.getElementById('showConfidence'),
        tooltipPosition: document.getElementById('tooltipPosition'),
        checkStatistics: document.getElementById('checkStatistics'),
        checkDates: document.getElementById('checkDates'),
        checkResearch: document.getElementById('checkResearch'),
        checkAbsolutes: document.getElementById('checkAbsolutes'),
        openaiKey: document.getElementById('openaiKey'),
        snopesKey: document.getElementById('snopesKey'),
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
            'checkStatistics',
            'checkDates',
            'checkResearch',
            'checkAbsolutes',
            'openaiKey',
            'snopesKey'
        ], function(result) {
            // Set default values if not found
            elements.autoCheckOnLoad.checked = result.autoCheckOnLoad !== false;
            elements.checkDynamicContent.checked = result.checkDynamicContent !== false;
            elements.minTextLength.value = result.minTextLength || 20;
            elements.highlightColor.value = result.highlightColor || 'red';
            elements.showConfidence.checked = result.showConfidence !== false;
            elements.tooltipPosition.value = result.tooltipPosition || 'above';
            elements.checkStatistics.checked = result.checkStatistics !== false;
            elements.checkDates.checked = result.checkDates !== false;
            elements.checkResearch.checked = result.checkResearch !== false;
            elements.checkAbsolutes.checked = result.checkAbsolutes !== false;
            elements.openaiKey.value = result.openaiKey || '';
            elements.snopesKey.value = result.snopesKey || '';
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
            checkStatistics: elements.checkStatistics.checked,
            checkDates: elements.checkDates.checked,
            checkResearch: elements.checkResearch.checked,
            checkAbsolutes: elements.checkAbsolutes.checked,
            openaiKey: elements.openaiKey.value.trim(),
            snopesKey: elements.snopesKey.value.trim()
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
    elements.openaiKey.addEventListener('blur', function() {
        const key = this.value.trim();
        if (key && !key.startsWith('sk-')) {
            showStatus('OpenAI API key should start with "sk-"', 'error');
        }
    });

    elements.snopesKey.addEventListener('blur', function() {
        const key = this.value.trim();
        if (key && key.length < 10) {
            showStatus('Snopes API key seems too short', 'error');
        }
    });

    // Auto-save on some changes
    const autoSaveElements = [
        'highlightColor',
        'tooltipPosition',
        'minTextLength'
    ];

    autoSaveElements.forEach(id => {
        elements[id].addEventListener('change', function() {
            setTimeout(saveSettings, 500);
        });
    });
}); 