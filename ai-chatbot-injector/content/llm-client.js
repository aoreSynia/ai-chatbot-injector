/**
 * llm-client.js
 * Handles communication with LLM providers (OpenAI, Gemini).
 * Updated to support Multimodal Content Blocks (Text + Images).
 */

export async function chatWithLLM(messages, onChunk, onComplete, onError) {
    try {
        const { config } = await chrome.storage.sync.get('config');
        if (!config || !config.apiKey) {
            throw new Error('API Key not found. Please set it in the extension options.');
        }

        if (config.provider === 'openai' || config.provider === 'custom') {
            await streamOpenAI(messages, config, onChunk, onComplete);
        } else if (config.provider === 'gemini') {
            await streamGemini(messages, config, onChunk, onComplete);
        } else {
            throw new Error(`Unknown provider: ${config.provider}`);
        }
    } catch (err) {
        onError(err);
    }
}

async function streamOpenAI(messages, config, onChunk, onComplete) {
    const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';

    // Convert messages to content-block format if they aren't already
    // OpenAI supports: content: string OR content: [{ type: "text", text: "..." }, { type: "image_url", image_url: { url: "..." } }]
    const formattedMessages = messages.map(m => {
        if (Array.isArray(m.content)) return m; // Already blocks
        return {
            role: m.role,
            content: m.content
        };
    });

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model || 'gpt-4o-mini',
            messages: formattedMessages,
            stream: true
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to connect to OpenAI');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });

        const lines = chunk.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                    const jsonStr = line.replace('data: ', '');
                    if (jsonStr === '[DONE]') break;
                    const json = JSON.parse(jsonStr);
                    const content = json.choices[0]?.delta?.content || '';
                    if (content) onChunk(content);
                } catch (e) {
                    // ignore parse errors for partial chunks
                }
            }
        }
    }
    onComplete();
}

async function streamGemini(messages, config, onChunk, onComplete) {
    // Map OpenAI messages to Gemini format
    // Gemini expects: { role: 'user'|'model', parts: [{ text: '...' }, { inlineData: { mimeType: '...', data: '...' } }] }
    const contents = messages.map(m => {
        const parts = [];

        if (Array.isArray(m.content)) {
            m.content.forEach(block => {
                if (block.type === 'text') {
                    parts.push({ text: block.text });
                } else if (block.type === 'image_url') {
                    // block.image_url.url can be data:image/png;base64,... 
                    const url = block.image_url.url;
                    if (url.startsWith('data:')) {
                        const mid = url.indexOf(',');
                        const mime = url.substring(5, url.indexOf(';'));
                        const base64 = url.substring(mid + 1);
                        parts.push({ inlineData: { mimeType: mime, data: base64 } });
                    } else {
                        // Gemini Pro doesn't support public image URLs directly in the same way as OpenAI
                        // We would need to fetch the image and convert to base64, 
                        // but for now we'll only support base64 provided by ui-controller.
                        parts.push({ text: `[Image Reference: ${url}]` });
                    }
                }
            });
        } else {
            parts.push({ text: m.content });
        }

        return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: parts
        };
    });

    // Handle System Message for Gemini
    if (contents.length > 0 && messages[0].role === 'system') {
        const systemMsg = messages[0].content;
        const systemText = Array.isArray(systemMsg) ? systemMsg.map(b => b.text || "").join("\n") : systemMsg;
        contents.shift();
        if (contents.length > 0 && contents[0].role === 'user') {
            contents[0].parts.unshift({ text: `System Instruction: ${systemText}\n\n` });
        } else {
            contents.unshift({ role: 'user', parts: [{ text: `System Instruction: ${systemText}` }] });
        }
    }

    const url = `${config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to connect to Gemini');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    onChunk(text);
    onComplete();
}
