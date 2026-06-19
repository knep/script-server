import {createPinia, setActivePinia} from 'pinia';
import {useExecutionsStore} from '@/main-app/stores/executions';
import {
    STATUS_DISCONNECTED,
    STATUS_ERROR,
    STATUS_EXECUTING,
    STATUS_FINISHED,
    STATUS_INITIALIZING
} from '@/main-app/stores/scriptExecutor';

function executor(id, scriptName, status) {
    return {state: {id, scriptName, status}};
}

describe('Test executions getScriptStatus', function () {
    let store;

    beforeEach(function () {
        setActivePinia(createPinia());
        store = useExecutionsStore();
    });

    it('returns null when the script has no executors', function () {
        store.executors = {1: executor(1, 'other', STATUS_FINISHED)};
        expect(store.getScriptStatus('myScript')).toBeNull();
    });

    it('returns running while executing', function () {
        store.executors = {1: executor(1, 'myScript', STATUS_EXECUTING)};
        expect(store.getScriptStatus('myScript')).toBe('running');
    });

    it('returns running while initializing', function () {
        store.executors = {1: executor(1, 'myScript', STATUS_INITIALIZING)};
        expect(store.getScriptStatus('myScript')).toBe('running');
    });

    it('returns finished when the only execution finished', function () {
        store.executors = {1: executor(1, 'myScript', STATUS_FINISHED)};
        expect(store.getScriptStatus('myScript')).toBe('finished');
    });

    it('returns error on error or disconnected', function () {
        store.executors = {1: executor(1, 'myScript', STATUS_ERROR)};
        expect(store.getScriptStatus('myScript')).toBe('error');

        store.executors = {1: executor(1, 'myScript', STATUS_DISCONNECTED)};
        expect(store.getScriptStatus('myScript')).toBe('error');
    });

    it('prioritises running over error and finished', function () {
        store.executors = {
            1: executor(1, 'myScript', STATUS_FINISHED),
            2: executor(2, 'myScript', STATUS_ERROR),
            3: executor(3, 'myScript', STATUS_EXECUTING)
        };
        expect(store.getScriptStatus('myScript')).toBe('running');
    });

    it('prioritises error over finished', function () {
        store.executors = {
            1: executor(1, 'myScript', STATUS_FINISHED),
            2: executor(2, 'myScript', STATUS_ERROR)
        };
        expect(store.getScriptStatus('myScript')).toBe('error');
    });

    it('only considers executors of the requested script', function () {
        store.executors = {
            1: executor(1, 'other', STATUS_EXECUTING),
            2: executor(2, 'myScript', STATUS_FINISHED)
        };
        expect(store.getScriptStatus('myScript')).toBe('finished');
    });
});
