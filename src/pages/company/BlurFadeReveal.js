import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Reusable fade-in from blur. Usage: new BlurFadeReveal('.selector', { ...overrides }).mount()
//
//Plays when BOTH are true: page revealed (reveal() — preloader / eye done) and the element
//crossed `start`. Hero elements play right after the reveal, ones further down on scroll.

const DEFAULTS = {
    start: 'top 90%',
    blurStartPx: 16,
    duration: 1.2,
    delay: 0,
    ease: 'power2.out',
}

export class BlurFadeReveal extends Module {

    constructor(selector, options = {}) {
        super()
        this.selector = selector
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.isRevealed = false
        this.items = [...document.querySelectorAll(this.selector)].map((element) => this.createItem(element))
    }

    createItem(element) {
        let item = { element, tween: null, isInView: false, hasPlayed: false }

        gsap.set(element, { autoAlpha: 0, filter: `blur(${this.options.blurStartPx}px)` })

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
    }

    //Called once the screen is visible
    reveal() {
        if (this.isRevealed) return
        this.isRevealed = true
        this.items?.forEach((item) => this.tryPlay(item))
    }

    //Animations

    tryPlay(item) {
        if (!this.isRevealed || !item.isInView || item.hasPlayed) return
        item.hasPlayed = true

        item.tween = gsap.to(item.element, {
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: this.options.duration,
            delay: this.options.delay,
            ease: this.options.ease,
            //Leftover filter keeps the layer expensive — drop it once done
            onComplete: () => gsap.set(item.element, { clearProps: 'filter' }),
        })
    }

    //Cleanup

    destroy() {
        this.items?.forEach((item) => {
            item.tween?.kill()
            gsap.set(item.element, { clearProps: 'opacity,visibility,filter' })
        })
        this.items = []
        super.destroy()
    }
}
