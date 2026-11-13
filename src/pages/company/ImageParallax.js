import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Reusable image parallax: every matched image drifts while its trigger element scrolls
//past — scrubbed, transform only (no background-position repaint).
//Usage: new ImageParallax('.image', { trigger: (image) => image.closest('.section') }).mount()
//
//Images are sized at 100% in Webflow, so JS scales them up to buy travel room:
//scale 1.2 = 10% hidden overflow per side. travelPercent must stay below that
//(yPercent is measured on the unscaled height) or an edge shows.
//
//trigger — function image -> element whose scroll position drives it. Must be an in-flow
//element: a position:fixed wrapper never moves, ScrollTrigger can't measure it.
//Defaults to the image's parent.
//endTrigger — optional selector for where `end` is measured, e.g. the section that covers a
//sticky one (a sticky trigger's own bottom passes the top while it's still on screen).

//scaleFrom — optional: scale grows scaleFrom -> scale over the same scrub. At scale 1 there's no
//overflow to hide an edge, so the drift then runs 0 -> travelPercent (room grows with the scale)
//instead of -travelPercent -> travelPercent.

const DEFAULTS = {
    trigger: (image) => image.parentElement,
    endTrigger: null,
    scaleFrom: null,
    scale: 1.2,
    travelPercent: 8,
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
}

export class ImageParallax extends Module {

    constructor(selector, options = {}) {
        super()
        this.selector = selector
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.images = [...document.querySelectorAll(this.selector)]
        this.images.forEach((image) => this.setupImage(image))
    }

    setupImage(image) {
        let triggerElement = this.options.trigger(image)
        if (!triggerElement) return

        let isScaling = this.options.scaleFrom != null
        let fromState = isScaling
            ? { yPercent: 0, scale: this.options.scaleFrom }
            : { yPercent: -this.options.travelPercent, scale: this.options.scale }

        //Image lags behind the scroll — drifts down while the page moves up
        this.animate(gsap.fromTo(image,
            fromState,
            {
                yPercent: this.options.travelPercent,
                scale: this.options.scale,
                ease: 'none',
                scrollTrigger: {
                    trigger: triggerElement,
                    endTrigger: this.options.endTrigger || undefined,
                    start: this.options.start,
                    end: this.options.end,
                    scrub: this.options.scrub,
                },
            }
        ))
    }

    destroy() {
        super.destroy()
        if (this.images?.length) gsap.set(this.images, { clearProps: 'transform' })
        this.images = []
    }
}
