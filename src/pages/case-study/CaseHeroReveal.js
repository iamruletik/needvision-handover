import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Case hero intro — hidden on mount, played by reveal():
//  texts  — title, then sub: SplitBlurReveal, TEXT_CASCADE apart
//  pieces — logo, year chip (is-outline), "all cases" chip (is-white): fade in rising from
//           below, one after another
//Two users:
//  the page (case study page script) — root defaults to the hero in the Barba container; plays
//    when the screen is revealed. reveal({ isInstant: true }) = everything in place, no animation
//    (next-case swap: the stage already played this on its copy)
//  the next-case stage (NextCaseTransition) — root is its copy of the next hero, plays mid-scroll;
//    includeScrollHint also fades the "scroll to explore" hint (HeroScrollReveal owns it on the page)
//reveal() returns a promise that resolves when everything has landed.

const HERO_SELECTOR = '[data-barba="container"] .casepage_hero'
const TEXT_SELECTORS = ['.casepage_hero-title', '.casepage_hero-sub']
const PIECE_SELECTORS = ['.casepage_hero-logo', '.casepage_chip.is-outline', '.casepage_chip.is-white']
const SCROLL_HINT_SELECTOR = '.page_hero-scroll'

//Texts
const TEXT_CASCADE = 0.12

//Pieces
const PIECE_OFFSET_PX = 24
const PIECE_DURATION = 0.9
const PIECE_STAGGER = 0.1
const PIECE_EASE = 'power3.out'
const PIECES_DELAY = 0.2 //after the title starts

//Debug — timing of mount / reveal, to compare with [next-case] logs. Remove once settled
const IS_DEBUG = true

export function logCaseTiming(step) {
    if (IS_DEBUG) console.log(`[case ${Math.round(performance.now())}ms] ${step}`)
}

//Geometry of the next-case stage + viewport at a step — hunting the hand-off "settle" jump
export function logStageGeometry(step, stage) {
    if (!IS_DEBUG || !stage) return
    let rect = stage.getBoundingClientRect()
    let root = document.documentElement
    logCaseTiming(`${step} — stage ${rect.left.toFixed(2)},${rect.top.toFixed(2)} ${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`
        + ` | transform: ${stage.style.transform || 'none'}`
        + ` | clientWidth ${root.clientWidth}, innerWidth ${window.innerWidth}, scrollY ${Math.round(window.scrollY)}`)
}

export class CaseHeroReveal extends Module {

    constructor({ root = null, includeScrollHint = false } = {}) {
        super()
        this.root = root
        this.includeScrollHint = includeScrollHint
    }

    setup() {
        this.hero = this.root ?? document.querySelector(HERO_SELECTOR)
        if (!this.hero) return

        this.textReveals = TEXT_SELECTORS
            .map((selector) => this.hero.querySelector(selector))
            .filter(Boolean)
            .map((element) => new SplitBlurReveal(element, { trigger: 'manual' }).mount())

        let pieceSelectors = this.includeScrollHint ? [...PIECE_SELECTORS, SCROLL_HINT_SELECTOR] : PIECE_SELECTORS
        this.pieces = pieceSelectors.map((selector) => this.hero.querySelector(selector)).filter(Boolean)
        if (this.pieces.length) gsap.set(this.pieces, { autoAlpha: 0, y: PIECE_OFFSET_PX })
        logCaseTiming(`hero mounted (${this.root ? 'stage copy' : 'page'}) — texts: ${this.textReveals.length}, pieces: ${this.pieces.length}`)
    }

    reveal({ isInstant = false } = {}) {
        if (this.revealPromise) return this.revealPromise
        logCaseTiming(`hero reveal (${this.root ? 'stage copy' : 'page'}${isInstant ? ', instant' : ''})`)

        if (isInstant) {
            this.show()
            this.revealPromise = Promise.resolve()
            return this.revealPromise
        }

        let textsLanded = (this.textReveals ?? []).map((textReveal, index) => textReveal.playIn(index * TEXT_CASCADE))
        this.revealPromise = Promise.all([...textsLanded, this.playPieces()])
        return this.revealPromise
    }

    //Everything in place right away
    show() {
        this.textReveals?.forEach((textReveal) => textReveal.show())
        if (this.pieces?.length) gsap.set(this.pieces, { autoAlpha: 1, clearProps: 'transform' })
    }

    //Animations

    playPieces() {
        if (!this.pieces?.length) return Promise.resolve()
        return new Promise((resolve) => {
            this.animate(gsap.to(this.pieces, {
                autoAlpha: 1,
                y: 0,
                duration: PIECE_DURATION,
                stagger: PIECE_STAGGER,
                ease: PIECE_EASE,
                delay: PIECES_DELAY,
                onComplete: () => {
                    gsap.set(this.pieces, { clearProps: 'transform' })
                    resolve()
                },
                onInterrupt: resolve,
            }))
        })
    }

    destroy() {
        super.destroy()
        this.textReveals?.forEach((textReveal) => textReveal.destroy())
        this.textReveals = []
        if (this.pieces?.length) gsap.set(this.pieces, { clearProps: 'opacity,visibility,transform' })
        this.pieces = []
        this.revealPromise = null
    }
}
