/**
 * Prefixes /static asset paths with the host the scene bundle is deployed on.
 * The bundle runs on the Webflow origin, so root-relative URLs would resolve
 * against the wrong domain. __STATIC_BASE__ is baked in at build time via
 * vite define (see astro.config.ts) — works in the worker bundle too.
 */
declare const __STATIC_BASE__: string;

export function staticUrl(path: string): string {
    return __STATIC_BASE__ + path;
}
