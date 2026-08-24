import { Module } from '../core/Module'

//Loads the 3D city scene (built separately from scene/, served from our origin
//under /assets). Only acts on pages with the canvas wrapper (home).
//First visit: injects the scene CSS and imports the bundle — it boots itself and
//exposes window.needvisionScene { init, destroy }. Barba re-entries reuse that
//handle. destroy() on page leave shuts down the worker and frees the GPU.
//The scene dispatches 'experience-ready' on document when the world is live —
//the preloader waits for it on first load.

//__SITE_BASE__ — build-time constant (vite.config.js): localhost in dev, the GitHub
//Pages URL in prod. NOT import.meta.url — the prod bundle is an IIFE, where
//import.meta doesn't exist at all, so that would throw at runtime.
/* global __SITE_BASE__ */
const SCENE_SCRIPT_URL = new URL('/assets/app.js', __SITE_BASE__).href
const SCENE_STYLE_URL = new URL('/assets/app.css', __SITE_BASE__).href

let isLoading = false

export class SceneLoader extends Module {

    setup() {
        this.wrapper = document.querySelector('.js-canvas-wrapper')
        if (!this.wrapper) return

        //Already loaded once — the scene script persists, just re-init on the fresh canvas wrapper
        if (window.needvisionScene) {
            window.needvisionScene.init()
            return
        }

        if (isLoading) return
        isLoading = true

        //Bundle and styles live on our own origin, never the Webflow page's
        let styleLink = document.createElement('link')
        styleLink.rel = 'stylesheet'
        styleLink.href = SCENE_STYLE_URL
        document.head.appendChild(styleLink)

        import(/* @vite-ignore */ SCENE_SCRIPT_URL)
            .catch((error) => {
                console.warn('SceneLoader: scene bundle failed to load', error)
            })
            .finally(() => {
                isLoading = false
            })
    }

    destroy() {
        window.needvisionScene?.destroy()
        super.destroy()
    }
}
