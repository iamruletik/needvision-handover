import { Module } from '../core/Module'
import { SCENE_SCRIPT_URL, SCENE_STYLE_URL } from './SceneLoader'

//Visitor landed on a page without the 3D scene — once that page is revealed and the browser
//is idle, download what the scene's boot would fetch, so going home later skips the network.
//Only the download: the boot itself (worker, GPU, decode, shaders) still runs on the way home,
//behind the eye (main.js waits for the scene). Once per session; never on phones (the scene
//doesn't run there), with Save-Data on, or once the scene has loaded anyway.
//Plain fetch(), not <link rel="prefetch"> — Safari doesn't support that. Same CORS mode
//as the scene's own requests, so the cached copies match and get reused.
//Safari: no requestIdleCallback either — a short timeout stands in.

/* global __SITE_BASE__, __SCENE_STATIC_BASE__ */

//Must match the scene's own paths (scene/src: load-city-glb.ts, load-hdri-environment.ts,
//create-water-reflector-plane.ts, load-scroll-transition-textures.ts)
const SCENE_ASSET_PATHS = [
    'gltf/city5.3_opt.glb',
    'textures/hdri/sunset_in_the_chalk_quarry_256.exr',
    'textures/hdri/ferndale_studio_08_256.exr',
    'textures/normal-map.jpg',
    'textures/gradient-noise.jpg',
]
const DRACO_DECODER_BASE = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/'
const DRACO_DECODER_FILES = ['draco_wasm_wrapper.js', 'draco_decoder.wasm']

const PREFETCH_URLS = [
    SCENE_SCRIPT_URL,
    SCENE_STYLE_URL,
    new URL('assets/canvas.worker.js', __SITE_BASE__).href,
    ...SCENE_ASSET_PATHS.map((path) => `${__SCENE_STATIC_BASE__}/${path}`),
    ...DRACO_DECODER_FILES.map((file) => DRACO_DECODER_BASE + file),
]

const SCENE_MEDIA_QUERY = '(min-width: 577px)' //the home wrapper's data-media in Webflow
const CANVAS_WRAPPER_SELECTOR = '.js-canvas-wrapper'
const IDLE_TIMEOUT_MS = 3000
const SAFARI_IDLE_FALLBACK_MS = 1500

let isPrefetched = false

export class ScenePrefetch extends Module {

    setup() {
        if (isPrefetched || window.needvisionScene) return
        if (document.querySelector(CANVAS_WRAPPER_SELECTOR)) return
        if (!window.matchMedia(SCENE_MEDIA_QUERY).matches) return
        if (navigator.connection?.saveData) return
        this.isWanted = true
    }

    //Page visible — its own images go first, the scene waits for idle
    reveal() {
        if (!this.isWanted || isPrefetched) return
        if ('requestIdleCallback' in window) {
            this.idleHandle = requestIdleCallback(() => this.prefetch(), { timeout: IDLE_TIMEOUT_MS })
        } else {
            this.later(() => this.prefetch(), SAFARI_IDLE_FALLBACK_MS)
        }
    }

    //Bodies read to the end — an unread response may be dropped before it reaches the cache
    prefetch() {
        if (isPrefetched) return
        isPrefetched = true
        PREFETCH_URLS.forEach((url) => {
            fetch(url, { priority: 'low' })
                .then((response) => response.blob())
                .catch(() => {})
        })
    }

    destroy() {
        if (this.idleHandle) cancelIdleCallback(this.idleHandle)
        this.idleHandle = null
        super.destroy()
    }
}
