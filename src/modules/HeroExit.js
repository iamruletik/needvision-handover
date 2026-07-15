import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Hero texts leave upward tied directly to scroll position, smoothed with lerp.
//Deliberately NOT ScrollTrigger: the hero lives in a sticky container and pin/scrub
//conflicts with it — manual rAF reading the scroll position is the stable approach.
//Timeline progress maps to the scroll zone below; lerp gives the scrub-with-inertia feel.

const EXIT_SELECTORS = [
    '.hero_planet-img',
    '.hero_label',
    '.hero_tag',
    '.hero_title1',
    '.hero_title2',
    '.hero_subtitle1',
    '.hero_subtitle2',
]

//Scroll zone where progress runs 0 -> 1, in viewport widths
const ZONE_START_VW = 1.4
const ZONE_END_VW = 2.0
//Lerp factor: higher = snappier, lower = lazier
const SMOOTHING = 0.08
const EXIT_EASE = 'power3.inOut'

export class HeroExit extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
    }

    setup() {
        this.exitElements = EXIT_SELECTORS.flatMap((selector) => [...document.querySelectorAll(selector)])
        if (this.exitElements.length === 0) return

        this.exitElements.forEach((element) => { element.style.willChange = 'transform, opacity' })

        //Progress is driven manually — duration value is irrelevant, only [0..1] matters
        this.exitTimeline = this.animate(gsap.timeline({ paused: true }))
        this.exitTimeline.to(this.exitElements, {
            yPercent: -110,
            y: '-13.89vw',
            opacity: 0,
            duration: 1,
            ease: EXIT_EASE,
        })

        this.targetProgress = 0
        this.actualProgress = 0
        this.loop(() => this.tick())
    }

    scrollPosition() {
        return this.smoothScroll?.position ?? window.scrollY
    }

    tick() {
        let zoneStart = window.innerWidth * ZONE_START_VW
        let zoneEnd = window.innerWidth * ZONE_END_VW
        let range = Math.max(1, zoneEnd - zoneStart)

        this.targetProgress = gsap.utils.clamp(0, 1, (this.scrollPosition() - zoneStart) / range)
        this.actualProgress += (this.targetProgress - this.actualProgress) * SMOOTHING

        //Snap when close — kills endless micro-jitter around the extremes
        if (Math.abs(this.actualProgress - this.targetProgress) < 0.0005) {
            this.actualProgress = this.targetProgress
        }

        this.exitTimeline.progress(this.actualProgress)
    }
}
