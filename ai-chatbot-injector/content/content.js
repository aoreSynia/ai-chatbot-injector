/**
 * content.js
 * Entry point for the extension's content script.
 * Refactored to support domain-based session persistence.
 */

let initChatModule = null;

// Start dynamic import immediately
(async () => {
    try {
        const src = chrome.runtime.getURL('content/ui-controller.js');
        const module = await import(src);
        initChatModule = module.initChat;
        console.log('AI Chatbot Injector: Module loaded.');

        // Auto-restore session if it exists for this DOMAIN
        const hostname = window.location.hostname;
        const key = `domain_session_${hostname}`;

        chrome.storage.session.get(key, (result) => {
            if (chrome.runtime.lastError) {
                console.error('AI Chatbot Injector: Storage session error', chrome.runtime.lastError);
                return;
            }
            if (result[key] && result[key].length > 0) {
                console.log(`AI Chatbot Injector: Domain session found for ${hostname} (${result[key].length} msgs), auto-initializing...`);
                initChatModule();
            }
        });
    } catch (e) {
        console.error('AI Chatbot Injector: Error loading module', e);
    }
})();

// Register listener synchronously - NO AWAIT here
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scan_and_inject') {
        if (initChatModule) {
            initChatModule();
            sendResponse({ status: 'ok' });
        } else {
            console.warn('AI Chatbot Injector: Module not ready yet.');
            sendResponse({ status: 'loading' });
        }
    }
    return true; // Keep channel open
});

console.log('AI Chatbot Injector: Content script listener registered.');
