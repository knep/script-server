'use strict';
import AppLayout from '@/common/components/AppLayout';
import {mount} from '@vue/test-utils';
import {attachToDocument} from '../test_utils';

function inMemoryLocalStorage(initial) {
    const data = Object.assign({}, initial);
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

const KEY = 'script_server_sidebar_width';

describe('Test AppLayout resizable sidebar', function () {
    let layout;

    function mountLayout() {
        return mount(AppLayout, {attachTo: attachToDocument()});
    }

    afterEach(function () {
        if (layout) {
            layout.unmount();
            layout = null;
        }
        vi.unstubAllGlobals();
    });

    it('defaults to 300px when nothing is stored', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage());
        layout = mountLayout();
        expect(layout.vm.sidebarWidth).toBe(300);
    });

    it('restores a stored width', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage({[KEY]: '450'}));
        layout = mountLayout();
        expect(layout.vm.sidebarWidth).toBe(450);
    });

    it('clamps a too-small stored width up to the minimum', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage({[KEY]: '50'}));
        layout = mountLayout();
        expect(layout.vm.sidebarWidth).toBe(220);
    });

    it('clamps a too-large stored width down to the maximum', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage({[KEY]: '9999'}));
        layout = mountLayout();
        expect(layout.vm.sidebarWidth).toBe(600);
    });

    it('applies the width to the sidebar element', async function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage({[KEY]: '420'}));
        layout = mountLayout();
        await layout.vm.$nextTick();
        expect(layout.find('.app-sidebar').attributes('style')).toContain('width: 420px');
    });

    it('resizing clamps to bounds and updates the width', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage());
        layout = mountLayout();

        layout.vm._doResize({clientX: 380});
        expect(layout.vm.sidebarWidth).toBe(380);

        layout.vm._doResize({clientX: 10});
        expect(layout.vm.sidebarWidth).toBe(220);

        layout.vm._doResize({clientX: 5000});
        expect(layout.vm.sidebarWidth).toBe(600);
    });

    it('persists the width when a resize ends', function () {
        const ls = inMemoryLocalStorage();
        vi.stubGlobal('localStorage', ls);
        layout = mountLayout();

        layout.vm._doResize({clientX: 333});
        layout.vm._stopResize();

        expect(ls._data[KEY]).toBe('333');
    });

    it('double-click resets to 300px and persists', function () {
        const ls = inMemoryLocalStorage({[KEY]: '500'});
        vi.stubGlobal('localStorage', ls);
        layout = mountLayout();
        expect(layout.vm.sidebarWidth).toBe(500);

        layout.vm.resetSidebarWidth();

        expect(layout.vm.sidebarWidth).toBe(300);
        expect(ls._data[KEY]).toBe('300');
    });

    it('renders a resizer handle', function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage());
        layout = mountLayout();
        expect(layout.find('.sidebar-resizer').exists()).toBe(true);
    });

    it('does not apply the custom width in narrow (overlay) view', async function () {
        vi.stubGlobal('localStorage', inMemoryLocalStorage({[KEY]: '600'}));
        layout = mountLayout();

        // Desktop: width applied inline.
        expect(layout.vm.sidebarStyle).toEqual({width: '600px'});

        // Narrow/overlay: width is left to CSS so it can't overflow the screen.
        layout.vm.narrowView = true;
        await layout.vm.$nextTick();
        expect(layout.vm.sidebarStyle).toEqual({});
        expect(layout.find('.app-sidebar').attributes('style') || '').not.toContain('width: 600px');
    });
});
