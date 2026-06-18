'use strict';

import SchedulePanel from '@/main-app/components/schedule/SchedulePanel';
import {shallowMount} from '@vue/test-utils';
import {createPinia, setActivePinia} from 'pinia';
import {useScriptScheduleStore} from '@/main-app/stores/scriptSchedule';
import {vi} from 'vitest';
import {vueTicks} from '../../../test_utils';

describe('Test SchedulePanel', function () {
    let pinia;
    let panel;

    beforeEach(function () {
        pinia = createPinia();
        setActivePinia(pinia);

        panel = shallowMount(SchedulePanel, {
            global: {plugins: [pinia]}
        });
    });

    afterEach(function () {
        panel.unmount();
    });

    describe('scheduleType computed', function () {
        it('defaults to one-time', function () {
            expect(panel.vm.scheduleType).toBe('one-time');
        });

        it('switching to repeat clears oneTimeSchedule', async function () {
            panel.vm.scheduleType = 'repeat';
            expect(panel.vm.oneTimeSchedule).toBe(false);
            expect(panel.vm.scheduleType).toBe('repeat');
        });

        it('switching back to one-time sets oneTimeSchedule', function () {
            panel.vm.scheduleType = 'repeat';
            panel.vm.scheduleType = 'one-time';
            expect(panel.vm.oneTimeSchedule).toBe(true);
        });
    });

    describe('weekdaysError computed', function () {
        it('is null for one-time schedule', function () {
            expect(panel.vm.weekdaysError).toBeNull();
        });

        it('is null when repeating by days', async function () {
            await panel.setData({oneTimeSchedule: false, repeatTimeUnit: 'days'});
            expect(panel.vm.weekdaysError).toBeNull();
        });

        it('is required when repeating by weeks with no active day', async function () {
            const weekDays = panel.vm.weekDays.map(d => ({...d, active: false}));
            await panel.setData({oneTimeSchedule: false, repeatTimeUnit: 'weeks', weekDays});
            expect(panel.vm.weekdaysError).toBe('required');
        });

        it('is null when repeating by weeks with an active day', async function () {
            const weekDays = panel.vm.weekDays.map((d, i) => ({...d, active: i === 0}));
            await panel.setData({oneTimeSchedule: false, repeatTimeUnit: 'weeks', weekDays});
            expect(panel.vm.weekdaysError).toBeNull();
        });
    });

    describe('buildScheduleSetup', function () {
        it('builds a one-time setup', async function () {
            await panel.setData({
                oneTimeSchedule: true,
                startDate: new Date(2026, 5, 18),
                startTime: '14:30',
            });

            const setup = panel.vm.buildScheduleSetup();

            expect(setup.repeatable).toBe(false);
            expect(setup.endOption).toBe('never');
            expect(setup.endArg).toBeNull();
            expect(setup.startDatetime.getHours()).toBe(14);
            expect(setup.startDatetime.getMinutes()).toBe(30);
        });

        it('maps maxExecuteCount to max_executions', async function () {
            await panel.setData({
                oneTimeSchedule: false,
                endOption: 'maxExecuteCount',
                maxExecuteCount: 7,
            });

            const setup = panel.vm.buildScheduleSetup();

            expect(setup.repeatable).toBe(true);
            expect(setup.endOption).toBe('max_executions');
            expect(setup.endArg).toBe(7);
        });

        it('maps endDatetime to end_datetime with a Date arg', async function () {
            await panel.setData({
                oneTimeSchedule: false,
                endOption: 'endDatetime',
                endDate: new Date(2026, 5, 20),
                endTime: '09:15',
            });

            const setup = panel.vm.buildScheduleSetup();

            expect(setup.endOption).toBe('end_datetime');
            expect(setup.endArg).toBeInstanceOf(Date);
            expect(setup.endArg.getHours()).toBe(9);
            expect(setup.endArg.getMinutes()).toBe(15);
        });

        it('includes only active weekdays as names', async function () {
            const weekDays = panel.vm.weekDays.map(d => ({...d, active: false}));
            weekDays[0].active = true; // Monday
            weekDays[2].active = true; // Wednesday
            await panel.setData({oneTimeSchedule: false, repeatTimeUnit: 'weeks', weekDays});

            const setup = panel.vm.buildScheduleSetup();

            expect(setup.weekDays).toEqual(['Monday', 'Wednesday']);
        });

        it('carries repeat unit and period', async function () {
            await panel.setData({
                oneTimeSchedule: false,
                repeatTimeUnit: 'hours',
                repeatPeriod: 3,
            });

            const setup = panel.vm.buildScheduleSetup();

            expect(setup.repeatUnit).toBe('hours');
            expect(setup.repeatPeriod).toBe(3);
        });
    });

    describe('error tracking', function () {
        it('records a field error and exposes it in errors', function () {
            panel.vm.onFieldError('startTime', 'invalid time');
            expect(panel.vm.errors).toContain('invalid time');
        });

        it('clears errors when the field becomes valid', function () {
            panel.vm.onFieldError('startTime', 'invalid time');
            panel.vm.onFieldError('startTime', '');
            expect(panel.vm.errors).toEqual([]);
        });

        it('ignores repeat-only field errors in one-time mode', function () {
            panel.vm.onFieldError('repeatPeriod', 'bad');
            expect(panel.vm.errors).toEqual([]);
        });

        it('tracks repeat-only field errors in repeat mode', async function () {
            await panel.setData({oneTimeSchedule: false});
            panel.vm.onFieldError('repeatPeriod', 'bad');
            expect(panel.vm.errors).toContain('bad');
        });

        it('tracks maxExecuteCount error only with maxExecuteCount end option', async function () {
            await panel.setData({oneTimeSchedule: false, endOption: 'maxExecuteCount'});
            panel.vm.onFieldError('maxExecuteCount', 'bad count');
            expect(panel.vm.errors).toContain('bad count');
        });
    });

    describe('actions', function () {
        it('close emits close', function () {
            panel.vm.close();
            expect(panel.emitted('close')).toBeTruthy();
        });

        it('runScheduleAction schedules, emits scheduled with id and closes', async function () {
            const store = useScriptScheduleStore();
            const scheduleSpy = vi.spyOn(store, 'schedule')
                .mockResolvedValue({data: {id: 42}});

            await panel.vm.runScheduleAction();
            await vueTicks();

            expect(scheduleSpy).toHaveBeenCalledOnce();
            const passedSetup = scheduleSpy.mock.calls[0][0].scheduleSetup;
            expect(passedSetup).toBeDefined();
            expect(panel.emitted('scheduled')[0]).toEqual([42]);
            expect(panel.emitted('close')).toBeTruthy();
        });
    });
});
