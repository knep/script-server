'use strict';
import ScriptTabs from '@/main-app/components/scripts/ScriptTabs';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {useScriptsStore} from '@/main-app/stores/scripts';
import {useExecutionsStore} from '@/main-app/stores/executions';
import {useScriptTabsStore} from '@/main-app/stores/scriptTabs';
import {attachToDocument} from '../../../test_utils';
import router from '@/main-app/router/router';

describe('Test ScriptTabs', function () {
    let pinia;

    function mountWith(openTabs, selectedScript, statusFn) {
        pinia = createPinia();
        setActivePinia(pinia);

        useScriptTabsStore().openTabs = openTabs;
        useScriptsStore().selectedScript = selectedScript;
        vi.spyOn(useExecutionsStore(), 'getScriptStatus').mockImplementation(statusFn);

        return mount(ScriptTabs, {
            attachTo: attachToDocument(),
            global: {plugins: [pinia, router]}
        });
    }

    afterEach(function () {
        vi.restoreAllMocks();
    });

    it('renders one tab per open script', function () {
        const tabs = mountWith(['a', 'b'], 'a', () => null);
        expect(tabs.findAll('.script-tab')).toHaveLength(2);
        expect(tabs.text()).toContain('a');
        expect(tabs.text()).toContain('b');
        tabs.unmount();
    });

    it('is hidden when no tabs are open', function () {
        const tabs = mountWith([], null, () => null);
        expect(tabs.find('.script-tabs').exists()).toBe(false);
        tabs.unmount();
    });

    it('shows a spinner for a running script', function () {
        const tabs = mountWith(['a'], 'a', () => 'running');
        expect(tabs.find('.tab-status.v-progress-circular').exists()).toBe(true);
        tabs.unmount();
    });

    it('shows a check icon for a finished script', function () {
        const tabs = mountWith(['a'], 'a', () => 'finished');
        const icon = tabs.find('.tab-status.status-finished');
        expect(icon.exists()).toBe(true);
        expect(icon.text()).toBe('check_circle');
        tabs.unmount();
    });

    it('shows an error icon for a failed script', function () {
        const tabs = mountWith(['a'], 'a', () => 'error');
        const icon = tabs.find('.tab-status.status-error');
        expect(icon.exists()).toBe(true);
        expect(icon.text()).toBe('error');
        tabs.unmount();
    });

    it('shows no status icon for an idle script', function () {
        const tabs = mountWith(['a'], 'a', () => null);
        expect(tabs.find('.tab-status').exists()).toBe(false);
        tabs.unmount();
    });

    it('closing a tab removes it from the store', async function () {
        const tabs = mountWith(['a', 'b'], 'b', () => null);
        const store = useScriptTabsStore();

        // close the non-active tab "a" via its close icon
        const firstTab = tabs.findAll('.script-tab')[0];
        await firstTab.find('.tab-close').trigger('click');

        expect(store.openTabs).toEqual(['b']);
        tabs.unmount();
    });
});
