'use strict';
import LogPanel from '@/common/components/log_panel';
import {mount} from '@vue/test-utils';
import {attachToDocument} from '../test_utils';

describe('Test LogPanel search', function () {
    let panel;

    beforeEach(function () {
        panel = mount(LogPanel, {
            attachTo: attachToDocument(),
            props: {outputFormat: 'text'}
        });
        panel.vm.appendLog('hello world\nhello again\ngoodbye');
    });

    afterEach(function () {
        panel.unmount();
    });

    it('search is collapsed by default', function () {
        expect(panel.find('.log-search-input').exists()).toBe(false);
        expect(panel.vm.searchActive).toBe(false);
    });

    it('opens the search bar', async function () {
        panel.vm.openSearch();
        await panel.vm.$nextTick();
        expect(panel.vm.searchActive).toBe(true);
        expect(panel.find('.log-search-input').exists()).toBe(true);
    });

    it('counts matches and labels the current one', async function () {
        panel.vm.openSearch();
        panel.vm.searchQuery = 'hello';
        await panel.vm.$nextTick();

        expect(panel.vm.matchCount).toBe(2);
        expect(panel.vm.currentMatch).toBe(0);
        expect(panel.vm.matchCountLabel).toBe('1/2');
    });

    it('reports 0/0 for a query with no matches', async function () {
        panel.vm.openSearch();
        panel.vm.searchQuery = 'nomatch';
        await panel.vm.$nextTick();

        expect(panel.vm.matchCount).toBe(0);
        expect(panel.vm.matchCountLabel).toBe('0/0');
    });

    it('cycles forward through matches and wraps', async function () {
        panel.vm.openSearch();
        panel.vm.searchQuery = 'hello';
        await panel.vm.$nextTick();

        panel.vm.nextMatch();
        expect(panel.vm.matchCountLabel).toBe('2/2');

        panel.vm.nextMatch();
        expect(panel.vm.matchCountLabel).toBe('1/2');
    });

    it('cycles backward with wrap', async function () {
        panel.vm.openSearch();
        panel.vm.searchQuery = 'hello';
        await panel.vm.$nextTick();

        panel.vm.prevMatch();
        expect(panel.vm.matchCountLabel).toBe('2/2');
    });

    it('closing search clears the query and state', async function () {
        panel.vm.openSearch();
        panel.vm.searchQuery = 'hello';
        await panel.vm.$nextTick();
        expect(panel.vm.matchCount).toBe(2);

        panel.vm.closeSearch();
        await panel.vm.$nextTick();

        expect(panel.vm.searchActive).toBe(false);
        expect(panel.vm.searchQuery).toBe('');
        expect(panel.vm.matchCount).toBe(0);
        expect(panel.find('.log-search-input').exists()).toBe(false);
    });
});
