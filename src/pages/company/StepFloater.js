import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Fixed step floater (counter + name) follows whichever section sits at viewport center.
//Text swaps letter by letter through JS-injected overflow masks: old letters roll out,
//new ones roll in, direction follows scroll direction.
//Stays hidden until reveal() (preloader / eye transition done), fades out once the
//cards wrapper ends — the footer is fixed underneath, content scrolling away uncovers it.

const STEPS = [
    { section: '.companypage_hero', counter: '•', name: 'О компании' },
    { section: '.companypage_tabs-section', counter: '1', name: 'Услуги' },
    { section: '.companypage_steps-container', counter: '2', name: 'Как появились' },
    { section: '.companypage_cards-wrapper', counter: '3', name: 'Кейсы' },
]
const HIDE_TRIGGER_SELECTOR = '.companypage_cards-wrapper'

//Section Tracking
const STEP_TRIGGER_START = 'top center'
const STEP_TRIGGER_END = 'bottom center'
const HIDE_TRIGGER_START = 'bottom bottom' //cards end reaches viewport bottom, footer starts showing

//Letter Roll
const LETTER_OFFSET_PERCENT = 110
const LETTER_EXIT_DURATION = 0.3
const LETTER_EXIT_STAGGER = 0.015
const LETTER_EXIT_EASE = 'power3.in'
const LETTER_ENTER_DURATION = 0.55
const LETTER_ENTER_STAGGER = 0.025
const LETTER_ENTER_EASE = 'power3.out'
const NAME_DELAY = 0.06 //name trails the counter slightly

//Floater Fade
const FADE_DURATION = 0.4
const FADE_EASE = 'power2.out'

//Mask bleed so Cyrillic descenders (у, д, р) aren't clipped
const MASK_BLEED = '0.15em'

const LETTER_CLASS = 'companypage_step-floater-letter'
const MASK_CLASS = 'companypage_step-floater-mask'

export class StepFloater extends Module {

    setup() {
        this.floater = document.querySelector('.companypage_step-floater')
        if (!this.floater) return

        this.counter = this.floater.querySelector('.companypage_step-floater-counter')
        this.name = this.floater.querySelector('.companypage_step-floater-name')
        if (!this.counter || !this.name) return

        this.isRevealed = false
        this.isOverFooter = false
        this.activeStepIndex = 0
        this.swapTweens = []
        this.fadeTween = null

        this.originalTexts = { counter: this.counter.textContent, name: this.name.textContent }
        this.masks = [this.wrapInMask(this.counter), this.wrapInMask(this.name)]

        gsap.set(this.floater, { autoAlpha: 0 })

        this.createStepTriggers()
        this.createHideTrigger()
    }

    //Called once the screen is visible
    reveal() {
        if (!this.floater || this.isRevealed) return
        this.isRevealed = true

        this.swapTo(this.activeStepIndex, 1)
        this.updateVisibility()
    }

    //Triggers

    createStepTriggers() {
        STEPS.forEach((step, index) => {
            let section = document.querySelector(step.section)
            if (!section) return

            this.animate(ScrollTrigger.create({
                trigger: section,
                start: STEP_TRIGGER_START,
                end: STEP_TRIGGER_END,
                onToggle: (self) => {
                    if (self.isActive) this.goToStep(index, self.direction)
                },
            }))
        })
    }

    //No end — hidden from the start point to the bottom of the page
    createHideTrigger() {
        let hideTrigger = document.querySelector(HIDE_TRIGGER_SELECTOR)
        if (!hideTrigger) return

        this.animate(ScrollTrigger.create({
            trigger: hideTrigger,
            start: HIDE_TRIGGER_START,
            onEnter: () => this.setOverFooter(true),
            onLeaveBack: () => this.setOverFooter(false),
        }))
    }

    setOverFooter(isOverFooter) {
        this.isOverFooter = isOverFooter
        this.updateVisibility()
    }

    //Helpers

    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = MASK_CLASS
        mask.style.overflow = 'hidden'
        mask.style.paddingBottom = MASK_BLEED
        mask.style.marginBottom = `-${MASK_BLEED}`
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        return mask
    }

    renderLetters(element, text) {
        element.textContent = ''
        return Array.from(text).map((character) => {
            let letter = document.createElement('span')
            letter.className = LETTER_CLASS
            letter.style.display = 'inline-block'
            letter.textContent = character === ' ' ? ' ' : character
            element.appendChild(letter)
            return letter
        })
    }

    lettersOf(element) {
        return [...element.querySelectorAll(`.${LETTER_CLASS}`)]
    }

    track(tween) {
        this.swapTweens.push(tween)
        return tween
    }

    killSwap() {
        this.swapTweens?.forEach((tween) => tween.kill())
        this.swapTweens = []
    }

    //Animations

    goToStep(index, direction) {
        if (index === this.activeStepIndex) return
        this.activeStepIndex = index

        //Before reveal only remember the step — reveal() renders it
        if (!this.isRevealed) return
        this.swapTo(index, direction)
    }

    swapTo(index, direction) {
        let step = STEPS[index]
        if (!step) return

        //Interrupted swaps restart from wherever the letters currently are
        this.killSwap()
        this.swapField(this.counter, step.counter, direction, 0)
        this.swapField(this.name, step.name, direction, NAME_DELAY)
    }

    //Scrolling down: old letters exit up, new rise from below. Up: mirrored.
    swapField(element, text, direction, delay) {
        let exitPercent = direction < 0 ? LETTER_OFFSET_PERCENT : -LETTER_OFFSET_PERCENT
        let oldLetters = this.lettersOf(element)

        let enter = () => {
            let newLetters = this.renderLetters(element, text)
            this.track(gsap.fromTo(newLetters,
                { yPercent: -exitPercent },
                {
                    yPercent: 0,
                    duration: LETTER_ENTER_DURATION,
                    stagger: LETTER_ENTER_STAGGER,
                    ease: LETTER_ENTER_EASE,
                }
            ))
        }

        //First render — original Webflow text was never split, nothing to roll out
        if (oldLetters.length === 0) {
            this.track(gsap.delayedCall(delay, enter))
            return
        }

        this.track(gsap.to(oldLetters, {
            yPercent: exitPercent,
            duration: LETTER_EXIT_DURATION,
            stagger: LETTER_EXIT_STAGGER,
            ease: LETTER_EXIT_EASE,
            delay,
            onComplete: enter,
        }))
    }

    updateVisibility() {
        let shouldShow = this.isRevealed && !this.isOverFooter
        this.fadeTween?.kill()
        this.fadeTween = gsap.to(this.floater, {
            autoAlpha: shouldShow ? 1 : 0,
            duration: FADE_DURATION,
            ease: FADE_EASE,
        })
    }

    //Cleanup — unwrap masks and restore Webflow text

    destroy() {
        this.killSwap()
        this.fadeTween?.kill()

        this.masks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) mask.parentNode?.insertBefore(element, mask)
            mask.remove()
        })
        this.masks = null

        if (this.originalTexts) {
            if (this.counter) this.counter.textContent = this.originalTexts.counter
            if (this.name) this.name.textContent = this.originalTexts.name
        }
        if (this.floater) gsap.set(this.floater, { clearProps: 'opacity,visibility' })

        super.destroy()
    }
}
