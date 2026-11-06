import { Module } from '../core/Module'

//Loads the 3D city scene (built separately from scene/, served from our origin
//under /assets). Only acts on pages with the canvas wrapper (home).
//First visit: injects the scene CSS and imports the bundle — it boots itself and
//exposes window.needvisionScene { init, park, destroy, isReady }. Barba re-entries reuse
//that handle. Leaving home parks the scene (built, not rendering — instant return);
//the scene destroys it for real if nobody comes back within its park expiry.
//The scene dispatches 'experience-ready' on document when the world is live —
//the preloader waits for it on first load, the eye transition via waitUntilReady().

//__SITE_BASE__ — build-time constant (vite.config.js): localhost in dev, the GitHub
//Pages URL in prod. NOT import.meta.url — the prod bundle is an IIFE, where
//import.meta doesn't exist at all, so that would throw at runtime.
/* global __SITE_BASE__ */
//No leading slash: '/assets/…' would be treated as an absolute path and throw the
//base's own path away, resolving to iamruletik.github.io/assets/… (404).
//Relative keeps the /needvision-handover/ deploy sub-path. __SITE_BASE__ always
//ends in a slash, which relative resolution requires.
export const SCENE_SCRIPT_URL = new URL('assets/app.js', __SITE_BASE__).href
export const SCENE_STYLE_URL = new URL('assets/app.css', __SITE_BASE__).href

const CANVAS_WRAPPER_SELECTOR = '.js-canvas-wrapper'
const SCENE_READY_EVENT = 'experience-ready'

//Debug — logs how long the scene took from setup to its first live frame
const IS_BOOT_DEBUG = true

let isLoading = false

//Same rule the scene uses to decide whether to start (scene Canvas.ts): wrapper present,
//and its data-media query matches when it has one
export function isSceneExpected(wrapper = document.querySelector(CANVAS_WRAPPER_SELECTOR)) {
    if (!wrapper) return false
    let media = wrapper.dataset.media?.trim()
    if (!media) return true
    try {
        return window.matchMedia(media).matches
    } catch {
        return true
    }
}

export class SceneLoader extends Module {

    setup() {
        //Resolves when the scene's first frame is live — or right away when no scene will run
        this.ready = new Promise((resolve) => { this.resolveReady = resolve })

        this.wrapper = document.querySelector(CANVAS_WRAPPER_SELECTOR)
        if (!this.wrapper || !isSceneExpected(this.wrapper)) return this.resolveReady()

        this.bootStartedAt = performance.now()
        this.listen(document, SCENE_READY_EVENT, () => this.onSceneReady())

        //Already loaded once — the scene script persists, resume the parked scene on the fresh wrapper
        if (window.needvisionScene) {
            window.needvisionScene.init()
            if (window.needvisionScene.isReady?.()) this.onSceneReady()
            return
        }

        if (isLoading) return
        isLoading = true

        //Bundle and styles live on our own origin, never the Webflow page's
        let styleLink = document.createElement('link')
        styleLink.rel = 'stylesheet'
        styleLink.href = SCENE_STYLE_URL

        //The scene reads the canvas size once at boot — before app.css applies it's the 300x150
        //default and the renderer stays low-res. Bundle waits for the styles (or their failure)
        let stylesReady = new Promise((resolve) => {
            styleLink.addEventListener('load', resolve, { once: true })
            styleLink.addEventListener('error', resolve, { once: true })
        })
        document.head.appendChild(styleLink)

        stylesReady
            .then(() => import(/* @vite-ignore */ SCENE_SCRIPT_URL))
            .catch((error) => {
                console.warn('SceneLoader: scene bundle failed to load', error)
                this.resolveReady()
            })
            .finally(() => {
                isLoading = false
            })
    }

    onSceneReady() {
        if (IS_BOOT_DEBUG) console.log(`[scene] ready ${Math.round(performance.now() - this.bootStartedAt)}ms after setup`)
        this.resolveReady()
    }

    //Scene ready, or maxWaitMs passed — never hangs a transition on a scene that died
    waitUntilReady(maxWaitMs) {
        let timeout = new Promise((resolve) => this.later(resolve, maxWaitMs))
        return Promise.race([this.ready, timeout])
    }

    //Only the page that has the scene touches it — leaving any other page must not end a parked one
    destroy() {
        let scene = this.wrapper ? window.needvisionScene : null
        //Older scene builds have no park — fall back to the full teardown
        if (scene?.park) scene.park()
        else scene?.destroy()
        this.resolveReady?.()
        super.destroy()
    }
}
