/**
 * ui-controller.js
 * Manages the Chat UI events and logic.
 * Updated: Navigation, Dynamic Content, Debug Panel, Agentic Research, 
 * MULTIMODAL VISION, and SESSION PERSISTENCE.
 */
import { createChatInterface, toggleChatVisibility } from './shadow-root.js';
import { chatWithLLM } from './llm-client.js';
import { scanPage } from './scanner.js';
import { onNavigate } from './navigation-observer.js';

let shadowRoot = null;
let chatHistory = [];
let contextData = null;
let contentObserver = null;
let scanTimeout = null;

// Session State
let sessionKey = null;

// Agentic Loop State
let currentLoopCount = 0;
const MAX_AUTO_CRAWLS = 3;

// Track previous state to detect actual changes
let previousTitle = document.title;
let previousHeadline = '';

const DEBOUNCE_MS = 2000;

export async function initChat() {
    if (!shadowRoot) {
        shadowRoot = await createChatInterface();
        bindEvents(shadowRoot);

        // Initial Scan
        logDebug('Init', 'Initializing Chat Interface...');
        updateContext('Initial load');

        // Restore Session History
        await restoreSessionHistory();

        onNavigate((newUrl) => {
            logDebug('Nav', `Detected: ${newUrl}`);
            addSystemMessage('Navigation detected... waiting for content load.');
            waitForContentUpdate().then(() => {
                updateContext('Navigation');
            });
        });

        setupContentObserver();
    } else {
        toggleChatVisibility(shadowRoot, true);
    }
}

function getSessionKey() {
    return `domain_session_${window.location.hostname}`;
}

async function restoreSessionHistory() {
    const key = getSessionKey();
    const result = await chrome.storage.session.get(key);
    const history = result[key];

    if (history && history.length > 0) {
        logDebug('Session', `Restoring ${history.length} messages.`);
        chatHistory = history;

        // Re-inject messages into UI
        chatHistory.forEach(msg => {
            addMessage(msg.role, msg.content, false); // false = don't save again
        });

        // Auto-open chat if session exists
        toggleChatVisibility(shadowRoot, true);
        addSystemMessage('Session restored. Continuing conversation...');
    }
}

async function saveSessionHistory() {
    const key = getSessionKey();
    await chrome.storage.session.set({ [key]: chatHistory });
}

async function clearSessionHistory() {
    const key = getSessionKey();
    await chrome.storage.session.remove(key);
    chatHistory = [];

    // Reset UI
    const msgsDiv = shadowRoot.getElementById('chat-messages');
    if (msgsDiv) {
        msgsDiv.innerHTML = '<div class="message assistant">Hello! I\'ve reset the chat. How can I help?</div>';
    }
    logDebug('Session', 'History cleared manually.');
}

function getHeadlineHash() {
    const h = document.querySelector('h2, .svxzne, [role="heading"]');
    return h ? h.innerText.trim() : '';
}

function waitForContentUpdate() {
    return new Promise((resolve) => {
        let checks = 0;
        const maxChecks = 80;
        const startTitle = document.title;
        const startHeadline = getHeadlineHash();

        const interval = setInterval(() => {
            checks++;
            const currentTitle = document.title;
            const currentHeadline = getHeadlineHash();
            if (currentTitle !== startTitle && currentHeadline !== startHeadline) {
                clearInterval(interval);
                setTimeout(resolve, 1000);
            } else if (checks >= maxChecks) {
                clearInterval(interval);
                resolve();
            }
        }, 100);
    });
}

function setupContentObserver() {
    if (contentObserver) contentObserver.disconnect();
    const target = document.querySelector('main') || document.body;
    contentObserver = new MutationObserver((mutations) => {
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            silentUpdateContext();
        }, DEBOUNCE_MS);
    });
    contentObserver.observe(target, { childList: true, subtree: true, characterData: true, attributes: true });
}

function updateContext(trigger) {
    logDebug('Scan', `Trigger: ${trigger}`);
    const newData = scanPage();
    if (contextData && contextData.title === newData.title && contextData.content.substring(0, 50) === newData.content.substring(0, 50)) {
        logDebug('Scan', 'Skipped (Duplicate context)');
        return;
    }
    contextData = newData;
    addSystemMessage(`Context updated: ${contextData.title}`);
    logDebug('Scan', `Updated. Title: ${contextData.title}, Figures: ${contextData.figures?.length || 0}`);
    updateDebugPanel();
    previousTitle = document.title;
    previousHeadline = getHeadlineHash();
}

function silentUpdateContext() {
    const newData = scanPage();
    const currentHeadline = getHeadlineHash();
    if (contextData && (newData.title !== contextData.title || currentHeadline !== previousHeadline)) {
        contextData = newData;
        previousTitle = document.title;
        previousHeadline = currentHeadline;
        logDebug('Scan', 'Silent update (DOM Mutation settled)');
        updateDebugPanel();
    }
}

async function fetchArticleContent(article, mode = 'auto') {
    logDebug('Crawl', `Starting ${mode} fetch for: ${article.title}`);
    addSystemMessage(`Fetching full content for: ${article.title}...`);
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetch_article', url: article.url, mode: mode }, (response) => {
            if (response && response.success) {
                const articleContext = `\n--- DEEP SCAN: ${response.title} ---\nSource: ${response.url}\n\n${response.content}\n------------------------------\n`;
                contextData.content += "\n\n" + articleContext;
                addSystemMessage(`Fetched: ${response.title}`);
                updateDebugPanel();
                resolve(response);
            } else {
                resolve(null);
            }
        });
    });
}

function logDebug(category, message) {
    if (!shadowRoot) return;
    const logsDiv = shadowRoot.getElementById('debug-logs');
    if (logsDiv) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span style="color:#94a3b8">[${new Date().toLocaleTimeString()}]</span> <span style="color:#60a5fa">[${category}]</span> ${message}`;
        logsDiv.appendChild(entry);
        logsDiv.scrollTop = logsDiv.scrollHeight;
    }
}

function updateDebugPanel() {
    if (!shadowRoot || !contextData) return;
    const contextPre = shadowRoot.getElementById('debug-context');
    const metadataDiv = shadowRoot.getElementById('debug-metadata');
    if (contextPre) contextPre.textContent = contextData.content.substring(0, 2000);
    if (metadataDiv) {
        let articlesList = '';
        if (contextData.articles?.length > 0) {
            articlesList = '<div style="margin-top:8px"><b>Articles:</b><ul style="padding-left:15px; margin:4px 0">';
            contextData.articles.slice(0, 5).forEach((art, i) => {
                articlesList += `<li>${art.title.substring(0, 25)} <button class="debug-crawl-btn" data-index="${i}">Fetch</button></li>`;
            });
            articlesList += '</ul></div>';
        }
        metadataDiv.innerHTML = `<b>Title:</b> ${contextData.title}<br><b>Figs:</b> ${contextData.figures?.length || 0}${articlesList}`;
        metadataDiv.querySelectorAll('.debug-crawl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const article = contextData.articles[parseInt(btn.dataset.index)];
                fetchArticleContent(article, 'auto');
            });
        });
    }
}

function toggleDebugPanel(show) {
    const panel = shadowRoot.getElementById('debug-panel');
    if (panel) {
        panel.style.display = show ? 'flex' : 'none';
        if (show) updateDebugPanel();
    }
}

function bindEvents(root) {
    const sendBtn = root.getElementById('send-btn');
    const input = root.getElementById('chat-input');
    const debugBtn = root.getElementById('debug-btn');

    root.getElementById('minimize-btn').addEventListener('click', () => toggleChatVisibility(root, false));
    root.getElementById('close-btn').addEventListener('click', () => root.getElementById('chat-container').remove());
    root.getElementById('toggle-btn').addEventListener('click', () => toggleChatVisibility(root, true));
    root.getElementById('reset-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the chat history for this domain?')) {
            clearSessionHistory();
        }
    });
    debugBtn.addEventListener('click', () => toggleDebugPanel(shadowRoot.getElementById('debug-panel').style.display === 'none'));

    const sendMessage = async (overrideText = null) => {
        const text = overrideText || input.value.trim();
        if (!text) return;

        if (!overrideText) {
            addMessage('user', text);
            input.value = '';
            currentLoopCount = 0;
        }

        input.disabled = true;
        sendBtn.disabled = true;
        if (!contextData) contextData = scanPage();

        // Prepare Vision Data (Figures)
        let promptFigures = "";
        if (contextData.figures?.length > 0) {
            promptFigures = "\n--- DISCOVERED FIGURES ---\n";
            for (const [i, fig] of contextData.figures.entries()) {
                promptFigures += `Figure ${i + 1}: ${fig.caption} (URL: ${fig.url})\nContext: ${fig.context}\n`;
            }
        }

        const systemPrompt = `You are an Autonomous Research Assistant with Multimedia Capabilities.
Your primary language is the language used by the user in their latest message. 
CRITICAL: ALWAYS respond in Vietnamese unless the user explicitly switches to another language. Maintain Vietnamese consistently even after performing recursive research loops.

CONTEXT:
Title: ${contextData.title}
URL: ${contextData.url}
${promptFigures}

CONTENT (including metadata from icons/attributes):
${contextData.content.substring(0, 25000)}

SPECIAL INSTRUCTIONS:
1. If the user asks about an icon or visual build (TFT), use the metadata in {} or [] tags.
2. If the user asks about a "Figure" or "Architecture", refer to the DISCOVERED FIGURES.
3. Use <fetch>URL</fetch> to research deeper into articles.
4. Keep your answer professional, accurate, and in Vietnamese.
`;

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...chatHistory,
            { role: 'user', content: [{ type: 'text', text: text }] }
        ];

        let assistantMessageDiv = addMessage('assistant', currentLoopCount > 0 ? '<i>Researching...</i>' : '...');
        let assistantText = '';

        await chatWithLLM(
            messagesPayload,
            (chunk) => {
                assistantText += chunk;
                assistantMessageDiv.innerHTML = window.marked ? window.marked.parse(assistantText) : assistantText;
                scrollToBottom();
            },
            async () => {
                const fetchMatch = assistantText.match(/<fetch>(https?:\/\/[^<]+)<\/fetch>/i);
                if (fetchMatch && currentLoopCount < MAX_AUTO_CRAWLS) {
                    const fetchUrl = fetchMatch[1].trim();
                    const article = contextData.articles?.find(a => a.url === fetchUrl) || { title: 'Deeper Research', url: fetchUrl };
                    currentLoopCount++;
                    addSystemMessage(`AI researching: ${article.title}`);
                    if (await fetchArticleContent(article)) sendMessage(`Continue research with new content.`);
                    else finalizeResponse(text, assistantText);
                } else {
                    finalizeResponse(text, assistantText);
                }
            },
            (err) => {
                assistantMessageDiv.innerHTML += `<br><span style="color:red">Error: ${err.message}</span>`;
                input.disabled = false;
                sendBtn.disabled = false;
            }
        );
    };

    function finalizeResponse(userText, assistantText) {
        if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant') {
            // Just Update existing entry if needed, but normally we push new ones
        }
        chatHistory.push({ role: 'user', content: userText });
        chatHistory.push({ role: 'assistant', content: assistantText });
        saveSessionHistory();

        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }

    sendBtn.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => (e.key === 'Enter' && !e.shiftKey) && (e.preventDefault(), sendMessage()));
}

function addMessage(role, text, shouldSave = true) {
    const msgsDiv = shadowRoot.getElementById('chat-messages');
    if (!msgsDiv) return null;

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // Normalize text (handle multimodal content blocks)
    let contentToRender = text;
    if (Array.isArray(text)) {
        contentToRender = text.map(block => block.text || '').join('\n');
    }

    if (window.marked && role === 'assistant') {
        msgDiv.innerHTML = window.marked.parse(contentToRender);
    } else {
        msgDiv.textContent = contentToRender;
    }

    msgsDiv.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
}

function addSystemMessage(text) {
    const msgsDiv = shadowRoot.getElementById('chat-messages');
    if (!msgsDiv) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system';
    msgDiv.innerHTML = text;
    msgsDiv.appendChild(msgDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const msgsDiv = shadowRoot.getElementById('chat-messages');
    if (msgsDiv) msgsDiv.scrollTop = msgsDiv.scrollHeight;
}
