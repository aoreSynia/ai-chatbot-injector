document.addEventListener('DOMContentLoaded', async () => {
    const providerSelect = document.getElementById('provider');
    const endpointGroup = document.getElementById('endpoint-group');
    const endpointInput = document.getElementById('endpoint');
    const apiKeyInput = document.getElementById('apiKey');
    const modelInput = document.getElementById('model');
    const systemPromptInput = document.getElementById('systemPrompt');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load saved settings
    const { config } = await chrome.storage.sync.get('config');

    if (config) {
        providerSelect.value = config.provider || 'openai';
        endpointInput.value = config.endpoint || '';
        apiKeyInput.value = config.apiKey || '';
        modelInput.value = config.model || '';
        systemPromptInput.value = config.systemPrompt || '';

        updateVisibility();
    }

    // Handle provider change
    providerSelect.addEventListener('change', updateVisibility);

    function updateVisibility() {
        const provider = providerSelect.value;
        if (provider === 'custom') {
            endpointGroup.style.display = 'flex';
        } else {
            endpointGroup.style.display = 'none';
            if (provider === 'openai') {
                endpointInput.value = 'https://api.openai.com/v1';
                if (!modelInput.value) modelInput.value = 'gpt-4o-mini';
            } else if (provider === 'gemini') {
                endpointInput.value = 'https://generativelanguage.googleapis.com/v1beta/models';
                if (!modelInput.value) modelInput.value = 'gemini-1.5-flash';
            }
        }
    }

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const config = {
            provider: providerSelect.value,
            endpoint: endpointInput.value,
            apiKey: apiKeyInput.value,
            model: modelInput.value,
            systemPrompt: systemPromptInput.value
        };

        try {
            await chrome.storage.sync.set({ config });
            statusDiv.textContent = 'Settings saved!';
            statusDiv.classList.remove('error');
            setTimeout(() => statusDiv.textContent = '', 2000);
        } catch (err) {
            statusDiv.textContent = 'Error saving settings.';
            statusDiv.classList.add('error');
            console.error(err);
        }
    });

    // Launch Chat
    document.getElementById('launchBtn').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            // Inject script if strictly needed (scripting permission) or rely on content script being there.
            // Content script is defined in manifest to run on document_idle.
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'scan_and_inject' });
                window.close(); // Close popup
            } catch (e) {
                statusDiv.textContent = 'Error: Refresh the page?';
                console.error(e);
            }
        }
    });

    // Initial update
    updateVisibility();
});
