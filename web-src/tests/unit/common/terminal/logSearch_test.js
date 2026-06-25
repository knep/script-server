import {findTextMatches, highlightsSupported, applyHighlights, clearHighlights} from '@/common/components/terminal/logSearch';

function makeElement(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
}

describe('logSearch.findTextMatches', function () {
    let el;

    afterEach(function () {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
        el = null;
    });

    it('returns no ranges for an empty query', function () {
        el = makeElement('hello world');
        expect(findTextMatches(el, '')).toEqual([]);
    });

    it('returns no ranges for a null root', function () {
        expect(findTextMatches(null, 'x')).toEqual([]);
    });

    it('finds a single match', function () {
        el = makeElement('the quick brown fox');
        const ranges = findTextMatches(el, 'quick');
        expect(ranges).toHaveLength(1);
        expect(ranges[0].toString()).toBe('quick');
    });

    it('finds multiple matches in one text node', function () {
        el = makeElement('aXaXa');
        const ranges = findTextMatches(el, 'a');
        expect(ranges).toHaveLength(3);
    });

    it('is case-insensitive', function () {
        el = makeElement('Error: ERROR error');
        const ranges = findTextMatches(el, 'error');
        expect(ranges).toHaveLength(3);
    });

    it('finds matches across multiple text nodes (e.g. terminal spans)', function () {
        el = makeElement('<span>foo bar</span><span>bar baz</span>bar');
        const ranges = findTextMatches(el, 'bar');
        expect(ranges).toHaveLength(3);
        ranges.forEach(r => expect(r.toString()).toBe('bar'));
    });

    it('does not find overlapping matches (advances past each hit)', function () {
        el = makeElement('aaaa');
        // "aa" should match at index 0 and 2, not 1 and 3 (non-overlapping)
        const ranges = findTextMatches(el, 'aa');
        expect(ranges).toHaveLength(2);
    });

    it('returns ranges that point at the matched text', function () {
        el = makeElement('line one\nline two');
        const ranges = findTextMatches(el, 'two');
        expect(ranges).toHaveLength(1);
        expect(ranges[0].toString()).toBe('two');
    });
});

describe('logSearch highlight API guards', function () {
    it('applyHighlights/clearHighlights are no-ops when unsupported', function () {
        // jsdom has no CSS Custom Highlight API.
        expect(highlightsSupported()).toBeFalsy();
        expect(() => applyHighlights([], 0)).not.toThrow();
        expect(() => clearHighlights()).not.toThrow();
    });
});
