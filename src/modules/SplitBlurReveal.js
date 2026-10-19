import { gsap, ScrollTrigger, SplitText } from '../../core/gsap'
import { Module } from '../../core/Module'
import { styleLineMasks } from './lineMasks'

//Reusable line reveal: SplitText cuts the text into masked lines, each line rises
//out of its mask while the whole text element un-blurs — blur sits on the container,
//one filter layer per block instead of one per line.
//Usage: new SplitBlurReveal('.selector', { ...overrides }).mount()
//
//Plays when BOTH are true: page revealed (reveal() — preloader / eye done) and the element
//crossed `start`. Hero text plays right after the reveal, text further down on scroll.
//
//Every element has its own trigger (ScrollTrigger.batch) — safe under sticky parents.
//Elements crossing `start` within batchInterval of each other cascade in DOM order,
//batchStagger apart; an element arriving alone plays without delay.
//
//trigger — optional selector. All elements then play off that ONE element's position
//instead, cascading in DOM order batchStagger apart (text that sits low/sticky in its section).
//
//Mask styling (glyph bleed, first-line indent) lives in lineMasks.js.
//
//lineOffsetPercent must push the line fully past the bled mask edge:
//offset * lineHeight > lineHeight + 2 * bleed (+ glyph overhang) — 150 covers 0.9 / 0.2em.
//
//autoSplit re-splits on font load / width change; a re-split after playing just leaves
//the new lines in their final state.

const DEFAULTS = {
    start: 'top 90%',
    waitForScroll: true, //false — no ScrollTrigger, plays on reveal cascaded in DOM order (pages that never scroll)
    lineOffsetPercent: 150,
    blurStartPx: 12,
    duration: 1.1,
    stagger: 0.08,
    ease: 'power3.out',
    maskBleed: '0.2em',
    batchInterval: 0.1,
    batchStagger: 0.12,
    trigger: null,
    onComplete: null, //(element) => {} — after that element's reveal finishes
    onSplit: null, //(element, split) => {} — after every (re-)split, masks already styled
    splitOptions: {}, //extra SplitText config, e.g. { type: 'words, lines', wordsClass: '…' }
}

export class SplitBlurReveal extends Module {

    constructor(selector, options = {}) {
        super()
        this.selector = selector
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.isRevealed = false
        this.items = []
        this.itemsByElement = new Map()

        let elements = [...document.querySelectorAll(this.selector)]
        if (elements.length === 0) return

        elements.forEach((element) => this.createItem(element))

        if (!this.options.waitForScroll) {
            this.items.forEach((item, index) => {
                item.delay = index * this.options.batchStagger
                item.isInView = true
            })
            return
        }

        let sharedTrigger = this.options.trigger ? document.querySelector(this.options.trigger) : null
        if (sharedTrigger) this.watchShared(sharedTrigger)
        else this.watch(elements)
    }

    createItem(element) {
        let item = { element, delay: 0, split: null, lines: [], tween: null, isInView: false, hasPlayed: false }

        item.split = SplitText.create(element, {
            type: 'lines',
            ...this.options.splitOptions,
            mask: 'lines',
            autoSplit: true,
            onSplit: (split) => this.onSplit(item, split),
        })

        this.items.push(item)
        this.itemsByElement.set(element, item)
        return item
    }

    //Elements entering together arrive as one batch — position in the batch sets the delay
    watch(elements) {
        let triggers = ScrollTrigger.batch(elements, {
            start: this.options.start,
            once: true,
            interval: this.options.batchInterval,
            onEnter: (batch) => batch.forEach((element, index) => {
                let item = this.itemsByElement.get(element)
                if (!item) return
                item.delay = index * this.options.batchStagger
                item.isInView = true
                this.tryPlay(item)
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
            onEnter: () => this.items.forEach((item, index) => {
                item.delay = index * this.options.batchStagger
                item.isInView = true
                this.tryPlay(item)
            }),
        }))
    }

    //Called once the screen is visible
    reveal() {
        if (this.isRevealed) return
        this.isRevealed = true
        this.items?.forEach((item) => this.tryPlay(item))
    }

    //Helpers

    onSplit(item, split) {
        item.tween?.kill()
        item.lines = split.lines
        styleLineMasks(split.masks, this.options.maskBleed)
        this.options.onSplit?.(item.element, split)

        //Re-split after playing (or mid-play — the tween was just killed) lands on the final state
        if (item.hasPlayed) {
            gsap.set(item.element, { clearProps: 'filter' })
            this.complete(item)
            return
        }
        gsap.set(split.lines, { yPercent: this.options.lineOffsetPercent })
        gsap.set(item.element, { filter: `blur(${this.options.blurStartPx}px)` })
    }

    //Animations

    tryPlay(item) {
        if (!this.isRevealed || !item.isInView || item.hasPlayed) return
        item.hasPlayed = true

        let { duration, stagger, ease } = this.options
        item.tween = gsap.timeline({
            delay: item.delay,
            //Leftover filter keeps the layer expensive — drop it once done
            onComplete: () => {
                gsap.set(item.element, { clearProps: 'filter' })
                this.complete(item)
            },
        })
            .to(item.lines, { yPercent: 0, duration, stagger, ease }, 0)
            .to(item.element, { filter: 'blur(0px)', duration, ease }, 0)
    }

    //Fires options.onComplete(element) once per element — also when a re-split cut the reveal short
    complete(item) {
        if (item.hasCompleted) return
        item.hasCompleted = true
        this.options.onComplete?.(item.element)
    }

    //Cleanup — revert restores the original markup

    destroy() {
        this.items?.forEach((item) => {
            item.tween?.kill()
            item.split?.revert()
            gsap.set(item.element, { clearProps: 'filter' })
        })
        this.items = []
        super.destroy()
    }
}
