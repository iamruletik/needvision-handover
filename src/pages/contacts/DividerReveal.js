import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Contacts page divider draws in stages from the left edge:
//scaleX 0 -> pauseScale, then the remaining distance in equal steps, one per entry in
//stepTimes (seconds after the reveal starts). contacts.js syncs stepTimes to the
//column-2 items, so the line advances as each one appears.
//Contacts is always one screen (100vh, nothing scrolls) — plays on reveal(), no ScrollTrigger.

const DIVIDER_SELECTOR = '.contacts-page-divider'

const ORIGIN = 'left center'
const DURATION = 0.8 //per stage
const EASE = 'expo.out'
const DELAY = 0.2 //lets the headline start first

const DEFAULTS = {
    pauseScale: 0.5,
    stepTimes: [1], //seconds after the reveal starts — clamped to the first stage's start
}

export class DividerReveal extends Module {

    constructor(options = {}) {
        super()
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.dividers = [...document.querySelectorAll(DIVIDER_SELECTOR)]
        if (this.dividers.length === 0) return

        this.hasPlayed = false
        gsap.set(this.dividers, { scaleX: 0, transformOrigin: ORIGIN })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.dividers?.length || this.hasPlayed) return
        this.hasPlayed = true
        this.dividers.forEach((divider) => this.play(divider))
    }

    //Animations

    play(divider) {
        let { pauseScale, stepTimes } = this.options
        let stepSize = (1 - pauseScale) / Math.max(stepTimes.length, 1)

        let timeline = gsap.timeline()
            .to(divider, { scaleX: pauseScale, duration: DURATION, ease: EASE }, DELAY)

        //Each step picks up from wherever the line is — a later step simply takes over
        stepTimes.forEach((time, index) => {
            timeline.to(divider, {
                scaleX: pauseScale + stepSize * (index + 1),
                duration: DURATION,
                ease: EASE,
            }, Math.max(time, DELAY))
        })

        this.animate(timeline)
    }

    //Cleanup

    destroy() {
        super.destroy()
        if (this.dividers?.length) gsap.set(this.dividers, { clearProps: 'transform,transformOrigin' })
        this.dividers = []
    }
}
