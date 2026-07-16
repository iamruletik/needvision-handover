import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//First-load preloader: cycles 9 icons until the page (and later the 3D scene) is ready.
//At least one full cycle always plays. Scroll is locked while visible.
//Runs ONCE per session — Barba transitions use the eye blink, not this.
//
//Ready conditions: document fully loaded AND, if .js-canvas-wrapper exists,
//a <canvas> inside it or the scene's 'experience-ready' event. MAX_WAIT_MS is the
//hard ceiling — the preloader never hangs forever waiting for a scene that died.

const FRAME_MS = 300
const PAUSE_ON_LAST_MS = 600
const FADE_DURATION = 1.0
const MAX_WAIT_MS = 12000

export class Preloader extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
    }

    setup() {
        this.preloader = document.querySelector('.preloader')
        if (!this.preloader) return

        this.icons = [...this.preloader.querySelectorAll('.preloader_icon')]
        if (this.icons.length === 0) return

        this.currentIcon = 0
        this.lastFrameAt = 0
        this.isHiding = false
        this.sceneReady = false
        this.forceReady = false

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
        if (this.sceneReady) return true

        //Canvas wrapper present means a 3D scene is expected — wait for its canvas
        let canvasWrapper = document.querySelector('.js-canvas-wrapper')
        if (canvasWrapper && !canvasWrapper.querySelector('canvas')) return false
        return true
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
}
