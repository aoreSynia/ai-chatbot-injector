/**
 * article-fetcher.js
 * Hybrid article fetcher for the AI Chatbot Injector.
 * 
 * Strategy:
 * - "light" mode (Option A): fetch() HTML → parse with regex → fast, for multiple articles
 * - "deep" mode (Option B): open tab → inject scanner → extract → close tab → accurate, for single article
 * 
 * Used on-demand: only when user asks about a specific article.
 */

// --- Light Fetch (Option A) ---

async function lightFetch(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
                'Accept': 'text/html'
            },
            redirect: 'follow'
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}`, method: 'light' };
        }

        const html = await response.text();
        const extracted = extractFromHTML(html);

        return {
            success: true,
            method: 'light',
            url: url,
            title: extracted.title,
            content: extracted.content,
            contentLength: extracted.content.length
        };
    } catch (e) {
        return { success: false, error: e.message, method: 'light' };
    }
}

function extractFromHTML(html) {
    // Parse title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].replace(/&[^;]+;/g, ' ').trim() : 'Untitled';

    // Remove noise tags
    let clean = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[\s\S]*?<\/header>/gi, '')
        .replace(/<aside[\s\S]*?<\/aside>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    // Try to find <article> or <main> first
    const articleMatch = clean.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
        || clean.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
        || clean.match(/<div[^>]*class="[^"]*(?:article|content|post|entry|story)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    const contentHTML = articleMatch ? articleMatch[1] : clean;

    // Extract text from paragraphs
    let content = '';
    const paragraphs = contentHTML.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    for (const p of paragraphs) {
        const text = p.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
        if (text.length > 20) {
            content += text + '\n\n';
        }
    }

    // Also grab headings
    const headings = contentHTML.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi) || [];
    let headingText = '';
    for (const h of headings) {
        const level = h.match(/<h([1-4])/i)?.[1] || '2';
        const text = h.replace(/<[^>]+>/g, '').trim();
        if (text.length > 3) {
            headingText += '#'.repeat(parseInt(level)) + ' ' + text + '\n\n';
        }
    }

    content = headingText + content;

    // If paragraphs gave us nothing, strip all tags
    if (content.length < 100) {
        content = contentHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return { title, content: content.substring(0, 30000) };
}

// --- Deep Fetch (Option B) ---

async function deepFetch(url) {
    try {
        // Create tab in background
        const tab = await chrome.tabs.create({ url: url, active: false });

        // Wait for page to load
        await new Promise((resolve) => {
            const listener = (tabId, info) => {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
            // Timeout safety
            setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }, 10000);
        });

        // Extra wait for JS rendering
        await new Promise(r => setTimeout(r, 2000));

        // Inject extraction script
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // This runs IN the target page
                // Find best content container
                const article = document.querySelector('article')
                    || document.querySelector('[role="main"]')
                    || document.querySelector('main');
                const target = article || document.body;

                // Remove noise
                target.querySelectorAll('script, style, nav, footer, header, aside, iframe').forEach(el => el.remove());

                return {
                    title: document.title,
                    content: target.innerText.substring(0, 30000),
                    url: window.location.href
                };
            }
        });

        // Close the tab
        await chrome.tabs.remove(tab.id);

        if (results && results[0]?.result) {
            return {
                success: true,
                method: 'deep',
                ...results[0].result,
                contentLength: results[0].result.content.length
            };
        }

        return { success: false, error: 'No results from injection', method: 'deep' };
    } catch (e) {
        return { success: false, error: e.message, method: 'deep' };
    }
}

// --- Message Handler ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetch_article') {
        const { url, mode } = request;
        // mode: 'light' | 'deep' | 'auto'

        const doFetch = async () => {
            if (mode === 'deep') {
                return await deepFetch(url);
            }
            if (mode === 'light') {
                return await lightFetch(url);
            }
            // Auto: try light first, fallback to deep if content is too short
            const lightResult = await lightFetch(url);
            if (lightResult.success && lightResult.contentLength > 300) {
                return lightResult;
            }
            console.log('[Fetcher] Light fetch insufficient, trying deep fetch...');
            return await deepFetch(url);
        };

        doFetch().then(result => sendResponse(result));
        return true; // Keep channel open for async
    }

    if (request.action === 'fetch_multiple') {
        // Batch light-fetch for multiple URLs (Google News overview)
        const { urls } = request;
        const fetchAll = async () => {
            const results = [];
            // Throttle: max 3 concurrent
            for (let i = 0; i < urls.length; i += 3) {
                const batch = urls.slice(i, i + 3);
                const batchResults = await Promise.all(batch.map(u => lightFetch(u)));
                results.push(...batchResults);
            }
            return results;
        };

        fetchAll().then(results => sendResponse(results));
        return true;
    }
});
