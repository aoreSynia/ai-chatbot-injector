# PLAN-chat-persistence.md - Session Persistence for Multi-Page Navigation

## Goal
Solve the "disappearing chat" issue on multi-page sites (like ArgoCD docs) by persisting `chatHistory` during the tab's session.

## The Problem
- **Page Reloads**: When navigating between `understand_the_basics` and `user-guide` on ArgoCD, a full page reload occurs.
- **State Clear**: JS variables (like `chatHistory`) are stored in the content script memory and are wiped on reload.
- **Requirement**: Keep history during navigation, but clear it when the tab is closed.

## Proposed Solution: `chrome.storage.session`
We will use Chrome's session storage API which is perfect for this:
- **Persistence**: Survived page reloads.
- **Lifecycle**: Cleared when the session ends (browser closed).
- **Partitioning**: We will key the storage by a `tab_ctx_[ID]` to isolate conversations between different tabs.

## Proposed Changes

### 1. `ui-controller.js` (State Management)
- **Load on Init**: In `initChat`, send a message to the background script to get a unique "Session Key" for the current tab. Then fetch `chatHistory` from `chrome.storage.session`.
- **Save on Message**: Every time a message is added to `chatHistory`, sync it to `chrome.storage.session`.
- **System Message Handling**: On a new page load (fresh injection), the AI should be notified that the page has changed but the context remains.

### 2. `service-worker.js` (Bridge)
- Ensure the background script can provide the caller's `tab.id` so the content script knows its own session key.

## Verification Plan

### Manual Verification
1. Open ArgoCD Docs.
2. Ask a question about "Basics".
3. Navigate to "User Guide" (Full reload).
4. Verify the chat window remains (or re-injected) and the **previous messages are still there**.

## Socratic Gate (Phase 0)
1. **Context Conflict**: When you move to a NEW page, should the AI forget the OLD page's content but keep the chat?
    - *Proposed*: Keep the chat history, but the *current page context* (used for prompt generation) will update to the new page.
2. **Auto-Injection**: Currently, the user might need to click the 🐞 button again. Should we auto-re-open the chat if there is existing history?
    - *Proposed*: Yes, if a session history exists for the tab, auto-maximize the chat on reload.
命中"
