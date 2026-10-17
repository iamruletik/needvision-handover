import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { liveProfit, formatAmount, findNumberTextNode } from '../core/LiveCounter'

//Live drum label — e.g. "$400 800 374 CLIENTS PROFIT", the number driven by a LiveCounter
//(liveProfit unless another is passed: new ProfitCounter(element, liveMenuLargeCounter)).
//Only the text node holding the number is replaced — by a .profit-counter host span; other
//children of the element (e.g. .money-counter-dollar-sign) are never touched. That text
//node's text before / after the number stays as letters; each digit becomes a drum slot
//(masked 0-9 strip, styles in main.css "Profit Counter"). Every second, changed digits roll
//forward like an odometer.
//
//`units` (letters + digit slots, in reading order) is what an outer reveal animates —
//HeaderCompact rises them letter by letter. The drums roll on the strips inside the
//slots, so a reveal and a roll never touch the same element.
//Never goes backwards within a visit: a later clock correction only ever holds the number.

const DIGIT_PERCENT = 5 //strip holds 0-9 twice (20 digits) — one digit is 5% of its height
//Ticks are 1s apart — a roll (plus its stagger) must land before the next one or it gets cut
const ROLL_DURATION = 0.85
const ROLL_EASE = 'power3.out'
const ROLL_STAGGER = 0.02 //left digit first, like a real odometer carrying over

const HOST_CLASS = 'profit-counter'

export class ProfitCounter extends Module {

    constructor(element, counter = liveProfit) {
        super()
        this.element = element
        this.counter = counter
    }

    setup() {
        if (!this.element) return

        let numberText = findNumberTextNode(this.element)
        if (!numberText) {
            console.warn('ProfitCounter: no number found in', this.element)
            return
        }

        //Host replaces only the number's text node — siblings stay exactly as Webflow made them
        this.originalTextNode = numberText.node
        this.host = document.createElement('span')
        this.host.className = HOST_CLASS
        numberText.node.replaceWith(this.host)

        this.prefix = numberText.prefix
        this.suffix = numberText.suffix
        this.units = []
        this.slots = []
        this.lastValue = 0

        this.build(this.formatValue(this.nextValue()))

        //Tick on whole-second boundaries, then every second
        this.later(() => {
            this.tick()
            this.every(() => this.tick(), 1000)
        }, this.counter.msUntilNextSecond())
    }

    //Helpers

    //Clamped so a late server-clock correction can't make the number drop
    nextValue() {
        this.lastValue = Math.max(this.counter.current(), this.lastValue)
        return this.lastValue
    }

    formatValue(value) {
        return formatAmount(value)
    }

    createLetter(character) {
        let letter = document.createElement('span')
        letter.className = 'profit-counter__char'
        letter.textContent = character
        return letter
    }

    createSlot(digit) {
        let slot = document.createElement('span')
        slot.className = 'profit-counter__slot'

        let strip = document.createElement('span')
        strip.className = 'profit-counter__strip'
        for (let index = 0; index < 20; index++) {
            let digitElement = document.createElement('span')
            digitElement.textContent = String(index % 10)
            strip.appendChild(digitElement)
        }
        slot.appendChild(strip)
        gsap.set(strip, { yPercent: -digit * DIGIT_PERCENT })

        this.slots.push({ strip, value: digit })
        return slot
    }

    //Whole label from scratch — first render, or when the digit count changes (1 000 000 000)
    build(formattedNumber) {
        //A rebuild mid-reveal keeps whatever offset the old units had
        let carriedOffset = this.units.length ? gsap.getProperty(this.units[0], 'yPercent') : 0

        this.slots.forEach(({ strip }) => gsap.killTweensOf(strip))
        this.host.textContent = ''
        this.host.setAttribute('aria-label', this.prefix + formattedNumber + this.suffix)
        this.units = []
        this.slots = []

        let append = (unit) => {
            unit.setAttribute('aria-hidden', 'true')
            this.host.appendChild(unit)
            this.units.push(unit)
        }

        Array.from(this.prefix).forEach((character) => append(this.createLetter(character)))
        Array.from(formattedNumber).forEach((character) => {
            append(/\d/.test(character) ? this.createSlot(Number(character)) : this.createLetter(character))
        })
        Array.from(this.suffix).forEach((character) => append(this.createLetter(character)))

        if (carriedOffset) gsap.set(this.units, { yPercent: carriedOffset })
        this.formattedNumber = formattedNumber
    }

    //Animations

    tick() {
        let formattedNumber = this.formatValue(this.nextValue())
        if (formattedNumber === this.formattedNumber) return

        if (formattedNumber.length !== this.formattedNumber.length) {
            this.build(formattedNumber)
            return
        }

        this.host.setAttribute('aria-label', this.prefix + formattedNumber + this.suffix)
        let digits = formattedNumber.replace(/\D/g, '')
        let rollIndex = 0
        this.slots.forEach((slot, index) => {
            let nextDigit = Number(digits[index])
            if (nextDigit === slot.value) return
            this.rollSlot(slot, nextDigit, rollIndex * ROLL_STAGGER)
            rollIndex++
        })
        this.formattedNumber = formattedNumber
    }

    //Always forward — 9 -> 0 runs into the strip's second 0-9, then snaps back to the first.
    //Untracked by this.animate() — several rolls a second for the whole session would only
    //grow its list; strips are killed by target on rebuild and destroy instead
    rollSlot(slot, nextDigit, delay) {
        let target = nextDigit > slot.value ? nextDigit : nextDigit + 10

        gsap.killTweensOf(slot.strip)
        gsap.fromTo(slot.strip,
            { yPercent: -slot.value * DIGIT_PERCENT },
            {
                yPercent: -target * DIGIT_PERCENT,
                duration: ROLL_DURATION,
                ease: ROLL_EASE,
                delay,
                onComplete: () => gsap.set(slot.strip, { yPercent: -nextDigit * DIGIT_PERCENT }),
            }
        )
        slot.value = nextDigit
    }

    //Cleanup — the original text node back in place of the host

    destroy() {
        super.destroy()
        if (!this.host) return
        this.slots?.forEach(({ strip }) => gsap.killTweensOf(strip))
        this.host.replaceWith(this.originalTextNode)
        this.host = null
        this.units = []
        this.slots = []
    }
}
