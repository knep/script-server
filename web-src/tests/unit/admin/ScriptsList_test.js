'use strict';

import ScriptsList from '@/admin/components/scripts-config/ScriptsList';
import adminRouter from '@/admin/router/router';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {useAdminScriptsStore} from '@/admin/stores/scripts';
import {attachToDocument, vueTicks} from '../test_utils';

describe('Test admin ScriptsList', function () {
    let pinia;
    let store;

    beforeEach(function () {
        pinia = createPinia();
        setActivePinia(pinia);

        store = useAdminScriptsStore();
        // init() fires an axios request; stub it so mount stays offline and
        // the list (not the loading spinner) is rendered.
        vi.spyOn(store, 'init').mockImplementation(() => {
            store.loading = false;
        });
        store.loading = false;
        store.scripts = [];
    });

    afterEach(function () {
        vi.restoreAllMocks();
    });

    function mountList() {
        return mount(ScriptsList, {
            global: {plugins: [pinia, adminRouter]},
            attachTo: attachToDocument()
        });
    }

    it('Add button targets the absolute new-script route (not a relative path)', async function () {
        const list = mountList();
        await vueTicks();

        const addButton = list.find('.add-script-btn');
        expect(addButton.exists()).toBe(true);
        // A bare "_new" would resolve against /scripts and hit the catch-all -> /logs
        expect(addButton.attributes('href')).toBe('#/scripts/_new');
        list.unmount();
    });

    it('script items use absolute, encoded paths', async function () {
        store.scripts = [{name: 'My Script', parsingFailed: false}];
        const list = mountList();
        await vueTicks();

        const link = list.findAll('.v-list-item').find(i => i.text().includes('My Script'));
        expect(link.attributes('href')).toBe('#/scripts/My%20Script');
        list.unmount();
    });
});
