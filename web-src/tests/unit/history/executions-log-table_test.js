'use strict';
import ExecutionsLogTable from '@/common/components/history/executions-log-table';
import {useHistoryStore} from '@/common/stores/history';
import {mount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {attachToDocument, vueTicks} from '../test_utils';

const rows = [
    {id: '2', startTimeString: 'b', user: 'zed', script: 'alpha', fullStatus: 'finished (0)'},
    {id: '1', startTimeString: 'a', user: 'amy', script: 'beta', fullStatus: 'finished (1)'}
];

describe('Test executions log table', function () {
    let table;
    let store;
    let pinia;

    function mountTable(tableRows = rows) {
        table = mount(ExecutionsLogTable, {
            attachTo: attachToDocument(),
            props: {rows: tableRows, rowClick: vi.fn()},
            global: {plugins: [pinia]}
        });
    }

    beforeEach(function () {
        vi.useFakeTimers();
        pinia = createPinia();
        setActivePinia(pinia);
        store = useHistoryStore();
        store.setSearch = vi.fn();
        store.setSort = vi.fn();
    });

    afterEach(function () {
        table.unmount();
        vi.useRealTimers();
    });

    function renderedIds() {
        return table.findAll('tbody tr').map(row => row.find('td').text());
    }

    it('renders rows in server order without client-side sorting', async function () {
        mountTable();
        await vueTicks();

        expect(renderedIds()).toEqual(['2', '1']);
    });

    it('does not filter rows on the client', async function () {
        mountTable();
        await table.find('.search-field').setValue('amy');

        expect(renderedIds()).toEqual(['2', '1']);
    });

    it('debounces search to the store', async function () {
        mountTable();
        await table.find('.search-field').setValue('a');
        await table.find('.search-field').setValue('am');

        vi.advanceTimersByTime(299);
        expect(store.setSearch).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(store.setSearch).toHaveBeenCalledTimes(1);
        expect(store.setSearch).toHaveBeenCalledWith('am');
    });

    it('restores search text from the store', async function () {
        store.searchText = 'abc';
        mountTable();
        await vueTicks();

        expect(table.find('.search-field').element.value).toBe('abc');
        vi.runAllTimers();
        expect(store.setSearch).not.toHaveBeenCalled();
    });

    it('sorting a new column asks the store for ascending order', async function () {
        mountTable();
        await table.find('th.user-column').trigger('click');

        expect(store.setSort).toHaveBeenCalledWith('user', 'asc');
    });

    it('sorting the current ascending column switches to descending', async function () {
        store.sortColumn = 'script';
        store.order = 'asc';
        mountTable();
        await table.find('th.script-column').trigger('click');

        expect(store.setSort).toHaveBeenCalledWith('script', 'desc');
    });

    it('start time is sorted by the raw start time', async function () {
        store.sortColumn = 'startTime';
        store.order = 'desc';
        mountTable();
        await vueTicks();

        expect(table.find('th.start_time-column').classes()).toContain('desc');
        await table.find('th.start_time-column').trigger('click');

        expect(store.setSort).toHaveBeenCalledWith('startTime', 'asc');
    });

    it('status column is not sortable', async function () {
        mountTable();
        await table.find('th.status-column').trigger('click');

        expect(store.setSort).not.toHaveBeenCalled();
    });

    it('shows empty text when there are no rows', async function () {
        mountTable([]);
        await vueTicks();

        expect(table.find('.empty-text').exists()).toBeTrue();
        expect(table.find('.loading-text').exists()).toBeFalse();
    });

    it('keeps rows visible while reloading', async function () {
        store.loading = true;
        mountTable();
        await vueTicks();

        expect(renderedIds()).toEqual(['2', '1']);
        expect(table.find('tbody').classes()).toContain('reloading');
    });
});
