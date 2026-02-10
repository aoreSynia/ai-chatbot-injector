/**
 * service-worker.js
 * Background process.
 */

// Import article fetcher (registers its own message listeners)
importScripts('./article-fetcher.js');

// On Install: Set default config if empty
chrome.runtime.onInstalled.addListener(() => {
    // Allow content scripts to access session storage
    if (chrome.storage.session.setAccessLevel) {
        chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
    }

    chrome.contextMenus.create({
        id: "open_ai_chat",
        title: "💬 Chat with AI about this page",
        contexts: ["page", "selection"]
    });
});

// Context Menu Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "open_ai_chat") {
        chrome.tabs.sendMessage(tab.id, { action: "scan_and_inject" });
    }
});

// Message Bridge for Tab Info
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_tab_info') {
        sendResponse({ tabId: sender.tab.id });
    }
    return true; // Keep channel open for async fetch
});
