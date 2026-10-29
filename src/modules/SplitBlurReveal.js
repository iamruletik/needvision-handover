import { gsap, ScrollTrigger, SplitText } from '../core/gsap'
import { Module } from '../core/Module'
import { styleLineMasks } from './lineMasks'

//The site's text reveal: SplitText cuts text into masked lines, each line slides out of its
//mask while the text un-blurs. Defaults cover the common case; anything else goes in an
//options object, ScrollTrigger-style.
//
//  new SplitBlurReveal('.heading').mount()                          — each element on scroll
//  new SplitBlurReveal('.headline', { trigger: null }).mount()      — on page reveal, no scroll
//  new SplitBlurReveal('.text', { trigger: '.section', start: 'top center' }).mount()
//  let reveal = new SplitBlurReveal(element, { trigger: 'manual' }).mount()
//  await reveal.playOut(); reveal.setText('New text'); reveal.playIn()
//
//Targets: selector, element or array of elements.
//
//trigger:
//  'self'      — every element has its own ScrollTrigger (safe under sticky parents). Elements
//                crossing `start` within batchInterval cascade in DOM order, `cascade` apart.
//  selector / element — all elements play off that one element, cascading in DOM order
//  null        — no scroll: plays on page reveal, cascading in DOM order (pages that never scroll)
//  'manual'    — never plays by itself; drive it with playIn() / playOut() / setText()
//Automatic modes play once, and only after reveal() (preloader / eye transition done) unless
//waitForPageReveal is false.
//
//direction — 'up': lines rise from below; 'down': drop from above. `out.direction` the same
//for where they leave to. setDirection() flips both at runtime. offset must push a line fully past the bled mask edge:
//offset * lineHeight > lineHeight + 2 * bleed (+ glyph overhang) — 150 covers 0.9 / 0.2em.
//
//by — what moves: 'lines' (default) or 'words'. Words still sit in per-line masks; `stagger`
//then runs word by word, so keep it small on long texts (30 words × 0.08 = 2.4s).
//
//blurOn — 'parent' (one filter layer per block, cheaper) or 'lines' (= each moving unit).
//blur: 0 turns it off.
//Mask styling (glyph bleed, first-line indent) lives in lineMasks.js.
//
//autoSplit re-splits on font load / width change; a re-split lands on whatever the element
//is meant to show right now (hidden, shown or out), never mid-tween.

const DEFAULTS = {
    //When
    trigger: 'self',
    start: 'top 90%',
    waitForPageReveal: true,
    batchInterval: 0.1,
    cascade: 0.12, //between elements playing together (batch / shared trigger / page reveal)

    //In
    by: 'lines', //'lines' | 'words'
    direction: 'up',
    offset: 150,
    duration: 1.1,
    stagger: 0.08,
    ease: 'power3.out',
    delay: 0,

    //Out — playOut()
    out: {
        direction: 'up',
        offset: 150,
        duration: 0.4,
        stagger: 0.04,
        ease: 'power3.in',
    },

    //Look
    blur: 12,
    blurOn: 'parent',
    maskBleed: '0.2em',
    split: 'lines',
    splitOptions: {}, //extra SplitText config, e.g. { wordsClass: '…' }

    //Hooks
    onSplit: null, //(element, split) => {} — after every (re-)split, masks already styled
    onComplete: null, //(element) => {} — once per element, after its first reveal
}

const MODE_MANUAL = 'manual'
const MODE_SELF = 'self'
const BY_WORDS = 'words'
const WORD_CLASS = 'split-word'

//Where an element's lines are (or are heading)
const STATE_HIDDEN = 'hidden' //waiting on the entry side
const STATE_SHOWN = 'shown'
const STATE_OUT = 'out' //left through the exit side

export class SplitBlurReveal extends Module {

    constructor(targets, options = {}) {
        super()
        this.targets = targets
        this.options = { ...DEFAULTS, ...options, out: { ...DEFAULTS.out, ...options.out } }
    }

    setup() {
        this.isRevealed = !this.options.waitForPageReveal
        this.items = []
        this.itemsByElement = new Map()

        let elements = this.resolveTargets()
        if (elements.length === 0) return

        elements.forEach((element, index) => this.createItem(element, index))

        let { trigger } = this.options
        if (trigger === MODE_MANUAL) return

        if (trigger === null) {
            this.items.forEach((item) => {
                item.delay = item.index * this.options.cascade
                item.isInView = true
            })
            if (this.isRevealed) this.items.forEach((item) => this.tryAutoPlay(item))
            return
        }

        if (trigger === MODE_SELF) {
            this.watchEach(elements)
            return
        }

        let sharedTrigger = typeof trigger === 'string' ? document.querySelector(trigger) : trigger
        if (sharedTrigger) this.watchShared(sharedTrigger)
        else console.warn('SplitBlurReveal: trigger not found', trigger)
    }

    //Called once the screen is visible
    reveal() {
        if (this.isRevealed) return
        this.isRevealed = true
        this.items?.forEach((item) => this.tryAutoPlay(item))
    }

    //Public — manual control (works in any mode)

    //Lines into view, blur off. Resolves when every element has landed.
    //extraDelay — seconds on top of options.delay, e.g. a cascade position set by the caller
    playIn(extraDelay = 0) {
        return Promise.all((this.items ?? []).map((item) => this.animateIn(item, extraDelay)))
    }

    //Lines out through the exit side, blur back on. Resolves when every element is out
    playOut(extraDelay = 0) {
        return Promise.all((this.items ?? []).map((item) => this.animateOut(item, extraDelay)))
    }

    //New text, re-split, parked hidden on the entry side — follow with playIn().
    //"\n" becomes a forced line break (<br>); text is never parsed as markup
    setText(text) {
        this.items?.forEach((item) => {
            item.tween?.kill()
            item.split?.revert()
            this.writeText(item.element, text)
            item.state = STATE_HIDDEN
            item.split = this.createSplit(item)
        })
    }

    //Lines in place right away, no animation — e.g. content that should just be there on mount
    show() {
        this.items?.forEach((item) => {
            item.tween?.kill()
            item.hasPlayed = true
            item.state = STATE_SHOWN
            this.applyState(item)
            this.complete(item)
        })
    }

    //'up' | 'down' for both in and out — e.g. follow the scroll direction between plays.
    //Parked lines move to the new entry side right away; lines mid-tween keep their course
    setDirection(direction) {
        if (direction !== 'up' && direction !== 'down') return
        this.options.direction = direction
        this.options.out.direction = direction
        this.items?.forEach((item) => {
            if (item.state === STATE_HIDDEN && !item.tween?.isActive()) this.applyState(item)
        })
    }

    //Back to hidden on the entry side, no animation
    reset() {
        this.items?.forEach((item) => {
            item.tween?.kill()
            item.state = STATE_HIDDEN
            this.applyState(item)
        })
    }

    //Helpers

    writeText(element, text) {
        let nodes = []
        String(text ?? '').split('\n').forEach((line, index) => {
            if (index > 0) nodes.push(document.createElement('br'))
            nodes.push(document.createTextNode(line))
        })
        element.replaceChildren(...nodes)
    }

    resolveTargets() {
        let { targets } = this
        if (!targets) return []
        if (typeof targets === 'string') return [...document.querySelectorAll(targets)]
        if (targets instanceof Element) return [targets]
        return [...targets].filter((target) => target instanceof Element)
    }

    createItem(element, index) {
        let item = { element, index, delay: 0, split: null, units: [], tween: null, state: STATE_HIDDEN, isInView: false, hasPlayed: false, hasCompleted: false }
        this.items.push(item)
        this.itemsByElement.set(element, item)
        item.split = this.createSplit(item)
        return item
    }

    //Word mode needs words in the split even if `split` only asks for lines
    splitType() {
        let { split, by } = this.options
        if (by === BY_WORDS && !split.includes('words')) return `words, ${split}`
        return split
    }

    //Words always carry WORD_CLASS (main.css zeroes their inherited text-indent), plus any caller class
    createSplit(item) {
        let { splitOptions } = this.options
        return SplitText.create(item.element, {
            type: this.splitType(),
            ...splitOptions,
            wordsClass: [WORD_CLASS, splitOptions.wordsClass].filter(Boolean).join(' '),
            mask: 'lines',
            autoSplit: true,
            onSplit: (split) => this.onSplit(item, split),
        })
    }

    //Elements entering together arrive as one batch — position in the batch sets the delay
    watchEach(elements) {
        let triggers = ScrollTrigger.batch(elements, {
            start: this.options.start,
            once: true,
            interval: this.options.batchInterval,
            onEnter: (batch) => batch.forEach((element, index) => {
                let item = this.itemsByElement.get(element)
                if (!item) return
                item.delay = index * this.options.cascade
                item.isInView = true
                this.tryAutoPlay(item)
            }),
        })
        triggers.forEach((trigger) => this.animate(trigger))
    }

    //One external trigger releases every item, cascaded in DOM order
    watchShared(triggerElement) {
        this.animate(ScrollTrigger.create({
            trigger: triggerElement,
            start: this.options.start,
            once: true,
            onEnter: () => this.items.forEach((item) => {
                item.delay = item.index * this.options.cascade
                item.isInView = true
                this.tryAutoPlay(item)
            }),
        }))
    }

    onSplit(item, split) {
        item.tween?.kill()
        item.units = this.options.by === BY_WORDS ? split.words : split.lines
        styleLineMasks(split.masks, this.options.maskBleed)
        this.options.onSplit?.(item.element, split)

        //Re-split mid-tween lands on where that tween was heading
        this.applyState(item)
        if (item.state === STATE_SHOWN && item.hasPlayed) this.complete(item)
    }

    //Instant pose for the item's state
    applyState(item) {
        let { blur } = this.options
        if (!item.units?.length) return //empty text splits into nothing
        if (item.state === STATE_SHOWN) {
            gsap.set(item.units, { yPercent: 0 })
            gsap.set(this.blurTargets(item), { clearProps: 'filter' })
            return
        }
        gsap.set(item.units, { yPercent: item.state === STATE_OUT ? this.outOffset() : this.inOffset() })
        if (blur > 0) gsap.set(this.blurTargets(item), { filter: `blur(${blur}px)` })
    }

    blurTargets(item) {
        return this.options.blurOn === 'lines' ? item.units : [item.element]
    }

    //Entry side: 'up' starts below (+), 'down' above (-)
    inOffset() {
        return this.options.direction === 'down' ? -this.options.offset : this.options.offset
    }

    //Exit side: 'up' leaves above (-), 'down' below (+)
    outOffset() {
        let { direction, offset } = this.options.out
        return direction === 'down' ? offset : -offset
    }

    //Fires options.onComplete(element) once per element — also when a re-split cut the reveal short
    complete(item) {
        if (item.hasCompleted) return
        item.hasCompleted = true
        this.options.onComplete?.(item.element)
    }

    //Animations

    tryAutoPlay(item) {
        if (!this.isRevealed || !item.isInView || item.hasPlayed) return
        this.animateIn(item, item.delay)
    }

    animateIn(item, extraDelay = 0) {
        let { duration, stagger, ease, delay, blur } = this.options
        item.tween?.kill()
        item.hasPlayed = true

        //Coming back from the exit side — restart from the entry side, not across the mask
        let hasUnits = item.units?.length > 0
        if (hasUnits && item.state === STATE_OUT) gsap.set(item.units, { yPercent: this.inOffset() })
        item.state = STATE_SHOWN

        return new Promise((resolve) => {
            let timeline = gsap.timeline({
                delay: delay + extraDelay,
                //Leftover filter keeps the layer expensive — drop it once done
                onComplete: () => {
                    gsap.set(this.blurTargets(item), { clearProps: 'filter' })
                    this.complete(item)
                    resolve()
                },
                onInterrupt: resolve,
            })
            if (hasUnits) timeline.to(item.units, { yPercent: 0, duration, stagger, ease }, 0)
            if (blur > 0) timeline.to(this.blurTargets(item), { filter: 'blur(0px)', duration, ease }, 0)
            item.tween = timeline
        })
    }

    animateOut(item, extraDelay = 0) {
        let { delay, blur } = this.options
        let { duration, stagger, ease } = this.options.out
        item.tween?.kill()
        item.state = STATE_OUT

        return new Promise((resolve) => {
            let timeline = gsap.timeline({ delay: delay + extraDelay, onComplete: resolve, onInterrupt: resolve })
            if (item.units?.length) timeline.to(item.units, { yPercent: this.outOffset(), duration, stagger, ease }, 0)
            if (blur > 0) timeline.to(this.blurTargets(item), { filter: `blur(${blur}px)`, duration, ease }, 0)
            item.tween = timeline
        })
    }

    //Cleanup — revert restores the markup the split was made from

    destroy() {
        this.items?.forEach((item) => {
            item.tween?.kill()
            item.split?.revert()
            gsap.set(item.element, { clearProps: 'filter' })
        })
        this.items = []
        this.itemsByElement?.clear()
        super.destroy()
    }
}
