import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//One-shot drum number — e.g. "$4,3M" or "7": every digit becomes a masked 0-9 drum parked
//on 0, play() rolls each one forward a full turn plus its digit, left digit first. Letters
//and punctuation stay put. Same DOM + CSS as ProfitCounter (main.css "Profit Counter"),
//without the live ticking. Only the first text node with a digit is replaced; destroy()
//puts it back.

const DIGIT_PERCENT = 5 //strip holds 0-9 twice (20 digits) — one digit is 5% of its height
const STRIP_DIGIT_COUNT = 20
const EXTRA_TURN = 10 //roll through a full 0-9 before landing — lands on the strip's second set

const ROLL_DURATION = 1.2
const ROLL_EASE = 'power3.out'
const ROLL_STAGGER = 0.06

const HOST_CLASS = 'profit-counter'
const CHAR_CLASS = 'profit-counter__char'
const SLOT_CLASS = 'profit-counter__slot'
const STRIP_CLASS = 'profit-counter__strip'

export class DrumNumber extends Module {

    constructor(element) {
        super()
        this.element = element
    }

    setup() {
        this.textNode = this.findDigitTextNode()
        if (!this.textNode) return

        this.host = document.createElement('span')
        this.host.className = HOST_CLASS
        this.host.setAttribute('aria-label', this.textNode.textContent)
        this.slots = []

        Array.from(this.textNode.textContent).forEach((character) => {
            let unit = /\d/.test(character) ? this.createSlot(Number(character)) : this.createLetter(character)
            unit.setAttribute('aria-hidden', 'true')
            this.host.appendChild(unit)
        })
        this.textNode.replaceWith(this.host)
    }

    //Helpers

    findDigitTextNode() {
        if (!this.element) return null
        let walker = document.createTreeWalker(this.element, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
            if (/\d/.test(walker.currentNode.textContent)) return walker.currentNode
        }
        return null
    }

    createLetter(character) {
        let letter = document.createElement('span')
        letter.className = CHAR_CLASS
        letter.textContent = character
        return letter
    }

    createSlot(digit) {
        let slot = document.createElement('span')
        slot.className = SLOT_CLASS
        let strip = document.createElement('span')
        strip.className = STRIP_CLASS
        for (let index = 0; index < STRIP_DIGIT_COUNT; index++) {
            let digitElement = document.createElement('span')
            digitElement.textContent = String(index % 10)
            strip.appendChild(digitElement)
        }
        slot.appendChild(strip)
        gsap.set(strip, { yPercent: 0 })
        this.slots.push({ strip, digit })
        return slot
    }

    //Animations

    play(delay = 0) {
        this.slots?.forEach(({ strip, digit }, index) => {
            this.animate(gsap.fromTo(strip,
                { yPercent: 0 },
                {
                    yPercent: -(digit + EXTRA_TURN) * DIGIT_PERCENT,
                    duration: ROLL_DURATION,
                    delay: delay + index * ROLL_STAGGER,
                    ease: ROLL_EASE,
                }
            ))
        })
    }

    //Cleanup — the original text node back in place of the host

    destroy() {
        super.destroy()
        if (!this.host) return
        this.host.replaceWith(this.textNode)
        this.host = null
        this.slots = []
    }
}
