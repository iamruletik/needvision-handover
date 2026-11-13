import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Home cases section intro — plays once, the first time .section-cases scrolls in after the
//page reveal: the tag rises in (its SplitBlurReveal belongs to CasesSlider, which also swaps it
//per slide), the cards slide in from the right one after another, then the fraction fades in
//and the "all cases" button rises with a fade. Fraction + button hide on scroll back and replay.
//Cards are moved, not .case_cards-line — the slider owns the line's x.
//Owned by CasesSlider: it mounts, reveals and destroys this.

const SECTION_SELECTOR = '.section-cases'
const CONTAINER_SELECTOR = '.cases-container'
const FRACTION_SELECTOR = '.cases_fraction'
const BUTTON_SELECTOR = '.button-white'

//Section is 100vh sticky — play once it has nearly covered the screen
const TRIGGER_START = 'top 20%'

//Sequence — tag first, cards after, fraction + button last
const CARDS_DELAY = 0.15
const FOOTER_DELAY = 0.3

const DURATION = 1.2
const EASE = 'expo.out'

//Cards
const CARD_OFFSET_X = '30vw'
const CARD_STAGGER = 0.08

//Button
const BUTTON_OFFSET_Y = '2vw'

//Pagination (fraction + button) hides again when scrolled back above the trigger and replays
//on the next enter. Cards and tag stay — one-time intro
const FOOTER_HIDE_DURATION = 0.4
const FOOTER_HIDE_EASE = 'power2.in'

export class CasesIntro extends Module {

    //tagReveal — CasesSlider's manual SplitBlurReveal on the tag; null when there is no tag
    constructor(cards, tagReveal = null) {
        super()
        this.cards = cards ?? []
        this.tagReveal = tagReveal
    }

    setup() {
        this.section = document.querySelector(SECTION_SELECTOR)
        this.container = document.querySelector(CONTAINER_SELECTOR)
        if (!this.section || !this.container) return

        this.fraction = this.container.querySelector(FRACTION_SELECTOR)
        this.button = this.container.querySelector(BUTTON_SELECTOR)
        this.isRevealed = false
        this.isInView = false
        this.hasPlayed = false

        if (this.cards.length) gsap.set(this.cards, { x: CARD_OFFSET_X, opacity: 0 })
        if (this.fraction) gsap.set(this.fraction, { opacity: 0 })
        if (this.button) gsap.set(this.button, { y: BUTTON_OFFSET_Y, opacity: 0 })

        this.animate(ScrollTrigger.create({
            trigger: this.section,
            start: TRIGGER_START,
            onEnter: () => {
                this.isInView = true
                if (this.hasPlayed) this.playFooterIn(0)
                else this.tryPlay()
            },
            onLeaveBack: () => {
                if (this.hasPlayed) this.playFooterOut()
            },
        }))
    }

    //Called once the screen is visible
    reveal() {
        if (!this.container || this.isRevealed) return
        this.isRevealed = true
        this.tryPlay()
    }

    //Animations

    tryPlay() {
        if (!this.isRevealed || !this.isInView || this.hasPlayed) return
        this.hasPlayed = true

        this.tagReveal?.playIn()

        if (this.cards.length) {
            this.animate(gsap.to(this.cards, {
                x: 0,
                opacity: 1,
                duration: DURATION,
                stagger: CARD_STAGGER,
                ease: EASE,
                delay: CARDS_DELAY,
                onComplete: () => this.clearPoses(this.cards),
            }))
        }
        this.playFooterIn(FOOTER_DELAY)
    }

    //Each call replaces the previous footer tween — fast scroll back and forth never stacks them
    playFooterIn(delay) {
        this.footerTween?.kill()
        let timeline = gsap.timeline({ delay })
        if (this.fraction) timeline.to(this.fraction, { opacity: 1, duration: DURATION, ease: EASE }, 0)
        if (this.button) timeline.to(this.button, { y: 0, opacity: 1, duration: DURATION, ease: EASE }, 0)
        this.footerTween = this.animate(timeline)
    }

    playFooterOut() {
        this.footerTween?.kill()
        let timeline = gsap.timeline()
        if (this.fraction) timeline.to(this.fraction, { opacity: 0, duration: FOOTER_HIDE_DURATION, ease: FOOTER_HIDE_EASE }, 0)
        if (this.button) timeline.to(this.button, { y: BUTTON_OFFSET_Y, opacity: 0, duration: FOOTER_HIDE_DURATION, ease: FOOTER_HIDE_EASE }, 0)
        this.footerTween = this.animate(timeline)
    }

    //Back to Webflow's own styles — nothing left inline once landed or destroyed
    clearPoses(targets = [...this.cards, this.fraction, this.button]) {
        let presentTargets = targets.filter(Boolean)
        if (presentTargets.length) gsap.set(presentTargets, { clearProps: 'transform,opacity' })
    }

    destroy() {
        super.destroy()
        this.clearPoses()
    }
}
