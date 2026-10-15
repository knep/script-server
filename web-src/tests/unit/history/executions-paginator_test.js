'use strict';
import ExecutionsPaginator from '@/common/components/history/executions-paginator';
import {useHistoryStore} from '@/common/stores/history';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {attachToDocument, vueTicks} from '../test_utils';

function executions(count) {
    return Array.from({length: count}, (_, i) => ({id: String(i + 1)}));
}

describe('Test executions paginator', function () {
    let paginator;
    let store;

    beforeEach(async function () {
        const pinia = createPinia();
        setActivePinia(pinia);
        store = useHistoryStore();
        store.nextPage = vi.fn();
        store.prevPage = vi.fn();
        store.setPageSize = vi.fn();

        paginator = mount(ExecutionsPaginator, {
            attachTo: attachToDocument(),
            global: {plugins: [pinia]}
        });
        await vueTicks();
    });

    afterEach(function () {
        paginator.unmount();
    });

    function rangeLabel() {
        return paginator.find('.range-label').text();
    }

    function prevButton() {
        return paginator.find('.prev-button');
    }

    function nextButton() {
        return paginator.find('.next-button');
    }

    it('shows empty range', function () {
        expect(rangeLabel()).toBe('0 of 0');
    });

    it('shows range of the first page', async function () {
        store.executions = executions(25);
        store.total = 60;
        await vueTicks();

        expect(rangeLabel()).toBe('1-25 of 60');
    });

    it('shows range of a later page', async function () {
        store.executions = executions(10);
        store.total = 60;
        store.cursorStack = [null, 'c1'];
        await vueTicks();

        expect(rangeLabel()).toBe('51-60 of 60');
    });

    it('disables both buttons on a single page', function () {
        expect(prevButton().attributes('disabled')).toBeDefined();
        expect(nextButton().attributes('disabled')).toBeDefined();
    });

    it('enables next when there is a cursor', async function () {
        store.nextCursor = 'c1';
        await vueTicks();

        expect(nextButton().attributes('disabled')).toBeUndefined();
        await nextButton().trigger('click');

        expect(store.nextPage).toHaveBeenCalled();
    });

    it('enables previous after paging forward', async function () {
        store.cursorStack = [null];
        await vueTicks();

        expect(prevButton().attributes('disabled')).toBeUndefined();
        await prevButton().trigger('click');

        expect(store.prevPage).toHaveBeenCalled();
    });

    it('disables buttons while loading', async function () {
        store.nextCursor = 'c1';
        store.cursorStack = [null];
        store.loading = true;
        await vueTicks();

        expect(prevButton().attributes('disabled')).toBeDefined();
        expect(nextButton().attributes('disabled')).toBeDefined();
    });

    it('changes page size', async function () {
        await paginator.find('select').setValue('100');

        expect(store.setPageSize).toHaveBeenCalledWith(100);
    });
});
