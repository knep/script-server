import {createPinia, setActivePinia} from 'pinia';
import {useScriptTabsStore} from '@/main-app/stores/scriptTabs';

function inMemoryLocalStorage() {
    const data = {};
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => {
            data[k] = String(v);
        },
        removeItem: (k) => {
            delete data[k];
        },
        _data: data
    };
}

describe('Test scriptTabs store', function () {
    let store;

    beforeEach(function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage());
        setActivePinia(createPinia());
        store = useScriptTabsStore();
    });

    afterEach(function () {
        vi.unstubAllGlobals();
    });

    describe('openTab', function () {
        it('adds a tab', function () {
            store.openTab('scriptA');
            expect(store.openTabs).toEqual(['scriptA']);
        });

        it('does not duplicate an already-open tab', function () {
            store.openTab('scriptA');
            store.openTab('scriptA');
            expect(store.openTabs).toEqual(['scriptA']);
        });

        it('ignores null', function () {
            store.openTab(null);
            expect(store.openTabs).toEqual([]);
        });

        it('persists to localStorage', function () {
            store.openTab('scriptA');
            store.openTab('scriptB');
            expect(JSON.parse(localStorage.getItem('script_server_open_tabs')))
                .toEqual(['scriptA', 'scriptB']);
        });
    });

    describe('closeTab', function () {
        beforeEach(function () {
            store.openTab('a');
            store.openTab('b');
            store.openTab('c');
        });

        it('removes the tab', function () {
            store.closeTab('b');
            expect(store.openTabs).toEqual(['a', 'c']);
        });

        it('returns the neighbour at the same index', function () {
            expect(store.closeTab('b')).toBe('c');
        });

        it('returns the previous tab when closing the last one', function () {
            expect(store.closeTab('c')).toBe('b');
        });

        it('returns null when no tabs remain', function () {
            store.closeTab('a');
            store.closeTab('b');
            expect(store.closeTab('c')).toBeNull();
        });

        it('returns null for an unknown tab', function () {
            expect(store.closeTab('unknown')).toBeNull();
        });

        it('drops saved values for the closed tab', function () {
            store.saveValues('b', {x: 1});
            store.closeTab('b');
            expect(store.consumeValues('b')).toBeNull();
        });
    });

    describe('saveValues / consumeValues', function () {
        it('stores a clone, not the live reference', function () {
            const values = {x: 1};
            store.saveValues('a', values);
            values.x = 2;
            expect(store.consumeValues('a')).toEqual({x: 1});
        });

        it('returns null when nothing is saved', function () {
            expect(store.consumeValues('a')).toBeNull();
        });

        it('consumes the values (one-shot)', function () {
            store.saveValues('a', {x: 1});
            expect(store.consumeValues('a')).toEqual({x: 1});
            expect(store.consumeValues('a')).toBeNull();
        });

        it('ignores a null script name', function () {
            store.saveValues(null, {x: 1});
            expect(store.consumeValues(null)).toBeNull();
        });
    });

    describe('restore from localStorage', function () {
        it('loads previously persisted tabs on init', function () {
            localStorage.setItem('script_server_open_tabs', JSON.stringify(['x', 'y']));
            setActivePinia(createPinia());
            const restored = useScriptTabsStore();
            expect(restored.openTabs).toEqual(['x', 'y']);
        });

        it('falls back to empty when storage is malformed', function () {
            localStorage.setItem('script_server_open_tabs', 'not json');
            setActivePinia(createPinia());
            const restored = useScriptTabsStore();
            expect(restored.openTabs).toEqual([]);
        });
    });
});
