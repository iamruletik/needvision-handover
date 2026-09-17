/**
 * Resolves a runtime asset path against the host that actually serves it.
 * The bundle runs on the Webflow origin, so root-relative URLs would resolve
 * against the wrong domain.
 *
 * __STATIC_BASE__ is the folder that CONTAINS gltf/, textures/ and videos/ —
 * baked in at build time via vite define (see astro.config.ts), so it works in
 * the worker bundle too. In production that is the Google Cloud Storage prefix;
 * in dev it is our Vite server's /static folder.
 *
 * Call sites still pass design-time paths like '/static/gltf/city.glb', so the
 * leading '/static' is stripped before joining — the bucket has no such folder.
 *
 * NOTE: this is for RUNTIME assets only (models, textures, video). The bundle's
 * own files (app.js, World.js, canvas.worker.js) ship with the deploy and are
 * resolved relative to import.meta.url instead.
 */
declare const __STATIC_BASE__: string;

export function staticUrl(path: string): string {
    return __STATIC_BASE__ + path.replace(/^\/static/, '');
}
