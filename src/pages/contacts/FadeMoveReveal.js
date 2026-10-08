import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Reusable fade + rise: elements fade in while moving up from `offsetY` px below.
//offsetY: 'viewportBottom' — start each element exactly at the bottom edge of the screen
//instead; the distance is measured when it plays (depends on scroll position).
//Usage: new FadeMoveReveal('.selector', { ...overrides }).mount()
//
//Plays when BOTH are true: page revealed (reveal() — preloader / eye done) and the
//element crossed `start` — elements already on screen play right after the reveal.
//waitForScroll: false — no ScrollTrigger at all, plays on reveal (pages that never scroll).

const VIEWPORT_BOTTOM = 'viewportBottom'

const DEFAULTS = {
    start: 'top 90%',
    waitForScroll: true,
    offsetY: 200,
    duration: 1.2,
    delay: 0,
    stagger: 0, //extra delay per matched element, in DOM order
    ease: 'expo.out',
}

export class FadeMoveReveal extends Module {

    constructor(selector, options = {}) {
        super()
        this.selector = selector
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.elements = [...document.querySelectorAll(this.selector)]
        if (this.elements.length === 0) return

        this.isRevealed = false
        this.isFromViewportBottom = this.options.offsetY === VIEWPORT_BOTTOM

        //Viewport mode stays in place until it plays — the distance is measured then
        gsap.set(this.elements, { y: this.isFromViewportBottom ? 0 : this.options.offsetY, autoAlpha: 0 })

        this.items = this.elements.map((element, index) => {
            let item = { element, index, isInView: !this.options.waitForScroll, hasPlayed: false }
            if (!this.options.waitForScroll) return item

            this.animate(ScrollTrigger.create({
                trigger: element,
                start: this.options.start,
                once: true,
                onEnter: () => {
                    item.isInView = true
                    this.tryPlay(item)
                },
            }))
            return item
        })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.items || this.isRevealed) return
        this.isRevealed = true
        this.items.forEach((item) => this.tryPlay(item))
    }

    //Animations

    tryPlay(item) {
        if (!this.isRevealed || !item.isInView || item.hasPlayed) return
        item.hasPlayed = true

        let startY = this.isFromViewportBottom ? this.distanceToViewportBottom(item.element) : this.options.offsetY

        this.animate(gsap.fromTo(item.element,
            { y: startY },
            {
                y: 0,
                autoAlpha: 1,
                duration: 0.6,
                delay: this.options.delay + item.index * this.options.stagger,
                ease: "power3.out",
            }
        ))
    }

    //Element's top -> bottom edge of the screen (element still at y: 0 here)
    distanceToViewportBottom(element) {
        return Math.max(0, window.innerHeight - element.getBoundingClientRect().top)
    }

    //Cleanup

    destroy() {
        super.destroy()
        if (this.elements?.length) gsap.set(this.elements, { clearProps: 'transform,opacity,visibility' })
        this.elements = []
        this.items = []
    }
}
