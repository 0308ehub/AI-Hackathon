// Background service worker for FactChecker Pro
chrome.runtime.onInstalled.addListener(() => {
    // Initialize default settings
    chrome.storage.local.set({
        isEnabled: true,
        autoCheck: true,
        highlightIssues: true,
        showSuggestions: true,
        factsChecked: 0,
        issuesFound: 0
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup automatically due to manifest configuration
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        // Forward stats update to popup if it's open
        chrome.runtime.sendMessage(request);
    }
});

// Handle tab updates to reinitialize content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        // Content script will automatically run due to manifest configuration
    }
}); 