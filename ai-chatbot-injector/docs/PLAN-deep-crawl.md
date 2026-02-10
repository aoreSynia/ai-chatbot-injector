# Deep Crawl - Fetch Article Content from Links

## Problem
On Google News, the scanner only captures **headline titles**. When user asks "what's this article about?", the bot can't answer because it only has the title, not the article body. User wants Firecrawl-like behavior: **fetch the full article without leaving the page**.

## Approach Options

### Option A: `fetch()` in Service Worker ⭐ Recommended
The background service worker can `fetch()` any URL, parse the HTML, and extract text.

```
User clicks headline → Extension fetches article HTML → Parses with DOMParser → Extracts text → Sends to content script
```

**Pros:** Fast, invisible, no new tabs, works with CORS (service worker bypass).
**Cons:** Some sites block non-browser requests (403/Cloudflare). No JS rendering.

### Option B: Hidden Tab + Script Injection
Open article in a background tab, inject scanner, extract content, close tab.

**Pros:** Full JS rendering, handles dynamic sites.
**Cons:** Slower (~3-5s per article), visible tab flash, resource-heavy.

### Option C: `chrome.offscreen` Document (MV3)
Create an offscreen document to parse fetched HTML.

**Pros:** No visible UI, can use DOMParser.
**Cons:** Limited API, complex setup.

## Recommended: Option A (fetch + DOMParser)

### Architecture
```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│ Content Script│────▶│ Service Worker    │────▶│ Target Article│
│ (scanner.js) │◀────│ (background.js)   │◀────│ (fetch HTML)  │
│              │     │ parse + extract   │     │               │
└─────────────┘     └──────────────────┘     └───────────────┘
```

### Files to Change

#### [NEW] `background/article-fetcher.js`
- Listens for `{ action: 'fetch_article', url: '...' }` messages
- `fetch(url)` → get HTML text
- Parse with regex/string methods (no DOM in service worker)
- Extract `<p>`, `<h1>-<h4>`, `<article>` text
- Return `{ title, content, source }` to content script

#### [MODIFY] `background.js`
- Import `article-fetcher.js`
- Route messages to fetcher

#### [MODIFY] `content/scanner.js`
- In `scanGoogleNews()`: collect article URLs
- Add `fetchArticleContent(url)` that messages the service worker
- Cache fetched articles to avoid re-fetching

#### [MODIFY] `content/ui-controller.js`
- When user asks about a specific article, trigger deep fetch
- Add "📖 Read Full Article" button next to headlines in debug panel

### Limitations
- **Paywalled sites**: Will get paywall HTML, not article
- **Cloudflare/Bot protection**: Some sites return 403
- **Rate limiting**: Need to throttle (max 3 concurrent fetches)
- **No JS rendering**: Sites that render via JS won't work (rare for news)

## Verification
1. On Google News, click 🐞 Debug → see article URLs listed
2. Ask chatbot "summarize the first article" → bot fetches + summarizes
3. Test on paywalled site → graceful fallback to title-only

## User Decision Required
1. **Auto-fetch vs On-demand?**
   - Auto: Fetch top 5 articles when page loads (faster but more bandwidth)
   - On-demand: Only fetch when user asks about a specific article (lighter)
2. **Approve Option A (fetch)?** Or prefer Option B (hidden tab)?
