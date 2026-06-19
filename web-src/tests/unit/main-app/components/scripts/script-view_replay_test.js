'use strict';

vi.mock('@/common/utils/parameterHistory', () => ({
    getMostRecentValues: vi.fn(),
    saveParameterHistory: vi.fn(),
    loadParameterHistory: vi.fn(() => []),
    shouldUseHistoricalValues: vi.fn(() => false),
    removeParameterHistoryEntry: vi.fn(),
    toggleFavoriteEntry: vi.fn()
}));

import ScriptView from '@/main-app/components/scripts/script-view';
import {getMostRecentValues} from '@/common/utils/parameterHistory';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {useScriptConfigStore} from '@/main-app/stores/scriptConfig';
import {useExecutionsStore} from '@/main-app/stores/executions';
import {useScriptsStore} from '@/main-app/stores/scripts';
import {useScriptSetupStore} from '@/main-app/stores/scriptSetup';
import {attachToDocument} from '../../../test_utils';

describe('Test ScriptView replay', function () {
    let pinia;

    beforeEach(function () {
        pinia = createPinia();
        setActivePinia(pinia);

        const scriptConfigStore = useScriptConfigStore();
        scriptConfigStore.scriptConfig = {name: 'abc', description: ''};
        scriptConfigStore.loading = false;

        useScriptsStore().selectedScript = 'abc';

        vi.spyOn(useExecutionsStore(), 'selectExecutor').mockImplementation((executor) => {
            useExecutionsStore().currentExecutor = executor;
        });

        getMostRecentValues.mockReset();
    });

    afterEach(function () {
        vi.restoreAllMocks();
    });

    function mountView() {
        return mount(ScriptView, {attachTo: attachToDocument(), global: {plugins: [pinia]}});
    }

    it('hides the Replay button when there is no history', async function () {
        getMostRecentValues.mockReturnValue(null);
        const view = mountView();
        await view.vm.$nextTick();

        expect(view.vm.hasLastExecution).toBe(false);
        expect(view.find('.button-replay').exists()).toBe(false);
        view.unmount();
    });

    it('shows the Replay button when history exists', async function () {
        getMostRecentValues.mockReturnValue({p1: '1'});
        const view = mountView();
        await view.vm.$nextTick();

        expect(view.vm.hasLastExecution).toBe(true);
        expect(view.find('.button-replay').exists()).toBe(true);
        view.unmount();
    });

    it('replays with the last execution values', async function () {
        getMostRecentValues.mockReturnValue({p1: '1', p2: 'x'});
        const reload = vi.spyOn(useScriptSetupStore(), 'reloadModel').mockImplementation(() => {});
        const start = vi.spyOn(useExecutionsStore(), 'startExecution').mockImplementation(() => {});

        const view = mountView();
        await view.vm.$nextTick();

        view.vm.replayLastExecution();

        expect(reload).toHaveBeenCalledWith(expect.objectContaining({
            values: {p1: '1', p2: 'x'},
            scriptName: 'abc'
        }));
        expect(start).toHaveBeenCalled();
        view.unmount();
    });

    it('does nothing when there is no history to replay', async function () {
        getMostRecentValues.mockReturnValue(null);
        const start = vi.spyOn(useExecutionsStore(), 'startExecution').mockImplementation(() => {});

        const view = mountView();
        await view.vm.$nextTick();

        view.vm.replayLastExecution();

        expect(start).not.toHaveBeenCalled();
        view.unmount();
    });
});
