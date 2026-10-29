import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Floating CTA (Webflow component "floating-button") — parked just below the viewport on mount,
//rises to its Webflow position once the preloader / eye transition is done.
//Distance is measured, so the pill starts fully off screen whatever its size or bottom margin.
//Any page with the component gets it; pages without it skip silently.

const CONTENT_SELECTOR = '.floating-button-content'

const REVEAL_DELAY = 0.2
const REVEAL_DURATION = 1.2
const REVEAL_EASE = 'expo.out'

export class FloatingButtonReveal extends Module {

    setup() {
        this.contents = [...document.querySelectorAll(CONTENT_SELECTOR)]
        if (this.contents.length === 0) return

        this.isRevealed = false
        this.contents.forEach((content) => gsap.set(content, { y: this.offscreenDistance(content) }))
    }

    //Called once the screen is visible
    reveal() {
        if (!this.contents?.length || this.isRevealed) return
        this.isRevealed = true
        this.playIn()
    }

    //Helpers

    //From its resting top edge to just past the viewport bottom
    offscreenDistance(content) {
        let restingTop = content.getBoundingClientRect().top - (gsap.getProperty(content, 'y') || 0)
        return Math.max(0, window.innerHeight - restingTop)
    }

    //Animations

    playIn() {
        this.animate(gsap.to(this.contents, {
            y: 0,
            duration: REVEAL_DURATION,
            delay: REVEAL_DELAY,
            ease: REVEAL_EASE,
            onComplete: () => gsap.set(this.contents, { clearProps: 'transform' }),
        }))
    }

    destroy() {
        super.destroy()
        if (this.contents?.length) gsap.set(this.contents, { clearProps: 'transform' })
        this.contents = []
    }
}
