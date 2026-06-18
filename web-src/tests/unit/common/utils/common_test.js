'use strict';

import {
    arraysEqual,
    asyncForEachKeyValue,
    clearArray,
    closestByClass,
    contains,
    deepCloneObject,
    destroyChildren,
    findNeighbour,
    forEachKeyValue,
    getElementsByTagNameRecursive,
    getFileInputValue,
    getQueryParameter,
    getUnparameterizedUrl,
    getWebsocketUrl,
    guid,
    hasClass,
    HttpRequestError,
    isBlankString,
    isEmptyArray,
    isEmptyObject,
    isEmptyString,
    isEmptyValue,
    isFullRegexMatch,
    isNull,
    isWebsocketClosed,
    isWebsocketConnecting,
    isWebsocketOpen,
    randomInt,
    readQueryParameters,
    removeElement,
    removeElementIf,
    removeElements,
    stringComparator,
    toBoolean,
    toDict,
    toMap,
    toQueryArgs,
    trimTextNodes,
    uuidv4,
} from '@/common/utils/common';

describe('Test common.js', function () {

    describe('test randomInt', function () {

        it('Test range of 5, starting with 0', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(0, 5));
            }

            expect(values).toEqual(new Set([0, 1, 2, 3, 4]));
        });

        it('Test range of 5, starting with positive', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(123, 128));
            }

            expect(values).toEqual(new Set([123, 124, 125, 126, 127]));
        });

        it('Test range of 5, starting with negative', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(-128, -123));
            }

            expect(values).toEqual(new Set([-128, -127, -126, -125, -124]));
        });

        it('Test range of 5, with 0 in the middle', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(-2, 3));
            }

            expect(values).toEqual(new Set([-2, -1, 0, 1, 2]));
        });

        it('Test range of 2', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(3, 5));
            }

            expect(values).toEqual(new Set([3, 4]));
        });

        it('Test range of 1', function () {
            let values = new Set();
            for (let i = 0; i < 100; i++) {
                values.add(randomInt(3, 4));
            }

            expect(values).toEqual(new Set([3]));
        });

        it('Test range of 0', function () {
            let values = new Set();
            for (let i = 0; i < 100; i++) {
                values.add(randomInt(3, 3));
            }

            expect(values).toEqual(new Set([3]));
        });

        it('Test range of reversed', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(6, 2));
            }

            expect(values).toEqual(new Set([6, 5, 4, 3]));
        });

        it('Test range of reversed when negative', function () {
            let values = new Set();
            for (let i = 0; i < 10000; i++) {
                values.add(randomInt(-13, -17));
            }

            expect(values).toEqual(new Set([-13, -14, -15, -16]));
        });
    });

    describe('test trimTextNodes', function () {

        it('Test trim single text node', function () {
            const div = document.createElement('div');
            div.innerHTML = '  \n hello  world !\t '
            trimTextNodes(div);

            expect(div.innerHTML).toBe('hello  world !')
        });

        it('Test trim multiple text nodes', function () {
            const div = document.createElement('div');
            div.innerHTML = '  \n hello  world !\t '
            div.appendChild(document.createTextNode(' another record '))
            div.appendChild(document.createTextNode('+ one more  '))
            trimTextNodes(div);

            expect(div.innerHTML).toBe('hello  world !another record+ one more')
        });

        it('Test trim multiple text nodes with spans', function () {
            const div = document.createElement('div');
            div.innerHTML = '  \n hello  world !\t '

            const child = document.createElement('span');
            child.innerHTML = ' another record ';
            div.appendChild(child)

            div.appendChild(document.createTextNode(' + one more  '))

            trimTextNodes(div);

            expect(div.innerHTML).toBe('hello  world !<span> another record </span>+ one more')
        });
    });

    describe('test isNull', function () {
        it('null is null', () => expect(isNull(null)).toBe(true));
        it('undefined is null', () => expect(isNull(undefined)).toBe(true));
        it('0 is not null', () => expect(isNull(0)).toBe(false));
        it('empty string is not null', () => expect(isNull('')).toBe(false));
        it('object is not null', () => expect(isNull({})).toBe(false));
    });

    describe('test emptiness checks', function () {
        it('isEmptyString', () => {
            expect(isEmptyString(null)).toBe(true);
            expect(isEmptyString('')).toBe(true);
            expect(isEmptyString(' ')).toBe(false);
            expect(isEmptyString('x')).toBe(false);
        });

        it('isBlankString', () => {
            expect(isBlankString(null)).toBe(true);
            expect(isBlankString('   ')).toBe(true);
            expect(isBlankString('x')).toBe(false);
        });

        it('isEmptyArray', () => {
            expect(isEmptyArray(null)).toBe(true);
            expect(isEmptyArray([])).toBe(true);
            expect(isEmptyArray([1])).toBe(false);
        });

        it('isEmptyObject', () => {
            expect(isEmptyObject(null)).toBe(true);
            expect(isEmptyObject({})).toBe(true);
            expect(isEmptyObject({a: 1})).toBe(false);
        });

        it('isEmptyValue', () => {
            expect(isEmptyValue(null)).toBe(true);
            expect(isEmptyValue('')).toBe(true);
            expect(isEmptyValue([])).toBe(true);
            expect(isEmptyValue({})).toBe(true);
            expect(isEmptyValue('x')).toBe(false);
            expect(isEmptyValue([1])).toBe(false);
            expect(isEmptyValue({a: 1})).toBe(false);
            expect(isEmptyValue(5)).toBe(false);
        });
    });

    describe('test array helpers', function () {
        it('contains', () => {
            expect(contains([1, 2, 3], 2)).toBe(true);
            expect(contains([1, 2, 3], 9)).toBe(false);
        });

        it('removeElement removes first match and returns array', () => {
            const arr = [1, 2, 3];
            expect(removeElement(arr, 2)).toBe(arr);
            expect(arr).toEqual([1, 3]);
        });

        it('removeElement on missing value is a noop', () => {
            const arr = [1, 2];
            removeElement(arr, 9);
            expect(arr).toEqual([1, 2]);
        });

        it('removeElementIf removes matching elements', () => {
            const arr = [1, 2, 3, 4];
            removeElementIf(arr, (x) => x > 2);
            expect(arr).toEqual([1, 2]);
        });

        it('removeElements', () => {
            const arr = [1, 2, 3, 4];
            removeElements(arr, [2, 4]);
            expect(arr).toEqual([1, 3]);
        });

        it('clearArray empties in place', () => {
            const arr = [1, 2, 3];
            clearArray(arr);
            expect(arr).toEqual([]);
        });

        it('arraysEqual', () => {
            const ref = [1, 2];
            expect(arraysEqual(ref, ref)).toBe(true);
            expect(arraysEqual(null, null)).toBe(true);
            expect(arraysEqual([1, 2], [1, 2])).toBe(true);
            expect(arraysEqual(null, [1])).toBe(false);
            expect(arraysEqual([1], null)).toBe(false);
            expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
            expect(arraysEqual([1, 2], [1, 9])).toBe(false);
        });
    });

    describe('test object/collection helpers', function () {
        it('toBoolean', () => {
            expect(toBoolean(true)).toBe(true);
            expect(toBoolean(false)).toBe(false);
            expect(toBoolean('true')).toBe(true);
            expect(toBoolean('TRUE')).toBe(true);
            expect(toBoolean('false')).toBe(false);
            expect(toBoolean(1)).toBe(true);
            expect(toBoolean(0)).toBe(false);
            expect(toBoolean(null)).toBe(false);
        });

        it('toDict keys by field', () => {
            const result = toDict([{id: 'a', n: 1}, {id: 'b', n: 2}], 'id');
            expect(result).toEqual({a: {id: 'a', n: 1}, b: {id: 'b', n: 2}});
        });

        it('toMap with key and value extractors', () => {
            const result = toMap([{k: 'x', v: 1}, {k: 'y', v: 2}], (e) => e.k, (e) => e.v);
            expect(result).toEqual({x: 1, y: 2});
        });

        it('deepCloneObject produces an independent copy', () => {
            const original = {a: 1, nested: {b: 2}};
            const clone = deepCloneObject(original);
            expect(clone).toEqual(original);
            clone.nested.b = 99;
            expect(original.nested.b).toBe(2);
        });

        it('forEachKeyValue visits own properties', () => {
            const collected = {};
            forEachKeyValue({a: 1, b: 2}, (key, value) => {
                collected[key] = value;
            });
            expect(collected).toEqual({a: 1, b: 2});
        });

        it('asyncForEachKeyValue awaits callback for each entry', async () => {
            const collected = [];
            await asyncForEachKeyValue({a: 1, b: 2}, async (key, value) => {
                collected.push([key, value]);
            });
            expect(collected).toEqual([['a', 1], ['b', 2]]);
        });
    });

    describe('test stringComparator', function () {
        it('sorts by field, case-insensitive', () => {
            const arr = [{name: 'banana'}, {name: 'Apple'}, {name: 'cherry'}];
            arr.sort(stringComparator('name'));
            expect(arr.map((e) => e.name)).toEqual(['Apple', 'banana', 'cherry']);
        });

        it('andThen falls back to a secondary comparator', () => {
            const arr = [
                {name: 'a', age: 2},
                {name: 'a', age: 1},
                {name: 'b', age: 5},
            ];
            const byAge = (x, y) => x.age - y.age;
            arr.sort(stringComparator('name').andThen(byAge));
            expect(arr.map((e) => e.age)).toEqual([1, 2, 5]);
        });
    });

    describe('test websocket state helpers', function () {
        it('isWebsocketConnecting', () => {
            expect(isWebsocketConnecting({readyState: 0})).toBe(true);
            expect(isWebsocketConnecting({readyState: 1})).toBe(false);
        });

        it('isWebsocketOpen', () => {
            expect(isWebsocketOpen({readyState: 1})).toBe(true);
            expect(isWebsocketOpen({readyState: 0})).toBe(false);
            expect(isWebsocketOpen(null)).toBe(false);
        });

        it('isWebsocketClosed', () => {
            expect(isWebsocketClosed({readyState: 2})).toBe(true);
            expect(isWebsocketClosed({readyState: 3})).toBe(true);
            expect(isWebsocketClosed({readyState: 1})).toBe(false);
        });
    });

    describe('test url helpers', function () {
        afterEach(() => {
            window.history.pushState({}, '', '/');
        });

        it('readQueryParameters parses the query string', () => {
            window.history.pushState({}, '', '/?foo=bar&hello=world');
            expect(readQueryParameters()).toEqual({foo: 'bar', hello: 'world'});
        });

        it('readQueryParameters returns empty object when no query', () => {
            window.history.pushState({}, '', '/');
            expect(readQueryParameters()).toEqual({});
        });

        it('getQueryParameter returns a single value', () => {
            window.history.pushState({}, '', '/?foo=bar');
            expect(getQueryParameter('foo')).toBe('bar');
        });

        it('getUnparameterizedUrl drops the query', () => {
            expect(getUnparameterizedUrl()).toBe('http://localhost:3000/');
        });

        it('getWebsocketUrl builds a ws url with relative path', () => {
            expect(getWebsocketUrl('events')).toBe('ws://localhost:3000/events');
        });

        it('getWebsocketUrl without path returns host url', () => {
            expect(getWebsocketUrl('')).toBe('ws://localhost:3000');
        });

        it('toQueryArgs serializes scalars and arrays', () => {
            expect(toQueryArgs({a: 1, b: [2, 3]})).toBe('a=1&b=2&b=3');
        });
    });

    describe('test id generators', function () {
        it('guid default has uuid-like length', () => {
            expect(guid().length).toBe(36);
        });

        it('guid truncates to requested length', () => {
            expect(guid(8).length).toBe(8);
        });

        it('guid pads to requested length', () => {
            expect(guid(50).length).toBe(50);
        });

        it('uuidv4 matches the v4 format', () => {
            expect(uuidv4()).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        });
    });

    describe('test isFullRegexMatch', function () {
        it('anchors a bare pattern', () => {
            expect(isFullRegexMatch('\\d+', '123')).toBe(true);
            expect(isFullRegexMatch('\\d+', '12a')).toBe(false);
        });

        it('respects existing anchors', () => {
            expect(isFullRegexMatch('^abc$', 'abc')).toBe(true);
            expect(isFullRegexMatch('^abc$', 'abcd')).toBe(false);
        });
    });

    describe('test DOM helpers', function () {
        it('hasClass', () => {
            const el = document.createElement('div');
            el.className = 'foo bar';
            expect(hasClass(el, 'foo')).toBe(true);
            expect(hasClass(el, 'baz')).toBe(false);
        });

        it('destroyChildren removes all children', () => {
            const el = document.createElement('div');
            el.appendChild(document.createElement('span'));
            el.appendChild(document.createElement('span'));
            destroyChildren(el);
            expect(el.childNodes.length).toBe(0);
        });

        it('findNeighbour finds sibling by tag', () => {
            const parent = document.createElement('div');
            const span = document.createElement('span');
            const input = document.createElement('input');
            parent.appendChild(span);
            parent.appendChild(input);
            expect(findNeighbour(input, 'span')).toBe(span);
            expect(findNeighbour(span, 'a')).toBeNull();
        });

        it('closestByClass walks up the tree', () => {
            const grandparent = document.createElement('div');
            grandparent.className = 'target';
            const parent = document.createElement('div');
            const child = document.createElement('span');
            grandparent.appendChild(parent);
            parent.appendChild(child);
            expect(closestByClass(child, 'target')).toBe(grandparent);
            expect(closestByClass(child, 'missing')).toBeNull();
        });

        it('getElementsByTagNameRecursive finds nested elements', () => {
            const root = document.createElement('div');
            root.innerHTML = '<section><span>1</span><div><span>2</span></div></section>';
            const spans = getElementsByTagNameRecursive(root, 'span');
            expect(spans.length).toBe(2);
        });

        it('getFileInputValue returns first file or null', () => {
            expect(getFileInputValue({files: null})).toBeNull();
            expect(getFileInputValue({files: []})).toBeNull();
            const file = {name: 'f.txt'};
            expect(getFileInputValue({files: [file]})).toBe(file);
        });
    });

    describe('test HttpRequestError', function () {
        it('carries code and message', () => {
            const error = new HttpRequestError(404, 'Not found');
            expect(error.code).toBe(404);
            expect(error.message).toBe('Not found');
            expect(error instanceof Error).toBe(true);
        });

        it('defaults code to -1', () => {
            const error = new HttpRequestError();
            expect(error.code).toBe(-1);
        });
    });
});