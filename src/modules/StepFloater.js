import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { FloaterHeaderDock } from './FloaterHeaderDock'

//Fixed step floater (counter + name) follows whichever section sits at viewport center.
//Text swaps through JS-injected overflow masks, one stage after the other:
//  1. old letters roll out (direction follows scroll)
//  2. each mask resizes from the old text's width to the new one's — the content's
//     alignment moves smoothly instead of jumping
//  3. new letters roll in
//Stays hidden until reveal() (preloader / eye transition done), on steps marked hidden,
//and from the hide trigger on — the footer is fixed underneath, content scrolling away uncovers it.
//Content sits under the header and docks into the descriptor's spot on compact (FloaterHeaderDock).
//Per page: new StepFloater(steps, { hideTrigger, hideStart })
//  steps — in scroll order: { section: '.selector', counter: '1', name: 'Услуги' }
//          or { section: '.selector', hidden: true } (floater fades out there)
//  section — first rendered match (desktop / mobile copies)

const FLOATER_SELECTOR = '.companypage_step-floater'
const CONTENT_SELECTOR = '.companypage_step-floater_content'
const COUNTER_SELECTOR = '.companypage_step-floater-counter'
const NAME_SELECTOR = '.companypage_step-floater-name'

//Section Tracking
const STEP_TRIGGER_START = 'top center'
const STEP_TRIGGER_END = 'bottom center'
const HIDE_TRIGGER_START = 'bottom bottom' //default: the trigger's end reaches viewport bottom

//Letter Roll
const LETTER_OFFSET_PERCENT = 110
const LETTER_EXIT_DURATION = 0.3
const LETTER_EXIT_STAGGER = 0.015
const LETTER_EXIT_EASE = 'power3.in'
const LETTER_ENTER_DURATION = 0.55
const LETTER_ENTER_STAGGER = 0.025
const LETTER_ENTER_EASE = 'power3.out'
const NAME_DELAY = 0.06 //name trails the counter slightly

//Mask Resize — between the roll out and the roll in
const RESIZE_DURATION = 0.35
const RESIZE_EASE = 'power2.inOut'

//Floater Fade
const FADE_DURATION = 0.4
const FADE_EASE = 'power2.out'

//Mask bleed so Cyrillic descenders (у, д, р) aren't clipped
const MASK_BLEED = '0.15em'

const LETTER_CLASS = 'companypage_step-floater-letter'
const MASK_CLASS = 'companypage_step-floater-mask'

export class StepFloater extends Module {

    constructor(steps = [], { hideTrigger = null, hideStart = HIDE_TRIGGER_START } = {}) {
        super()
        this.steps = steps
        this.hideTriggerSelector = hideTrigger
        this.hideStart = hideStart
    }

    setup() {
        this.floater = document.querySelector(FLOATER_SELECTOR)
        if (!this.floater || this.steps.length === 0) return

        this.counter = this.floater.querySelector(COUNTER_SELECTOR)
        this.name = this.floater.querySelector(NAME_SELECTOR)
        if (!this.counter || !this.name) return

        this.isRevealed = false
        this.isOverFooter = false
        this.isStepHidden = false
        this.activeStepIndex = 0
        this.renderedStepIndex = -1
        this.swapTweens = []
        this.fadeTween = null

        this.originalTexts = { counter: this.counter.textContent, name: this.name.textContent }
        this.masks = [this.wrapInMask(this.counter), this.wrapInMask(this.name)]

        gsap.set(this.floater, { autoAlpha: 0 })

        this.headerDock = new FloaterHeaderDock(this.floater.querySelector(CONTENT_SELECTOR)).mount()
        this.createStepTriggers()
        this.createHideTrigger()
    }

    //Called once the screen is visible
    reveal() {
        if (!this.floater || this.isRevealed) return
        this.isRevealed = true
        this.applyStep(this.activeStepIndex, 1)
    }

    //Triggers

    //Sections can overlap (sticky ones get covered by the next): when the active step's range is
    //left, the floater falls back to another step still active, instead of keeping stale text
    createStepTriggers() {
        this.stepTriggers = this.steps.map((step, index) => {
            let section = this.firstRendered(step.section)
            if (!section) return null

            return this.animate(ScrollTrigger.create({
                trigger: section,
                start: STEP_TRIGGER_START,
                end: STEP_TRIGGER_END,
                onToggle: (self) => {
                    if (self.isActive) {
                        this.goToStep(index, self.direction)
                        return
                    }
                    if (index !== this.activeStepIndex) return
                    let fallbackIndex = this.lastActiveStepIndex()
                    if (fallbackIndex !== -1) this.goToStep(fallbackIndex, self.direction)
                },
            }))
        })
    }

    lastActiveStepIndex() {
        for (let index = this.stepTriggers.length - 1; index >= 0; index--) {
            if (this.stepTriggers[index]?.isActive) return index
        }
        return -1
    }

    //No end — hidden from the start point to the bottom of the page
    createHideTrigger() {
        let hideTrigger = this.hideTriggerSelector ? this.firstRendered(this.hideTriggerSelector) : null
        if (!hideTrigger) return

        this.animate(ScrollTrigger.create({
            trigger: hideTrigger,
            start: this.hideStart,
            onEnter: () => this.setOverFooter(true),
            onLeaveBack: () => this.setOverFooter(false),
        }))
    }

    setOverFooter(isOverFooter) {
        this.isOverFooter = isOverFooter
        this.updateVisibility()
    }

    //Helpers

    firstRendered(selector) {
        return [...document.querySelectorAll(selector)].find((element) => element.getClientRects().length > 0) ?? null
    }

    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = MASK_CLASS
        mask.style.overflow = 'hidden'
        mask.style.paddingBottom = MASK_BLEED
        mask.style.marginBottom = `-${MASK_BLEED}`
        //One line always — while the mask is narrower than new text mid-resize, it would wrap
        element.style.whiteSpace = 'nowrap'
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
            //Inline-block collapses a plain space to nothing
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

        //Before reveal only remember the step — reveal() applies it
        if (!this.isRevealed) return
        this.applyStep(index, direction)
    }

    //Hidden step: fade out, text stays. Visible: fade in, swap the text if it's another step's.
    //Coming out of hidden, the old text isn't on screen — new letters just roll in
    applyStep(index, direction) {
        let step = this.steps[index]
        if (!step) return

        let wasHidden = this.isStepHidden || this.renderedStepIndex === -1
        this.isStepHidden = Boolean(step.hidden)
        this.updateVisibility()
        if (step.hidden || index === this.renderedStepIndex) return

        //Two sections sharing a label (e.g. manifesto + bento) — no roll between them
        let renderedStep = this.steps[this.renderedStepIndex]
        let isSameText = !wasHidden && renderedStep && renderedStep.counter === step.counter && renderedStep.name === step.name
        this.renderedStepIndex = index
        if (isSameText) return

        this.swapTo(step, direction, { isFresh: wasHidden })
    }

    //Interrupted swaps restart from wherever the letters / masks currently are
    swapTo(step, direction, { isFresh = false } = {}) {
        this.killSwap()
        let exitPercent = direction < 0 ? LETTER_OFFSET_PERCENT : -LETTER_OFFSET_PERCENT
        let fields = [
            { element: this.counter, mask: this.masks[0], text: step.counter ?? '', delay: 0 },
            { element: this.name, mask: this.masks[1], text: step.name ?? '', delay: NAME_DELAY },
        ]

        let isNothingToExit = fields.every((field) => this.lettersOf(field.element).length === 0)
        if (isFresh || isNothingToExit) {
            this.enterFields(fields, exitPercent, { isResized: false })
            return
        }

        //1 — old letters out (scrolling down: up; up: down)
        let exitTimeline = gsap.timeline({ onComplete: () => this.enterFields(fields, exitPercent, { isResized: true }) })
        fields.forEach((field) => {
            let letters = this.lettersOf(field.element)
            if (!letters.length) return
            exitTimeline.to(letters, {
                yPercent: exitPercent,
                duration: LETTER_EXIT_DURATION,
                stagger: LETTER_EXIT_STAGGER,
                ease: LETTER_EXIT_EASE,
            }, field.delay)
        })
        this.track(exitTimeline)
    }

    //2 — new text in, parked on the entry side; each mask goes from its current width to the
    //new text's (measured with the inline width cleared). 3 — letters roll in
    enterFields(fields, exitPercent, { isResized }) {
        let startWidths = fields.map((field) => field.mask.getBoundingClientRect().width)
        fields.forEach((field) => {
            gsap.set(field.mask, { clearProps: 'width' })
            field.letters = this.renderLetters(field.element, field.text)
            gsap.set(field.letters, { yPercent: -exitPercent })
        })
        let endWidths = fields.map((field) => field.mask.getBoundingClientRect().width)

        let timeline = gsap.timeline()
        if (isResized) {
            fields.forEach((field, index) => {
                timeline.fromTo(field.mask,
                    { width: startWidths[index] },
                    { width: endWidths[index], duration: RESIZE_DURATION, ease: RESIZE_EASE, clearProps: 'width' },
                    0
                )
            })
        }

        let enterAt = isResized ? RESIZE_DURATION : 0
        fields.forEach((field) => {
            if (!field.letters.length) return
            timeline.to(field.letters, {
                yPercent: 0,
                duration: LETTER_ENTER_DURATION,
                stagger: LETTER_ENTER_STAGGER,
                ease: LETTER_ENTER_EASE,
            }, enterAt + field.delay)
        })
        this.track(timeline)
    }

    updateVisibility() {
        let shouldShow = this.isRevealed && !this.isOverFooter && !this.isStepHidden
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
        this.headerDock?.destroy()
        this.headerDock = null

        this.masks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) {
                element.style.removeProperty('white-space')
                mask.parentNode?.insertBefore(element, mask)
            }
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
