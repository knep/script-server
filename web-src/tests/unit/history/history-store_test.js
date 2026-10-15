'use strict';
import {DEFAULT_PAGE_SIZE, useHistoryStore} from '@/common/stores/history';
import {axiosInstance} from '@/common/utils/axios_utils';
import MockAdapter from 'axios-mock-adapter';
import {createPinia, setActivePinia} from 'pinia';

const SHORT_URL = 'history/execution_log/short';

function record(id, overrides = {}) {
    return {
        id: String(id),
        startTime: '2026-08-01T10:00:00.000Z',
        user: 'user' + id,
        script: 'script' + id,
        status: 'finished',
        exitCode: 0,
        ...overrides
    };
}

function page(ids, total, nextCursor = null) {
    return {records: ids.map(id => record(id)), total, nextCursor};
}

describe('Test history store', function () {
    let store;
    let axiosMock;
    let requests;
    let responses;

    beforeEach(function () {
        setActivePinia(createPinia());
        store = useHistoryStore();

        axiosMock = new MockAdapter(axiosInstance);
        requests = [];
        // queue of responses per request; the last one is reused when the queue is exhausted
        responses = [page([], 0)];
        axiosMock.onGet(SHORT_URL).reply(config => {
            requests.push(config.params);
            const response = responses.length > 1 ? responses.shift() : responses[0];
            return [200, response];
        });
    });

    afterEach(function () {
        axiosMock.restore();
    });

    describe('first page', function () {
        it('requests the first page with default params', async function () {
            await store.init();

            expect(requests).toEqual([{limit: DEFAULT_PAGE_SIZE, sort: 'startTime', order: 'desc'}]);
        });

        it('stores records, total and cursor', async function () {
            responses = [page([3, 2], 5, 'cursor-1')];

            await store.init();

            expect(store.executions.map(e => e.id)).toEqual(['3', '2']);
            expect(store.total).toBe(5);
            expect(store.nextCursor).toBe('cursor-1');
            expect(store.hasNext).toBeTrue();
            expect(store.hasPrev).toBeFalse();
            expect(store.loading).toBeFalse();
        });

        it('translates records', async function () {
            responses = [page([1], 1)];

            await store.init();

            expect(store.executions[0].fullStatus).toBe('finished (0)');
            expect(store.executions[0].startTimeString).not.toBeEmpty();
        });

        it('handles response without records', async function () {
            responses = [{}];

            await store.init();

            expect(store.executions).toEqual([]);
            expect(store.total).toBe(0);
            expect(store.hasNext).toBeFalse();
        });

        it('resets selected execution', async function () {
            store.selectedExecution = record(1);
            store.selectedExecutionId = '1';

            await store.init();

            expect(store.selectedExecution).toBeNull();
            expect(store.selectedExecutionId).toBeNull();
        });
    });

    describe('paging', function () {
        it('next page sends the cursor', async function () {
            responses = [page([5, 4], 5, 'c1'), page([3, 2], 5, 'c2')];
            await store.init();

            await store.nextPage();

            expect(requests[1].after).toBe('c1');
            expect(store.executions.map(e => e.id)).toEqual(['3', '2']);
            expect(store.cursorStack).toEqual([null]);
            expect(store.hasPrev).toBeTrue();
            expect(store.hasNext).toBeTrue();
        });

        it('previous page goes back through visited cursors', async function () {
            responses = [page([5, 4], 5, 'c1'), page([3, 2], 5, 'c2'), page([1], 5, null),
                page([3, 2], 5, 'c2'), page([5, 4], 5, 'c1')];
            await store.init();
            await store.nextPage();
            await store.nextPage();
            expect(store.hasNext).toBeFalse();

            await store.prevPage();
            expect(requests[3].after).toBe('c1');
            expect(store.cursorStack).toEqual([null]);

            await store.prevPage();
            expect(requests[4].after).toBeUndefined();
            expect(store.cursorStack).toEqual([]);
            expect(store.hasPrev).toBeFalse();
        });

        it('next page does nothing without a cursor', async function () {
            await store.init();

            await store.nextPage();

            expect(requests).toHaveLength(1);
        });

        it('previous page does nothing on the first page', async function () {
            await store.init();

            await store.prevPage();

            expect(requests).toHaveLength(1);
        });
    });

    describe('search, sort and page size', function () {
        beforeEach(async function () {
            responses = [page([5, 4], 5, 'c1'), page([3, 2], 5, 'c2')];
            await store.init();
            await store.nextPage();
            responses = [page([1], 1)];
        });

        it('search restarts from the first page', async function () {
            await store.setSearch('  abc ');

            const lastRequest = requests[requests.length - 1];
            expect(lastRequest.search).toBe('abc');
            expect(lastRequest.after).toBeUndefined();
            expect(store.cursorStack).toEqual([]);
        });

        it('blank search is not sent', async function () {
            await store.setSearch('   ');

            expect(requests[requests.length - 1].search).toBeUndefined();
        });

        it('null search is stored as empty', async function () {
            await store.setSearch(null);

            expect(store.searchText).toBe('');
        });

        it('sort restarts from the first page', async function () {
            await store.setSort('user', 'asc');

            const lastRequest = requests[requests.length - 1];
            expect(lastRequest).toEqual({limit: DEFAULT_PAGE_SIZE, sort: 'user', order: 'asc'});
            expect(store.hasPrev).toBeFalse();
        });

        it('page size restarts from the first page', async function () {
            await store.setPageSize(100);

            const lastRequest = requests[requests.length - 1];
            expect(lastRequest.limit).toBe(100);
            expect(lastRequest.after).toBeUndefined();
        });

        it('search is kept while paging', async function () {
            responses = [page([1], 3, 'c1'), page([2], 3, null)];
            await store.setSearch('abc');

            await store.nextPage();

            expect(requests[requests.length - 1]).toEqual(
                {limit: DEFAULT_PAGE_SIZE, sort: 'startTime', order: 'desc', search: 'abc', after: 'c1'});
        });
    });

    describe('outdated responses', function () {
        it('late response of an older request is dropped', async function () {
            const resolvers = [];
            axiosMock.reset();
            axiosMock.onGet(SHORT_URL).reply(() => new Promise(resolve => resolvers.push(resolve)));

            const first = store.setSearch('a');
            const second = store.setSearch('ab');
            await vi.waitFor(() => expect(resolvers).toHaveLength(2));

            resolvers[1]([200, page([2], 1)]);
            await second;
            resolvers[0]([200, page([1], 1)]);
            await first;

            expect(store.executions.map(e => e.id)).toEqual(['2']);
            expect(store.loading).toBeFalse();
        });

        it('failed request stops loading', async function () {
            axiosMock.reset();
            axiosMock.onGet(SHORT_URL).reply(500);
            vi.spyOn(console, 'error').mockImplementation(() => {});

            await store.init();

            expect(store.loading).toBeFalse();
        });
    });
});
