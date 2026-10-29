import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//First-load preloader: cycles 9 icons until the page and the 3D scene are ready.
//At least one full cycle always plays. Scroll is locked while visible.
//Runs ONCE per session — Barba transitions use the eye blink, not this.
//
//Ready conditions: document fully loaded AND, if the page has a 3D scene that will run,
//the scene's 'experience-ready' event (its first frame — fired before the underwater video
//finishes downloading). "Will run": .js-canvas-wrapper exists and its data-media query, if
//any, matches — otherwise the scene never starts and the event never comes.
//MAX_WAIT_MS is the hard ceiling — the preloader never hangs forever on a scene that died.

const PRELOADER_SELECTOR = '.preloader-component-element'
const ICON_SELECTOR = '.preloader_icon'
const CANVAS_WRAPPER_SELECTOR = '.js-canvas-wrapper'

const FRAME_MS = 300
const PAUSE_ON_LAST_MS = 600
const FADE_DURATION = 1.0
const MAX_WAIT_MS = 15000

export class Preloader extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
        //Resolves when the page becomes visible — fade start, or immediately if there's no preloader
        this.revealed = new Promise((resolve) => { this.resolveRevealed = resolve })
    }

    setup() {
        this.preloader = document.querySelector(PRELOADER_SELECTOR)
        if (!this.preloader) return this.resolveRevealed()

        this.icons = [...this.preloader.querySelectorAll(ICON_SELECTOR)]
        if (this.icons.length === 0) return this.resolveRevealed()

        this.currentIcon = 0
        this.lastFrameAt = 0
        this.isHiding = false
        this.sceneReady = false
        this.forceReady = false

        //Webflow keeps the preloader display:none in the designer. The head-code
        //snippet shows it before first paint; this is the fallback if that's missing.
        this.preloader.style.display = 'flex'
        this.preloader.style.opacity = '1'

        this.icons.forEach((icon, index) => {
            icon.style.opacity = index === 0 ? '1' : '0'
            icon.style.willChange = 'opacity'
        })

        this.listen(document, 'experience-ready', () => { this.sceneReady = true })
        this.later(() => { this.forceReady = true }, MAX_WAIT_MS)

        this.lockScroll()
        this.loop((now) => this.tick(now))
    }

    //Scroll Lock — overflow:hidden plus padding for the vanished scrollbar so nothing jumps

    lockScroll() {
        this.smoothScroll?.stop()
        let scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
        document.documentElement.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    }

    unlockScroll() {
        document.documentElement.style.overflow = ''
        document.body.style.overflow = ''
        document.body.style.paddingRight = ''
        this.smoothScroll?.start()
    }

    //Readiness

    isFullyLoaded() {
        if (this.forceReady) return true
        if (document.readyState !== 'complete') return false
        if (this.isSceneExpected() && !this.sceneReady) return false
        return true
    }

    //Same rule the scene uses to decide whether to start (scene Canvas.ts): wrapper present,
    //and its data-media query matches when it has one. Not the <canvas> element — the scene
    //creates that before loading anything
    isSceneExpected() {
        let canvasWrapper = document.querySelector(CANVAS_WRAPPER_SELECTOR)
        if (!canvasWrapper) return false

        let media = canvasWrapper.dataset.media?.trim()
        if (!media) return true
        try {
            return window.matchMedia(media).matches
        } catch {
            return true //malformed query — the ceiling still covers it
        }
    }

    //Icon Cycle — readiness is checked only on the last icon, so a full cycle always shows

    tick(now) {
        if (this.isHiding) return
        if (now - this.lastFrameAt < FRAME_MS) return
        this.lastFrameAt = now

        this.icons[this.currentIcon].style.opacity = '0'
        this.currentIcon = (this.currentIcon + 1) % this.icons.length
        this.icons[this.currentIcon].style.opacity = '1'

        if (this.currentIcon === this.icons.length - 1 && this.isFullyLoaded()) {
            this.isHiding = true
            this.hide()
        }
    }

    hide() {
        //Unlock now, while the preloader still covers everything — the scrollbar
        //reappears into the reserved padding without a visible jump
        this.unlockScroll()

        this.later(() => {
            this.resolveRevealed()
            this.animate(gsap.to(this.preloader, {
                opacity: 0,
                duration: FADE_DURATION,
                ease: 'expo.out',
                onComplete: () => {
                    this.preloader.style.display = 'none'
                    this.destroy()
                },
            }))
        }, PAUSE_ON_LAST_MS)
    }

    //Failed mount must not leave the page waiting forever
    destroy() {
        super.destroy()
        this.resolveRevealed?.()
    }
}
