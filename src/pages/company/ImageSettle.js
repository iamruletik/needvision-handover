import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Image container peeks into the hero (Webflow: absolute, top -25%, scale 0.9) and
//settles into its original place as the page scrolls. Scrubbed from scroll 0 until
//.companypage_image reaches the top of the viewport.
//Moves with transform y instead of animating top — no layout per frame. The offset
//is read from offsetTop, so changing the -25% in Webflow needs no code change.

const START_SCALE = 0.9
const END_SCALE = 1
const SCROLL_END = 'top top'
const SCRUB = true

//≤991 the full box is the whole viewport, so a uniform scale would start tall too. Instead it
//starts as a START_ASPECT strip — full width minus START_GUTTER_REM per side, at the box's top
//so it fills the peek under the headline (size the peek with the Webflow top) — and grows to
//the full box. Real width/height, not clip or scale: object-fit cover re-crops every frame, so
//the picture reads landscape at the start. Layout per frame, but only inside the absolute box.
//Checked once at load, like the other ≤991 modules
const LANDSCAPE_MEDIA = '(max-width: 991px)'
const START_ASPECT = 16 / 9
const START_GUTTER_REM = 1

//Intro — on reveal the container rises from top 0 to its Webflow -25%.
//Runs on yPercent so it stacks with the scroll tween's y instead of fighting it.
const INTRO_DURATION = 1.2
const INTRO_EASE = 'power3.out'

export class ImageSettle extends Module {

    setup() {
        this.wrapper = document.querySelector('.companypage_image')
        this.container = this.wrapper?.querySelector('.companypage_image-container')
        if (!this.wrapper || !this.container) return

        this.isRevealed = false
        this.isLandscapeStart = window.matchMedia(LANDSCAPE_MEDIA).matches

        //Sizes come from the wrapper — the container is 100% of it in Webflow, and its own
        //size is inline mid-tween when a refresh re-reads these
        let fromState = this.isLandscapeStart
            ? { y: 0, scale: END_SCALE, x: () => this.gutter(), width: () => this.stripWidth(), height: () => this.stripWidth() / START_ASPECT }
            : { y: 0, scale: START_SCALE }
        let toState = this.isLandscapeStart
            ? { scale: END_SCALE, x: 0, width: () => this.wrapper.offsetWidth, height: () => this.wrapper.offsetHeight }
            : { scale: END_SCALE }

        this.animate(gsap.fromTo(this.container,
            fromState,
            {
                ...toState,
                y: () => -this.container.offsetTop,
                ease: 'none',
                scrollTrigger: {
                    trigger: this.wrapper,
                    start: 0,
                    end: SCROLL_END,
                    scrub: SCRUB,
                    invalidateOnRefresh: true,
                },
            }
        ))

        //After the tween — ≤991 its from state shrank the box, and yPercent is of the current height
        this.setIntroStartState()
    }

    //Helpers

    gutter() {
        let rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        return START_GUTTER_REM * rootFontSize
    }

    stripWidth() {
        return this.wrapper.offsetWidth - this.gutter() * 2
    }

    //Pushes the container down to where top: 0 would place it
    setIntroStartState() {
        let containerHeight = this.container.offsetHeight
        if (!containerHeight) return
        gsap.set(this.container, { yPercent: (-this.container.offsetTop / containerHeight) * 100 })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.container || this.isRevealed) return
        this.isRevealed = true

        this.animate(gsap.to(this.container, {
            yPercent: 0,
            duration: INTRO_DURATION,
            ease: INTRO_EASE,
        }))
    }

    destroy() {
        super.destroy()
        if (this.container) gsap.set(this.container, { clearProps: 'transform,width,height' })
    }
}
