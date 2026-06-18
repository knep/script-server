'use strict';

import {
    defaultFavicon,
    setDefaultFavicon,
    setExecutingFavicon,
    setFinishedFavicon,
} from '@/main-app/components/favicon_manager';

function iconLinks() {
    const head = document.getElementsByTagName('head')[0];
    return Array.from(head.childNodes).filter(
        node => node.tagName === 'LINK' && node.type === 'image/x-icon');
}

describe('Test favicon_manager', function () {
    beforeEach(function () {
        iconLinks().forEach(link => link.parentNode.removeChild(link));
    });

    afterEach(function () {
        iconLinks().forEach(link => link.parentNode.removeChild(link));
    });

    describe('defaultFavicon', function () {
        it('is a shortcut icon link', function () {
            expect(defaultFavicon.tagName).toBe('LINK');
            expect(defaultFavicon.type).toBe('image/x-icon');
            expect(defaultFavicon.rel).toBe('shortcut icon');
            expect(defaultFavicon.href).toContain('favicon.ico');
        });
    });

    describe('setFavicon behaviour', function () {
        it('appends a favicon link when none is present', function () {
            expect(iconLinks().length).toBe(0);
            setDefaultFavicon();
            expect(iconLinks()).toContain(defaultFavicon);
        });

        it('replaces an existing favicon link instead of adding another', function () {
            const stale = document.createElement('link');
            stale.type = 'image/x-icon';
            stale.rel = 'shortcut icon';
            stale.href = 'old.ico';
            document.getElementsByTagName('head')[0].appendChild(stale);

            setDefaultFavicon();

            const links = iconLinks();
            expect(links.length).toBe(1);
            expect(links[0]).toBe(defaultFavicon);
        });
    });

    describe('fallback to default when generated icons are unavailable', function () {
        // In jsdom the base image never fires onload, so executingFavicon /
        // finishedFavicon stay undefined and the setters fall back to default.
        it('setExecutingFavicon falls back to the default favicon', function () {
            setExecutingFavicon();
            expect(iconLinks()).toContain(defaultFavicon);
        });

        it('setFinishedFavicon falls back to the default favicon', function () {
            setFinishedFavicon();
            expect(iconLinks()).toContain(defaultFavicon);
        });
    });
});
