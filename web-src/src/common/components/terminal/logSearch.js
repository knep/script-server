/**
 * Search helpers for the log panel.
 *
 * Matching is done over the rendered text nodes of the output element (whatever
 * the output format produced) and exposed as DOM Ranges, so highlighting can use
 * the CSS Custom Highlight API without mutating the output DOM — which keeps it
 * compatible with the live-appending terminal and inline images.
 */

const HIGHLIGHT_NAME = 'log-search';
const CURRENT_HIGHLIGHT_NAME = 'log-search-current';

/**
 * Find every (case-insensitive) occurrence of `query` in the text nodes under
 * `root` and return them as an array of Ranges, in document order.
 *
 * @param {Node} root
 * @param {string} query
 * @returns {Range[]}
 */
export function findTextMatches(root, query) {
    const ranges = [];
    if (!root || !query) {
        return ranges;
    }

    const needle = query.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    let node;
    while ((node = walker.nextNode())) {
        const haystack = node.nodeValue.toLowerCase();
        let from = 0;
        let index;
        while ((index = haystack.indexOf(needle, from)) !== -1) {
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + needle.length);
            ranges.push(range);
            from = index + needle.length;
        }
    }

    return ranges;
}

/** Whether the CSS Custom Highlight API is available in this browser. */
export function highlightsSupported() {
    return typeof CSS !== 'undefined'
        && CSS.highlights
        && typeof Highlight !== 'undefined';
}

/**
 * Register the given ranges as highlights: all matches under one highlight name,
 * the current match under another so it can be styled distinctly. No-op (safe)
 * when the API is unavailable.
 *
 * @param {Range[]} ranges
 * @param {number} currentIndex
 */
export function applyHighlights(ranges, currentIndex) {
    if (!highlightsSupported()) {
        return;
    }

    clearHighlights();

    if (!ranges || ranges.length === 0) {
        return;
    }

    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));

    if (currentIndex >= 0 && currentIndex < ranges.length) {
        CSS.highlights.set(CURRENT_HIGHLIGHT_NAME, new Highlight(ranges[currentIndex]));
    }
}

/** Remove all log-search highlights. Safe when the API is unavailable. */
export function clearHighlights() {
    if (!highlightsSupported()) {
        return;
    }
    CSS.highlights.delete(HIGHLIGHT_NAME);
    CSS.highlights.delete(CURRENT_HIGHLIGHT_NAME);
}
