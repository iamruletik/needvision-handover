import { Module } from '../core/Module'

//Loads the 3D city scene (built separately from scene/, served from our origin
//under /assets). Only acts on pages with the canvas wrapper (home).
//First visit: injects the scene CSS and imports the bundle — it boots itself and
//exposes window.needvisionScene { init, destroy }. Barba re-entries reuse that
//handle. destroy() on page leave shuts down the worker and frees the GPU.
//The scene dispatches 'experience-ready' on document when the world is live —
//the preloader waits for it on first load.

const SCENE_SCRIPT_PATH = '/assets/app.js'
const SCENE_STYLE_PATH = '/assets/app.css'

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

        //Bundle and styles live on our origin — resolve against this module's own URL,
        //correct in dev (localhost) and production (GitHub Pages) alike
        let styleLink = document.createElement('link')
        styleLink.rel = 'stylesheet'
        styleLink.href = new URL(SCENE_STYLE_PATH, import.meta.url).href
        document.head.appendChild(styleLink)

        import(/* @vite-ignore */ new URL(SCENE_SCRIPT_PATH, import.meta.url).href)
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
