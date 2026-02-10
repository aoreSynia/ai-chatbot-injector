/**
 * readability.js
 * A lightweight implementation of the Readability algorithm.
 * Scores nodes to find the "Main Content" of a page.
 */

export class Readability {
    constructor(doc) {
        this.doc = doc;
    }

    parse() {
        const clone = this.doc.cloneNode(true);
        this.prepDocument(clone);

        const candidate = this.getBestCandidate(clone);
        if (candidate) {
            return {
                content: this.cleanCandidate(candidate),
                score: candidate.readabilityScore
            };
        }
        return null;
    }

    prepDocument(doc) {
        // Remove noise
        const strip = ['script', 'style', 'svg', 'noscript', 'iframe', 'nav', 'footer', 'header', 'aside'];
        strip.forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        // Remove unlikely candidates by class/id (ads, comments, etc.)
        const unlikely = /combx|comment|community|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup/i;
        const likely = /and|article|body|column|main|shadow/i;

        doc.querySelectorAll('*').forEach(el => {
            const str = (el.className + ' ' + el.id).toLowerCase();
            if (unlikely.test(str) && !likely.test(str) && el.tagName !== 'BODY') {
                el.remove();
            }
        });
    }

    getBestCandidate(doc) {
        const candidates = new Map();

        // 1. Score Paragraphs
        doc.querySelectorAll('p, div, article, section').forEach(node => {
            const text = node.innerText;
            if (text.length < 25) return;

            const score = this.getScore(node);

            // Assign score to parent AND grandparent
            const parent = node.parentElement;
            if (parent) this.addScore(candidates, parent, score);

            if (parent && parent.parentElement) {
                this.addScore(candidates, parent.parentElement, score / 2);
            }
        });

        // 2. Find Top Candidate
        let bestCandidate = null;
        let maxScore = 0;

        for (const [node, score] of candidates.entries()) {
            node.readabilityScore = score; // Store for debugging
            if (score > maxScore) {
                maxScore = score;
                bestCandidate = node;
            }
        }

        return bestCandidate;
    }

    getScore(node) {
        let score = 0;

        // Base score for tag
        switch (node.tagName) {
            case 'DIV': score += 5; break;
            case 'PRE':
            case 'TD':
            case 'BLOCKQUOTE': score += 3; break;
            case 'ADDRESS':
            case 'OL':
            case 'UL':
            case 'DL':
            case 'DD':
            case 'DT':
            case 'LI':
            case 'FORM': score -= 3; break;
            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
            case 'TH': score -= 5; break;
        }

        // Class/ID Weight
        score += this.getClassWeight(node);

        // Text Content Score
        const text = node.innerText;
        // 1 point for every 100 chars
        score += Math.min(Math.floor(text.length / 100), 10);
        // Points for commas (structural text)
        score += text.split(',').length;

        return score;
    }

    getClassWeight(node) {
        let weight = 0;
        const str = (node.className + ' ' + node.id).toLowerCase();

        if (str.search(/negative|combx|comment|com-|contact|foot|footer|footnote|masthead|media|meta|outbrain|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget/i) !== -1) weight -= 25;
        if (str.search(/article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i) !== -1) weight += 25;

        return weight;
    }

    addScore(map, node, score) {
        const current = map.get(node) || 0;
        map.set(node, current + score);
    }

    cleanCandidate(node) {
        // Convert the best candidate node back to Markdown (simplified)
        // We reuse the existing converter logic if possible, or implement a basic one here
        // For now, let's just return the Node, and let Scanner convert it
        return node;
    }
}
