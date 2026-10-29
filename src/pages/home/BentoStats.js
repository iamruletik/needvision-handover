import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'
import { digitSvg, digitPlacement, hasDigitGlyph } from './bentoDigits'

//Home bento stats card — ported from the design handoff (project-clean/). Cycles through
//states: title + copy swap, dots, and a 3-digit flip clock.
//Content lives in Webflow: every .bento_header-slide is one state (its .bento_header-title,
//.bento_header-copy and data-number="120"), in slide order. The first slide is the one shown;
//the others are only read. Editing copy / numbers / order needs no code change.
//  Text   — two manual SplitBlurReveals on the first slide: out, setText, in (like CompanyTabs).
//           Clicks during a swap only move the target; one more swap runs to the latest.
//  Digits — each .bento_digit-card gets a flip clock built here (main.css "Bento Flip Clock"):
//           static halves + two flaps; top flap falls showing the old digit, bottom flap lands
//           with the new one. Changing mid-flip settles the old flip first.
//  Dots   — .stages_dot gets .is-active (main.css fades the full dot)
//  Back arrow hidden on the first state. Auto-advance every AUTO_ADVANCE_SECONDS while the
//  card is on screen; any click restarts the wait.
//  Intro — clocks start at 000 and flip to the first number the first time the card is on
//  screen after the page reveal, left to right INTRO_DIGIT_STAGGER apart.

const CARD_SELECTOR = '.bento_card'
const SLIDE_SELECTOR = '.bento_header-slide'
const SLIDE_ACTIVE_CLASS = 'active'
const TITLE_SELECTOR = '.bento_header-title'
const COPY_SELECTOR = '.bento_header-copy'
const DIGIT_CARD_SELECTOR = '.bento_digit-card'
const VALUE_WRAPPER_SELECTOR = '.bento_value-wrapper'
const DOT_SELECTOR = '.stages_dot'
const PREV_SELECTOR = '.bento_slider-back'
const NEXT_SELECTOR = '.bento_slider-next'

const FLIP_CLOCK_CLASS = 'is-flip-clock' //on the value wrapper — main.css draws the split line
const DOT_ACTIVE_CLASS = 'is-active'
const BUTTON_HIDDEN_CLASS = 'is-hidden'

const AUTO_ADVANCE_SECONDS = 20
const VISIBILITY_THRESHOLD = 0.2

//Flip — the handoff's 0.8s, linear like its keyframes
const FLIP_HALF_DURATION = 0.4
const FLIP_EASE = 'none'
const FLIP_TOP_END_ROTATION = -90
const FLIP_BOTTOM_START_ROTATION = 90

//Intro
const INTRO_START_DIGIT = '0'
const INTRO_DIGIT_STAGGER = 0.12

//Text Reveal — same feel as CompanyTabs
const TEXT_REVEAL_OPTIONS = {
    trigger: 'manual',
    duration: 0.9,
    stagger: 0.06,
    ease: 'power3.out',
    out: { duration: 0.4, stagger: 0.04, ease: 'power3.in' },
}
const COPY_DELAY = 0.08

export class BentoStats extends Module {

    setup() {
        let firstSlide = document.querySelector(SLIDE_SELECTOR)
        this.card = firstSlide?.closest(CARD_SELECTOR)
        if (!this.card) return

        this.slides = [...this.card.querySelectorAll(SLIDE_SELECTOR)]
        this.states = this.slides.map((slide) => this.readState(slide)).filter(Boolean)
        this.title = firstSlide.querySelector(TITLE_SELECTOR)
        this.copy = firstSlide.querySelector(COPY_SELECTOR)
        this.digitCards = [...this.card.querySelectorAll(DIGIT_CARD_SELECTOR)]
        if (this.states.length === 0 || !this.title || !this.copy || this.digitCards.length === 0) {
            console.warn('BentoStats: slides, texts or digit cards missing, skipping')
            return
        }

        this.valueWrapper = this.card.querySelector(VALUE_WRAPPER_SELECTOR)
        this.dots = [...this.card.querySelectorAll(DOT_SELECTOR)]
        this.prevButton = this.card.querySelector(PREV_SELECTOR)
        this.nextButton = this.card.querySelector(NEXT_SELECTOR)

        this.originalTexts = { title: this.title.innerHTML, copy: this.copy.innerHTML }
        this.slides.forEach((slide) => slide.classList.toggle(SLIDE_ACTIVE_CLASS, slide === firstSlide))

        //activeIndex — what the controls show; displayedIndex — whose text is on screen
        this.activeIndex = 0
        this.displayedIndex = 0
        this.isTextAnimating = false
        this.isDestroyed = false
        this.isOnScreen = false
        this.autoAdvance = null
        this.isRevealed = false
        this.hasIntroPlayed = false

        //First state as-is: Webflow already shows the first slide's text
        this.titleReveal = new SplitBlurReveal(this.title, TEXT_REVEAL_OPTIONS).mount()
        this.copyReveal = new SplitBlurReveal(this.copy, { ...TEXT_REVEAL_OPTIONS, delay: COPY_DELAY }).mount()
        this.renderText(0)
        this.textReveals().forEach((reveal) => reveal.playIn())

        this.valueWrapper?.classList.add(FLIP_CLOCK_CLASS)
        this.flips = this.digitCards.map((card) => this.buildFlipClock(card))
        this.showNumber(INTRO_START_DIGIT.repeat(this.flips.length), { instant: true })
        this.updateControls()

        if (this.prevButton) this.listen(this.prevButton, 'click', (event) => this.onArrowClick(event, -1))
        if (this.nextButton) this.listen(this.nextButton, 'click', (event) => this.onArrowClick(event, 1))

        //Auto-advance only while visible — no hidden swaps, no timer running off screen
        this.observe(new IntersectionObserver(([entry]) => {
            this.isOnScreen = entry.isIntersecting
            this.tryPlayIntro()
            this.restartAutoAdvance()
        }, { threshold: VISIBILITY_THRESHOLD })).observe(this.card)
    }

    //Called once the screen is visible
    reveal() {
        if (!this.flips || this.isRevealed) return
        this.isRevealed = true
        this.tryPlayIntro()
    }

    //Helpers

    readState(slide) {
        let title = slide.querySelector(TITLE_SELECTOR)?.textContent.trim() ?? ''
        let copy = slide.querySelector(COPY_SELECTOR)?.textContent.trim() ?? ''
        let number = (slide.dataset.number ?? '').trim()
        if (!number) {
            console.warn('BentoStats: slide without data-number, skipped', slide)
            return null
        }
        return { title, copy, number }
    }

    textReveals() {
        return [this.titleReveal, this.copyReveal]
    }

    renderText(index) {
        let state = this.states[index]
        this.titleReveal.setText(state.title)
        this.copyReveal.setText(state.copy)
        this.displayedIndex = index
    }

    updateControls() {
        this.dots.forEach((dot, index) => dot.classList.toggle(DOT_ACTIVE_CLASS, index === this.activeIndex))
        this.prevButton?.classList.toggle(BUTTON_HIDDEN_CLASS, this.activeIndex === 0)
    }

    onArrowClick(event, direction) {
        event.preventDefault()
        this.goTo(this.activeIndex + direction)
        this.restartAutoAdvance()
    }

    //Wraps around both ways
    goTo(index) {
        let count = this.states.length
        let nextIndex = ((index % count) + count) % count
        if (nextIndex === this.activeIndex) return

        this.activeIndex = nextIndex
        this.updateControls()
        this.showNumber(this.states[nextIndex].number)
        if (!this.isTextAnimating) this.playTextSwap()
    }

    restartAutoAdvance() {
        this.autoAdvance?.kill()
        this.autoAdvance = null
        if (!this.isOnScreen || this.isDestroyed) return
        this.autoAdvance = this.animate(gsap.delayedCall(AUTO_ADVANCE_SECONDS, () => {
            this.goTo(this.activeIndex + 1)
            this.restartAutoAdvance()
        }))
    }

    //Flip Clock — DOM

    //half: 'top' | 'bottom'; isFlap — the moving copy on top of the static half
    createHalf(half, isFlap) {
        let element = document.createElement('div')
        element.className = `bento-flip__half is-${half}${isFlap ? ' is-flap' : ''}`
        let face = document.createElement('div')
        face.className = 'bento-flip__face'
        element.appendChild(face)
        return element
    }

    buildFlipClock(card) {
        let root = document.createElement('div')
        root.className = 'bento-flip'

        let staticTop = this.createHalf('top', false)
        let staticBottom = this.createHalf('bottom', false)
        let flapLayer = document.createElement('div')
        flapLayer.className = 'bento-flip__flaps'
        let flapTop = this.createHalf('top', true)
        let flapBottom = this.createHalf('bottom', true)
        flapLayer.append(flapTop, flapBottom)
        root.append(staticTop, staticBottom, flapLayer)
        card.appendChild(root)

        return { card, root, staticTop, staticBottom, flapTop, flapBottom, digit: null, targetDigit: null, timeline: null, pendingCall: null }
    }

    //Glyph into one half's face — full-card-size face, so the same % placement works in both halves
    setFace(half, digit) {
        let face = half.firstElementChild
        let svg = digitSvg(digit)
        face.innerHTML = svg ?? ''
        let glyph = face.firstElementChild
        if (!glyph) return
        glyph.classList.add('bento-flip__digit')
        Object.assign(glyph.style, digitPlacement(digit))
    }

    //Flip Clock — Animations

    //000 → first number, once. A click before it (card already on screen) makes it moot:
    //showNumber() takes over from 000 the same way
    tryPlayIntro() {
        if (!this.isRevealed || !this.isOnScreen || this.hasIntroPlayed) return
        this.hasIntroPlayed = true
        this.showNumber(this.states[this.activeIndex].number, { stagger: INTRO_DIGIT_STAGGER })
    }

    //stagger — seconds between digits, left to right
    showNumber(number, { instant = false, stagger = 0 } = {}) {
        let digits = number.padStart(this.flips.length, '0').slice(-this.flips.length).split('')
        digits.forEach((digit, index) => {
            if (!hasDigitGlyph(digit)) console.warn(`BentoStats: no glyph for digit "${digit}" — add it to bentoDigits.js`)
            let flip = this.flips[index]
            flip.pendingCall?.kill()
            if (stagger > 0 && index > 0) {
                flip.pendingCall = this.animate(gsap.delayedCall(index * stagger, () => this.flipTo(flip, digit, instant)))
                return
            }
            this.flipTo(flip, digit, instant)
        })
    }

    //Settled: both static halves show the digit, flaps hidden
    settle(flip, digit) {
        flip.timeline?.kill()
        flip.timeline = null
        this.setFace(flip.staticTop, digit)
        this.setFace(flip.staticBottom, digit)
        gsap.set([flip.flapTop, flip.flapBottom], { visibility: 'hidden' })
        flip.digit = digit
        flip.targetDigit = digit
    }

    flipTo(flip, digit, instant) {
        //Mid-flip: land the previous flip first, then start from there
        if (flip.timeline) this.settle(flip, flip.targetDigit)
        if (instant || flip.digit === null) {
            this.settle(flip, digit)
            return
        }
        if (flip.digit === digit) return

        let fromDigit = flip.digit
        flip.targetDigit = digit

        //Behind the flaps: new top already there, old bottom until the bottom flap covers it
        this.setFace(flip.staticTop, digit)
        this.setFace(flip.staticBottom, fromDigit)
        this.setFace(flip.flapTop, fromDigit)
        this.setFace(flip.flapBottom, digit)
        gsap.set(flip.flapTop, { visibility: 'visible', rotationX: 0 })
        gsap.set(flip.flapBottom, { visibility: 'visible', rotationX: FLIP_BOTTOM_START_ROTATION })

        flip.timeline = this.animate(gsap.timeline({ onComplete: () => this.settle(flip, digit) })
            .to(flip.flapTop, { rotationX: FLIP_TOP_END_ROTATION, duration: FLIP_HALF_DURATION, ease: FLIP_EASE })
            .to(flip.flapBottom, { rotationX: 0, duration: FLIP_HALF_DURATION, ease: FLIP_EASE }))
    }

    //Text — Animations

    //Old text out, new in; afterwards one more swap if a click moved the target meanwhile
    async playTextSwap() {
        this.isTextAnimating = true
        let targetIndex = this.activeIndex

        await Promise.all(this.textReveals().map((reveal) => reveal.playOut()))
        if (this.isDestroyed) return

        this.renderText(targetIndex)
        await Promise.all(this.textReveals().map((reveal) => reveal.playIn()))
        if (this.isDestroyed) return

        this.isTextAnimating = false
        if (this.displayedIndex !== this.activeIndex) this.playTextSwap()
    }

    //Cleanup — splits reverted, flip clocks removed, Webflow text and classes back

    destroy() {
        this.isDestroyed = true
        super.destroy()
        this.titleReveal?.destroy()
        this.copyReveal?.destroy()
        if (this.originalTexts) {
            this.title.innerHTML = this.originalTexts.title
            this.copy.innerHTML = this.originalTexts.copy
        }
        this.flips?.forEach((flip) => flip.root.remove())
        this.flips = []
        this.valueWrapper?.classList.remove(FLIP_CLOCK_CLASS)
        this.dots?.forEach((dot) => dot.classList.remove(DOT_ACTIVE_CLASS))
        this.prevButton?.classList.remove(BUTTON_HIDDEN_CLASS)
    }
}
