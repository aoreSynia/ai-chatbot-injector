/**
 * scanner.js
 * Universal Content Scanner.
 * Strategy: Google News Feed > Readability (Articles) > innerText Density (Apps/Gmail).
 * Core principle: Use `innerText` to capture ALL visible text, then filter noise.
 */

import { Readability } from './readability.js';

export function scanPage() {
    const metadata = getMetadata();
    const result = getMainContent(); // Now returns { content, articles } or just content string

    return {
        title: metadata.title,
        url: window.location.href,
        description: metadata.description,
        content: typeof result === 'string' ? result : result.content,
        articles: result.articles || []
    };
}

function getMetadata() {
    const title = document.title || '';
    const descMeta = document.querySelector('meta[name="description"]');
    const description = descMeta ? descMeta.getAttribute('content') : '';
    return { title, description };
}

function getMainContent() {
    const host = window.location.hostname;

    // 1. Google News → Optimized Feed Scanner
    if (host.includes('news.google.com')) {
        const result = scanGoogleNews();
        // Check if result is object (new) or string (old/fallback in helper)
        const content = typeof result === 'string' ? result : result.content;
        if (content && content.length > 200) return result;
    }

    // 2. Gmail → Email Body Extractor
    if (host.includes('mail.google.com')) {
        return scanGmail();
    }

    // 3. General: Try Readability first (best for articles)
    try {
        const reader = new Readability(document);
        const result = reader.parse();
        if (result && result.score > 20) {
            const md = nodeToMarkdown(result.content);
            if (md.length > 300) {
                console.log('[Scanner] Readability succeeded, score:', result.score);
                return md;
            }
        }
    } catch (e) {
        console.warn('[Scanner] Readability failed:', e);
    }

    // 4. Fallback: Universal innerText extraction
    console.log('[Scanner] Using Universal innerText extraction');
    return extractByInnerText(document.body);
}

// =============================================
// Gmail Scanner
// =============================================

function scanGmail() {
    // Gmail email body lives in `.a3s.aiL` (standard) or `.ii.gt` (alternative)
    // Also try `[role="listitem"]` for email list view
    const emailBody = document.querySelector('.a3s.aiL')
        || document.querySelector('.ii.gt')
        || document.querySelector('[data-message-id]');

    if (emailBody) {
        console.log('[Scanner] Gmail: Found email body container');
        // Use innerText — captures ALL visible text regardless of tag structure
        const rawText = emailBody.innerText;
        if (rawText.length > 50) return formatRawText(rawText, 'Email Content');
    }

    // Fallback: Maybe we're on the inbox list view
    const listView = document.querySelector('[role="main"]');
    if (listView) {
        console.log('[Scanner] Gmail: Using main role container');
        return extractByInnerText(listView);
    }

    return extractByInnerText(document.body);
}

// =============================================
// Google News Feed Scanner
// =============================================

function scanGoogleNews() {
    let markdown = '## Google News Feed\n\n';
    let articles = [];

    const mains = document.querySelectorAll('main');
    let target = null;
    for (const m of mains) {
        if (m.offsetParent !== null || m.getBoundingClientRect().height > 0) {
            target = m;
            break;
        }
    }
    if (!target) target = document.body;

    const articlesElems = target.querySelectorAll('article');
    if (articlesElems.length > 0) {
        articlesElems.forEach(art => {
            const h = art.querySelector('a.svxzne, h3 a, h4 a, h3, h4');
            const time = art.querySelector('time');
            if (h) {
                const text = h.innerText.replace(/\s+/g, ' ').trim();
                const href = h.href || h.closest('a')?.href || '';
                if (text) {
                    markdown += `- [${text}](${href})`;
                    if (time) markdown += ` _(${time.innerText.trim()})_`;
                    markdown += '\n';
                    articles.push({ title: text, url: href });
                }
            }
            // Sub-stories
            art.querySelectorAll('a.WwrzSb, a.VDXfz').forEach(sub => {
                const t = sub.innerText.trim();
                if (t && t !== h?.innerText?.trim()) {
                    markdown += `  - [${t}](${sub.href})\n`;
                    articles.push({ title: t, url: sub.href });
                }
            });
        });
    }

    // Fallback: just grab all link text
    if (markdown.length < 100) {
        target.querySelectorAll('a').forEach(a => {
            const t = a.innerText.trim();
            if (t.length > 20) {
                markdown += `- [${t}](${a.href})\n`;
                articles.push({ title: t, url: a.href });
            }
        });
    }

    return { content: markdown, articles };
}

// =============================================
// Universal innerText Extraction (The Core Fix)
// =============================================

function extractByInnerText(root) {
    // Strategy:
    // 1. Remove noise containers (nav, sidebar, footer, ads)
    // 2. Find the container with the MOST text (content density)
    // 3. Return its innerText formatted as markdown

    // Step 1: Score direct children of body/root to find the "content area"
    const candidates = [];

    // Check semantic containers first
    const semantic = root.querySelectorAll('main, article, [role="main"], .content, #content, .post, .entry');
    for (const el of semantic) {
        if (isVisible(el)) {
            candidates.push({ el, score: scoreElement(el) });
        }
    }

    // If no semantic containers, score direct children
    if (candidates.length === 0) {
        for (const child of root.children) {
            if (isVisible(child) && !isNoise(child)) {
                candidates.push({ el: child, score: scoreElement(child) });
            }
        }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Take the best candidate
    const best = candidates[0]?.el || root;
    console.log('[Scanner] Best candidate:', best.tagName, best.className?.substring?.(0, 30));

    const figures = extractFigures(best);
    return {
        content: formatRawText(getMetadataText(best), ''),
        figures
    };
}

function getMetadataText(el) {
    if (el.nodeType === Node.TEXT_NODE) return el.textContent;
    if (el.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = el.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return '';

    let text = '';

    // Capture semantic attributes for icons/links
    const aria = el.getAttribute('aria-label');
    const titleAttr = el.getAttribute('title');
    const alt = el.getAttribute('alt');

    if (aria) text += ` [${aria}] `;
    if (titleAttr && titleAttr !== aria) text += ` (${titleAttr}) `;
    if (alt && alt !== aria) text += ` {${alt}} `;

    // For icons specifically, try to grab nearby text that might be a label
    if (aria || alt || titleAttr) {
        const neighborText = (el.nextSibling?.textContent || el.previousSibling?.textContent || '').trim();
        if (neighborText && neighborText.length < 30 && !text.includes(neighborText)) {
            text += ` <label: ${neighborText}> `;
        }
    }

    // Recurse
    for (const child of el.childNodes) {
        text += getMetadataText(child);
    }

    return text;
}

function extractFigures(root) {
    const figures = [];
    const images = root.querySelectorAll('img, figure, picture, [role="img"]');

    images.forEach(el => {
        let src = el.src || el.querySelector('img')?.src;
        if (!src) return;

        const cls = (el.className + ' ' + el.id).toLowerCase();
        const parentCls = el.parentElement?.className?.toLowerCase() || '';

        // Target high-value diagrams, architecture, or workflow images
        if (/diagram|architecture|workflow|flow|chart|schema|figure/i.test(cls + parentCls) || el.tagName === 'FIGURE') {
            const caption = el.querySelector('figcaption')?.innerText
                || el.getAttribute('alt')
                || el.getAttribute('aria-label')
                || 'Untitled Diagram';

            figures.push({
                url: src,
                caption,
                context: el.closest('div')?.innerText.substring(0, 200).trim()
            });
        }
    });

    return figures.slice(0, 5); // Cap to 5 high-value figures
}

function scoreElement(el) {
    const text = el.innerText || '';
    const textLen = text.length;

    // Links are noise — subtract link text
    let linkLen = 0;
    el.querySelectorAll('a').forEach(a => { linkLen += (a.innerText || '').length; });

    // Text density = total text minus link text
    let score = textLen - linkLen;

    // Bonus for semantic signals
    const cls = (el.className + ' ' + el.id).toLowerCase();
    if (/article|content|post|entry|main|body|message|mail/i.test(cls)) score *= 1.5;
    if (/nav|sidebar|menu|footer|header|banner|ad|promo|comment/i.test(cls)) score *= 0.2;

    // Penalize very short or very link-heavy elements
    if (textLen < 50) score = 0;
    if (linkLen / textLen > 0.7) score *= 0.3; // Too many links = probably navigation

    return score;
}

function isNoise(el) {
    const tag = el.tagName;
    if (['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'IFRAME', 'NAV', 'FOOTER', 'HEADER', 'ASIDE'].includes(tag)) return true;

    const role = el.getAttribute('role');
    if (['navigation', 'banner', 'complementary', 'contentinfo'].includes(role)) return true;

    const cls = (el.className + ' ' + el.id).toLowerCase();
    if (/sidebar|menu|nav|footer|header|ad|promo|popup|modal|overlay|cookie/i.test(cls)) return true;

    return false;
}

function isVisible(el) {
    if (!el) return false;
    if (el.style?.display === 'none' || el.style?.visibility === 'hidden') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

// =============================================
// Text Formatting
// =============================================

function formatRawText(rawText, prefix) {
    if (!rawText) return '(No content found)';

    // Clean up excessive whitespace while preserving structure
    let lines = rawText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    // Remove duplicate consecutive lines
    lines = lines.filter((line, i) => i === 0 || line !== lines[i - 1]);

    let markdown = prefix ? `## ${prefix}\n\n` : '';
    markdown += lines.join('\n');

    return markdown;
}

// =============================================
// Markdown Converter (for Readability output)
// =============================================

function nodeToMarkdown(element) {
    if (!element) return '';
    // Since Readability returns a cleaned DOM node,
    // we can just use innerText with light formatting
    let md = '';
    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            md += node.textContent;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;
        switch (tag) {
            case 'H1': md += '\n# '; break;
            case 'H2': md += '\n## '; break;
            case 'H3': md += '\n### '; break;
            case 'H4': md += '\n#### '; break;
            case 'P': md += '\n'; break;
            case 'BR': md += '\n'; return;
            case 'LI': md += '\n- '; break;
            case 'PRE': md += '\n```\n'; break;
            case 'A':
                const href = node.href;
                const text = node.innerText?.trim();
                if (text && href) { md += `[${text}](${href})`; return; }
                break;
        }

        for (const child of node.childNodes) walk(child);

        switch (tag) {
            case 'P': md += '\n'; break;
            case 'PRE': md += '\n```\n'; break;
            case 'H1': case 'H2': case 'H3': case 'H4': md += '\n'; break;
        }
    };

    walk(element);
    return md.trim();
}
