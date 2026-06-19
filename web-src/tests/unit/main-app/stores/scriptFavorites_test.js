import {createPinia, setActivePinia} from 'pinia';
import {useScriptFavoritesStore} from '@/main-app/stores/scriptFavorites';

function inMemoryLocalStorage() {
    const data = {};
    return {
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => {
            data[k] = String(v);
        },
        removeItem: (k) => {
            delete data[k];
        }
    };
}

describe('Test scriptFavorites store', function () {
    let store;

    beforeEach(function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage());
        setActivePinia(createPinia());
        store = useScriptFavoritesStore();
    });

    afterEach(function () {
        vi.unstubAllGlobals();
    });

    it('starts empty', function () {
        expect(store.favorites).toEqual([]);
        expect(store.isFavorite('a')).toBe(false);
    });

    it('toggles a script on', function () {
        store.toggle('a');
        expect(store.favorites).toEqual(['a']);
        expect(store.isFavorite('a')).toBe(true);
    });

    it('toggles a script off', function () {
        store.toggle('a');
        store.toggle('a');
        expect(store.favorites).toEqual([]);
        expect(store.isFavorite('a')).toBe(false);
    });

    it('keeps multiple favorites in insertion order', function () {
        store.toggle('a');
        store.toggle('b');
        store.toggle('c');
        expect(store.favorites).toEqual(['a', 'b', 'c']);
    });

    it('ignores a null script name', function () {
        store.toggle(null);
        expect(store.favorites).toEqual([]);
    });

    it('persists to localStorage', function () {
        store.toggle('a');
        store.toggle('b');
        expect(JSON.parse(localStorage.getItem('script_server_favorites'))).toEqual(['a', 'b']);
    });

    it('restores persisted favorites on init', function () {
        localStorage.setItem('script_server_favorites', JSON.stringify(['x', 'y']));
        setActivePinia(createPinia());
        const restored = useScriptFavoritesStore();
        expect(restored.favorites).toEqual(['x', 'y']);
    });

    it('falls back to empty when storage is malformed', function () {
        localStorage.setItem('script_server_favorites', 'not json');
        setActivePinia(createPinia());
        const restored = useScriptFavoritesStore();
        expect(restored.favorites).toEqual([]);
    });
});
