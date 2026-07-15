import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Odometer-style drum counter on every .amount-counter / .menu_amount-counter.
//One shared amount + one timer — all counters on the page tick in sync.
//Each digit sits in a masked slot over a 0-9 strip; changed digits roll down
//like a real odometer (strip holds 0-9 twice so 9 -> 0 wraps forward).

const START_AMOUNT = 400800400
const INCREMENT = 15
const MIN_INTERVAL_MS = 15000
const MAX_INTERVAL_MS = 20000
const ROLL_DURATION = 1.4
const ROLL_EASE = 'power4.out'
const ROLL_STAGGER = 0.06

export class AmountCounter extends Module {

    setup() {
        this.counterElements = [...document.querySelectorAll('.amount-counter, .menu_amount-counter')]
        if (this.counterElements.length === 0) return

        this.amount = START_AMOUNT
        this.drums = this.counterElements.map((element) => this.buildDrum(element))
        this.scheduleNextTick()
    }

    //Drum Construction

    buildDrum(element) {
        let formatted = this.formatAmount(this.amount)
        let slots = []

        element.textContent = ''
        element.classList.add('counter')

        ;[...formatted].forEach((char) => {
            if (char < '0' || char > '9') {
                let separator = document.createElement('span')
                separator.className = 'counter__separator'
                separator.textContent = char
                element.appendChild(separator)
                slots.push(null)
                return
            }

            let slot = document.createElement('span')
            slot.className = 'counter__slot'

            let strip = document.createElement('span')
            strip.className = 'counter__strip'
            for (let i = 0; i < 20; i++) {
                let digit = document.createElement('span')
                digit.textContent = String(i % 10)
                strip.appendChild(digit)
            }
            slot.appendChild(strip)
            element.appendChild(slot)

            let value = Number(char)
            gsap.set(strip, { y: `${-value}em` })
            slots.push({ strip, value })
        })

        return { element, slots }
    }

    formatAmount(value) {
        return new Intl.NumberFormat('en-US').format(value).replaceAll(',', ' ')
    }

    //Ticking

    scheduleNextTick() {
        let interval = gsap.utils.random(MIN_INTERVAL_MS, MAX_INTERVAL_MS)
        this.later(() => {
            this.amount += INCREMENT
            this.drums.forEach((drum) => this.updateDrum(drum))
            this.scheduleNextTick()
        }, interval)
    }

    updateDrum(drum) {
        let formatted = this.formatAmount(this.amount)

        //Digit count changed (crossed a thousands boundary) — rebuild from scratch
        if (formatted.length !== drum.slots.length) {
            Object.assign(drum, this.buildDrum(drum.element))
            return
        }

        let rollIndex = 0
        ;[...formatted].forEach((char, index) => {
            let slot = drum.slots[index]
            if (!slot) return

            let nextValue = Number(char)
            if (nextValue === slot.value) return

            this.rollSlot(slot, nextValue, rollIndex * ROLL_STAGGER)
            rollIndex++
        })
    }

    rollSlot(slot, nextValue, delay) {
        //Always roll forward — wrap through the second 0-9 half of the strip
        let target = nextValue > slot.value ? nextValue : nextValue + 10

        this.animate(gsap.fromTo(slot.strip,
            { y: `${-slot.value}em` },
            {
                y: `${-target}em`,
                duration: ROLL_DURATION,
                ease: ROLL_EASE,
                delay,
                onComplete: () => gsap.set(slot.strip, { y: `${-nextValue}em` }),
            }
        ))
        slot.value = nextValue
    }
}
