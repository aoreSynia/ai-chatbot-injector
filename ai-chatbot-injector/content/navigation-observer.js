/**
 * navigation-observer.js
 * Detects SPA navigation events (history.pushState, replaceState, popstate).
 */

const callbacks = new Set();
let lastUrl = window.location.href;

export function onNavigate(callback) {
    callbacks.add(callback);
}

function notify() {
    const url = window.location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        callbacks.forEach(cb => cb(url));
    }
}

// 1. Listen for browser Back/Forward
window.addEventListener('popstate', notify);
window.addEventListener('hashchange', notify);

// 2. Monkey-patch pushState/replaceState
// Note: Content scripts generally run in an isolated world and cannot directly 
// patch the page's window.history. However, we can use a MutationObserver on 
// document.title or body as a proxy for navigation in many SPAs, or inject a script.
//
// For simplicity and MV3 compliance without extra injection, we'll use a 
// MutationObserver on <title> and periodic URL check as a robust fallback.
// Direct monkey-patching in content script only affects the content script's view, 
// not the page's.

// Strategy: Polling + MutationObserver (Robust & Simple)
// Most SPAs update Title or Body on nav.

const observer = new MutationObserver(() => {
    // Check if URL changed
    notify();
});

observer.observe(document.querySelector('title') || document.body, {
    subtree: true,
    characterData: true,
    childList: true
});

// Backup poller (fast, cheap)
setInterval(notify, 1000);

console.log('AI Chatbot Injector: Navigation observer active.');
