document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('toggleBtn');
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    const factsChecked = document.getElementById('factsChecked');
    const issuesFound = document.getElementById('issuesFound');
    const autoCheck = document.getElementById('autoCheck');
    const highlightIssues = document.getElementById('highlightIssues');
    const showSuggestions = document.getElementById('showSuggestions');
    const clearStatsBtn = document.getElementById('clearStats');
    const openOptionsBtn = document.getElementById('openOptions');

    // Load saved settings and stats
    loadSettings();
    loadStats();

    // Toggle extension on/off
    toggleBtn.addEventListener('click', function() {
        chrome.storage.local.get(['isEnabled'], function(result) {
            const newState = !result.isEnabled;
            chrome.storage.local.set({ isEnabled: newState }, function() {
                updateToggleUI(newState);
                // Send message to content script
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleExtension',
                        enabled: newState
                    });
                });
            });
        });
    });

    // Settings change handlers
    autoCheck.addEventListener('change', function() {
        saveSetting('autoCheck', this.checked);
    });

    highlightIssues.addEventListener('change', function() {
        saveSetting('highlightIssues', this.checked);
    });

    showSuggestions.addEventListener('change', function() {
        saveSetting('showSuggestions', this.checked);
    });

    // Clear stats
    clearStatsBtn.addEventListener('click', function() {
        chrome.storage.local.set({
            factsChecked: 0,
            issuesFound: 0
        }, function() {
            loadStats();
        });
    });

    // Open options page
    openOptionsBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });

    function loadSettings() {
        chrome.storage.local.get([
            'isEnabled',
            'autoCheck',
            'highlightIssues',
            'showSuggestions'
        ], function(result) {
            const isEnabled = result.isEnabled !== false; // Default to true
            updateToggleUI(isEnabled);
            
            autoCheck.checked = result.autoCheck !== false; // Default to true
            highlightIssues.checked = result.highlightIssues !== false; // Default to true
            showSuggestions.checked = result.showSuggestions !== false; // Default to true
        });
    }

    function loadStats() {
        chrome.storage.local.get(['factsChecked', 'issuesFound'], function(result) {
            factsChecked.textContent = result.factsChecked || 0;
            issuesFound.textContent = result.issuesFound || 0;
        });
    }

    function updateToggleUI(isEnabled) {
        if (isEnabled) {
            toggleBtn.textContent = 'Disable';
            toggleBtn.classList.remove('disabled');
            statusDot.classList.add('active');
            statusText.textContent = 'Active';
        } else {
            toggleBtn.textContent = 'Enable';
            toggleBtn.classList.add('disabled');
            statusDot.classList.remove('active');
            statusText.textContent = 'Inactive';
        }
    }

    function saveSetting(key, value) {
        chrome.storage.local.set({ [key]: value }, function() {
            // Send updated settings to content script
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: { [key]: value }
                });
            });
        });
    }

    // Listen for stats updates from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateStats') {
            loadStats();
        }
    });
}); 