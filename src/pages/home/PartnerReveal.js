import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Home partner card (.partner_card inside .partner_container) — plays once, the first time the
//card scrolls in after the page reveal, top to bottom in DOM order:
//  decor icon blur-fades in, title rises in (SplitBlurReveal), badges blur-fade in,
//  then each paragraph rises in. Card is sticky — triggered off its own natural position.

const CARD_SELECTOR = '.partner_container .partner_card'
const DECOR_SELECTOR = '.partner_decor-icon'
const TITLE_SELECTOR = '.partner_title'
const BADGES_SELECTOR = '.partner_badges'
const TEXT_SELECTOR = '.partner_text'

const TRIGGER_START = 'top 75%'

//Sequence — one step after another
const STEP_GAP = 0.1

//Blur fade — matches SplitBlurReveal's default look
const BLUR_FADE_BLUR = 12
const BLUR_FADE_DURATION = 1.1
const BLUR_FADE_EASE = 'power3.out'

export class PartnerReveal extends Module {

    setup() {
        this.card = document.querySelector(CARD_SELECTOR)
        if (!this.card) return

        this.decorIcon = this.card.querySelector(DECOR_SELECTOR)
        this.badges = this.card.querySelector(BADGES_SELECTOR)
        this.titleReveal = this.createTextReveal(this.card.querySelector(TITLE_SELECTOR))
        this.textReveals = [...this.card.querySelectorAll(TEXT_SELECTOR)].map((text) => this.createTextReveal(text))

        this.isRevealed = false
        this.isInView = false
        this.hasPlayed = false

        let blurFadeTargets = this.blurFadeTargets()
        if (blurFadeTargets.length) gsap.set(blurFadeTargets, { opacity: 0, filter: `blur(${BLUR_FADE_BLUR}px)` })

        this.animate(ScrollTrigger.create({
            trigger: this.card,
            start: TRIGGER_START,
            once: true,
            onEnter: () => {
                this.isInView = true
                this.tryPlay()
            },
        }))
    }

    //Called once the screen is visible
    reveal() {
        if (!this.card || this.isRevealed) return
        this.isRevealed = true
        this.tryPlay()
    }

    //Helpers

    createTextReveal(element) {
        return element ? new SplitBlurReveal(element, { trigger: 'manual' }).mount() : null
    }

    blurFadeTargets() {
        return [this.decorIcon, this.badges].filter(Boolean)
    }

    //Animations

    tryPlay() {
        if (!this.isRevealed || !this.isInView || this.hasPlayed) return
        this.hasPlayed = true

        this.blurFadeIn(this.decorIcon, 0)
        this.later(() => this.titleReveal?.playIn(), STEP_GAP * 1000)
        this.blurFadeIn(this.badges, STEP_GAP * 2)
        this.textReveals.forEach((reveal, index) => {
            this.later(() => reveal?.playIn(), STEP_GAP * (3 + index) * 1000)
        })
    }

    blurFadeIn(element, delay) {
        if (!element) return
        this.animate(gsap.to(element, {
            opacity: 1,
            filter: 'blur(0px)',
            duration: BLUR_FADE_DURATION,
            delay,
            ease: BLUR_FADE_EASE,
            //Leftover filter keeps the layer expensive — drop it once done
            onComplete: () => gsap.set(element, { clearProps: 'filter,opacity' }),
        }))
    }

    //Cleanup — back to how Webflow has it

    destroy() {
        super.destroy()
        let blurFadeTargets = this.blurFadeTargets?.() ?? []
        if (blurFadeTargets.length) gsap.set(blurFadeTargets, { clearProps: 'filter,opacity' })
        this.titleReveal?.destroy()
        this.titleReveal = null
        this.textReveals?.forEach((reveal) => reveal?.destroy())
        this.textReveals = []
    }
}
