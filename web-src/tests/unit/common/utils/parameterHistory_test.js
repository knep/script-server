'use strict';

import {vi} from 'vitest';
import {
    getMostRecentValues,
    loadParameterHistory,
    removeParameterHistoryEntry,
    saveParameterHistory,
    shouldUseHistoricalValues,
    toggleFavoriteEntry,
} from '@/common/utils/parameterHistory';

const SCRIPT = 'my-script';
const KEY = 'script_server_param_history_' + SCRIPT;

// jsdom doesn't expose a working localStorage here, so use an in-memory mock.
function createLocalStorageMock() {
    let store = {};
    return {
        getItem: (key) => (key in store ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
    };
}

describe('Test parameterHistory', function () {
    beforeEach(function () {
        vi.stubGlobal('localStorage', createLocalStorageMock());
    });

    afterEach(function () {
        vi.unstubAllGlobals();
    });

    describe('saveParameterHistory / loadParameterHistory', function () {
        it('saves a new entry at the front', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            const history = loadParameterHistory(SCRIPT);
            expect(history.length).toBe(1);
            expect(history[0].values).toEqual({a: 1});
            expect(history[0].favorite).toBe(false);
        });

        it('ignores empty parameter values', function () {
            saveParameterHistory(SCRIPT, {});
            expect(loadParameterHistory(SCRIPT)).toEqual([]);
        });

        it('prepends newer distinct entries', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            saveParameterHistory(SCRIPT, {a: 2});
            const history = loadParameterHistory(SCRIPT);
            expect(history.map(e => e.values)).toEqual([{a: 2}, {a: 1}]);
        });

        it('updates timestamp instead of duplicating identical values', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            saveParameterHistory(SCRIPT, {a: 1});
            expect(loadParameterHistory(SCRIPT).length).toBe(1);
        });

        it('caps non-favorite entries at 10', function () {
            for (let i = 0; i < 12; i++) {
                saveParameterHistory(SCRIPT, {n: i});
            }
            const history = loadParameterHistory(SCRIPT);
            expect(history.length).toBe(10);
            // newest first
            expect(history[0].values).toEqual({n: 11});
        });

        it('returns empty array when nothing stored', function () {
            expect(loadParameterHistory(SCRIPT)).toEqual([]);
        });

        it('returns empty array on corrupted storage', function () {
            localStorage.setItem(KEY, 'not-json');
            expect(loadParameterHistory(SCRIPT)).toEqual([]);
        });

        it('defaults missing favorite flag to false', function () {
            localStorage.setItem(KEY, JSON.stringify([{timestamp: 1, values: {a: 1}}]));
            expect(loadParameterHistory(SCRIPT)[0].favorite).toBe(false);
        });
    });

    describe('getMostRecentValues', function () {
        it('returns null when no history', function () {
            expect(getMostRecentValues(SCRIPT)).toBeNull();
        });

        it('returns the most recent values', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            saveParameterHistory(SCRIPT, {a: 2});
            expect(getMostRecentValues(SCRIPT)).toEqual({a: 2});
        });
    });

    describe('removeParameterHistoryEntry', function () {
        it('removes a valid entry', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            saveParameterHistory(SCRIPT, {a: 2});
            removeParameterHistoryEntry(SCRIPT, 0);
            expect(loadParameterHistory(SCRIPT).map(e => e.values)).toEqual([{a: 1}]);
        });

        it('ignores an out-of-range index', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            removeParameterHistoryEntry(SCRIPT, 5);
            expect(loadParameterHistory(SCRIPT).length).toBe(1);
        });

        it('does not remove a favorite entry', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            toggleFavoriteEntry(SCRIPT, 0);
            removeParameterHistoryEntry(SCRIPT, 0);
            expect(loadParameterHistory(SCRIPT).length).toBe(1);
        });
    });

    describe('toggleFavoriteEntry', function () {
        it('marks an entry as favorite', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            toggleFavoriteEntry(SCRIPT, 0);
            expect(loadParameterHistory(SCRIPT)[0].favorite).toBe(true);
        });

        it('toggles back to non-favorite', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            toggleFavoriteEntry(SCRIPT, 0);
            toggleFavoriteEntry(SCRIPT, 0);
            expect(loadParameterHistory(SCRIPT)[0].favorite).toBe(false);
        });

        it('ignores an out-of-range index', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            toggleFavoriteEntry(SCRIPT, 9);
            expect(loadParameterHistory(SCRIPT)[0].favorite).toBe(false);
        });

        it('moves favorites ahead of non-favorites', function () {
            saveParameterHistory(SCRIPT, {a: 1});
            saveParameterHistory(SCRIPT, {a: 2}); // index 0 now
            // make the older entry ({a:1}, index 1) a favorite
            toggleFavoriteEntry(SCRIPT, 1);
            const history = loadParameterHistory(SCRIPT);
            expect(history[0].values).toEqual({a: 1});
            expect(history[0].favorite).toBe(true);
        });

        it('keeps favorites even beyond the non-favorite cap', function () {
            saveParameterHistory(SCRIPT, {fav: true});
            toggleFavoriteEntry(SCRIPT, 0);
            for (let i = 0; i < 12; i++) {
                saveParameterHistory(SCRIPT, {n: i});
            }
            const history = loadParameterHistory(SCRIPT);
            const favorites = history.filter(e => e.favorite);
            expect(favorites.length).toBe(1);
            expect(favorites[0].values).toEqual({fav: true});
        });
    });

    describe('graceful error handling', function () {
        function stubThrowingStorage() {
            vi.stubGlobal('localStorage', {
                getItem: () => JSON.stringify([{timestamp: 1, values: {a: 1}, favorite: false}]),
                setItem: () => { throw new Error('quota exceeded'); },
                removeItem: () => {},
                clear: () => {},
            });
        }

        it('saveParameterHistory swallows storage errors', function () {
            stubThrowingStorage();
            expect(() => saveParameterHistory(SCRIPT, {b: 2})).not.toThrow();
        });

        it('removeParameterHistoryEntry swallows storage errors', function () {
            stubThrowingStorage();
            expect(() => removeParameterHistoryEntry(SCRIPT, 0)).not.toThrow();
        });

        it('toggleFavoriteEntry swallows storage errors', function () {
            stubThrowingStorage();
            expect(() => toggleFavoriteEntry(SCRIPT, 0)).not.toThrow();
        });

        it('shouldUseHistoricalValues returns false on storage error', function () {
            vi.stubGlobal('localStorage', {
                getItem: () => { throw new Error('blocked'); },
            });
            expect(shouldUseHistoricalValues(SCRIPT)).toBe(false);
        });
    });

    describe('shouldUseHistoricalValues', function () {
        it('is true when the flag is set to "true"', function () {
            localStorage.setItem('useHistoricalValues_' + SCRIPT, 'true');
            expect(shouldUseHistoricalValues(SCRIPT)).toBe(true);
        });

        it('is false when the flag is anything else', function () {
            localStorage.setItem('useHistoricalValues_' + SCRIPT, 'false');
            expect(shouldUseHistoricalValues(SCRIPT)).toBe(false);
        });

        it('is false when the flag is absent', function () {
            expect(shouldUseHistoricalValues(SCRIPT)).toBe(false);
        });
    });
});
