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
        this.setIntroStartState()

        this.animate(gsap.fromTo(this.container,
            { y: 0, scale: START_SCALE },
            {
                y: () => -this.container.offsetTop,
                scale: END_SCALE,
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
        if (this.container) gsap.set(this.container, { clearProps: 'transform' })
    }
}
