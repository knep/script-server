'use strict';
import ExecutionNotifier from '@/main-app/components/ExecutionNotifier';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {useExecutionsStore} from '@/main-app/stores/executions';
import {attachToDocument} from '../../test_utils';

function executor(id, scriptName, status) {
    return {state: {id, scriptName, status}};
}

describe('Test ExecutionNotifier', function () {
    let notifier;
    let executionsStore;
    let pinia;

    beforeEach(function () {
        pinia = createPinia();
        setActivePinia(pinia);
        executionsStore = useExecutionsStore();
        notifier = mount(ExecutionNotifier, {
            attachTo: attachToDocument(),
            global: {plugins: [pinia]}
        });
    });

    afterEach(function () {
        notifier.unmount();
    });

    it('notifies when a running execution finishes', function () {
        executionsStore.executors = {1: executor(1, 'myScript', 'executing')};
        notifier.vm.prevStatuses = {1: 'executing'};

        executionsStore.executors[1].state.status = 'finished';
        notifier.vm.checkTransitions();

        expect(notifier.vm.snackbar).toBe(true);
        expect(notifier.vm.snackbarText).toBe('myScript finished');
        expect(notifier.vm.snackbarColor).toBe('primary');
    });

    it('notifies a failure when a running execution errors', function () {
        executionsStore.executors = {1: executor(1, 'myScript', 'executing')};
        notifier.vm.prevStatuses = {1: 'executing'};

        executionsStore.executors[1].state.status = 'error';
        notifier.vm.checkTransitions();

        expect(notifier.vm.snackbar).toBe(true);
        expect(notifier.vm.snackbarText).toBe('myScript failed');
        expect(notifier.vm.snackbarColor).toBe('error');
    });

    it('does not notify for a status change that is not a completion', function () {
        executionsStore.executors = {1: executor(1, 'myScript', 'initializing')};
        notifier.vm.prevStatuses = {1: 'initializing'};

        executionsStore.executors[1].state.status = 'executing';
        notifier.vm.checkTransitions();

        expect(notifier.vm.snackbar).toBe(false);
    });

    it('does not re-notify when the status is unchanged', function () {
        executionsStore.executors = {1: executor(1, 'myScript', 'finished')};
        notifier.vm.prevStatuses = {1: 'finished'};

        notifier.vm.checkTransitions();

        expect(notifier.vm.snackbar).toBe(false);
    });
});
