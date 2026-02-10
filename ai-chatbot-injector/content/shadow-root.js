/**
 * shadow-root.js
 * Creates the Shadow DOM host and visual interface.
 */

export async function createChatInterface() {
    // 1. Create Host Element
    const hostId = 'ai-chatbot-host';
    if (document.getElementById(hostId)) return; // Already exists

    const host = document.createElement('div');
    host.id = hostId;
    document.body.appendChild(host);

    // 2. Attach Shadow Root
    const shadow = host.attachShadow({ mode: 'open' });

    // 3. Load Resources
    const styleUrl = chrome.runtime.getURL('assets/styles.css');
    const templateUrl = chrome.runtime.getURL('assets/chat-template.html');

    const [styleParams, templateText] = await Promise.all([
        fetch(styleUrl).then(r => r.text()),
        fetch(templateUrl).then(r => r.text())
    ]);

    // 4. Inject Styles and HTML
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styleParams;
    shadow.appendChild(styleSheet);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = templateText;
    shadow.appendChild(wrapper);

    return shadow;
}

export function toggleChatVisibility(shadowRoot, show) {
    const container = shadowRoot.getElementById('chat-container');
    if (show) {
        container.classList.remove('minimized');
        container.style.opacity = '1';
    } else {
        container.classList.add('minimized');
    }
}
