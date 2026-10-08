import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Steps year counter — .counter-headline shows the year of whichever
//.companypage_step-content sits at viewport center. Only the last digit moves:
//it sits in a masked slot over a vertical 0-9 strip and rolls through every digit
//in between (2020 -> 2024 passes 1, 2, 3). Scrolling back rolls the drum back down.
//Styles: main.css "Steps Year Counter".
//
//Notches — the .counter-notch column is scrubbed by scroll across the steps. Its
//position (in notch pitches) passes through the same values as the drum: one segment
//per step, step i -> step i+1 goes digit[i] -> digit[i+1] (0 -> 4 -> 6), so notches and
//drum agree whenever a step activates. The last step keeps going LAST_STEP_TRAVEL more.
//Segments are equal length — assumes the steps are roughly equally tall.
//Fake continuous motion: only the fractional part moves the column (0..1 pitch) — at
//every whole pitch each notch sits exactly where its neighbour was, at the same scale,
//so the wrap is invisible. scaleX follows each notch's live slot on a sine: 0 top,
//1 middle, 0 bottom.

const COUNTER_SELECTOR = '.companypage_steps-counter .counter-headline'
const NOTCHES_SELECTOR = '.companypage_steps-counter-notches'
const NOTCH_SELECTOR = '.counter-notch'
const FALLBACK_PITCH_PX = 51 //88px - 37px padding from Webflow, used if it can't be measured
const STEP_SELECTOR = '.companypage_steps-container .companypage_step-content'

//Year per step, by step order. Only the last digit may differ.
const STEP_YEARS = ['2020', '2024', '2026']

const STEP_TRIGGER_START = 'top center'
const STEP_TRIGGER_END = 'bottom center'

const ROLL_DURATION = 1
const ROLL_EASE = 'power3.inOut'

//Notch Scrub
const NOTCH_SCRUB = 0.6 //seconds of smoothing behind the scroll
const LAST_STEP_TRAVEL = 2 //pitches the notches keep moving through the last step

//Strip holds 10 digits — one digit is 10% of its height
const DIGIT_PERCENT = 10

export class StepsYearCounter extends Module {

    setup() {
        this.counters = [...document.querySelectorAll(COUNTER_SELECTOR)]
        if (this.counters.length === 0) return

        this.originalTexts = this.counters.map((counter) => counter.textContent)
        this.strips = this.counters.map((counter) => this.buildDrum(counter))
        this.setStripPercents = this.strips.map((strip) => gsap.quickSetter(strip, 'yPercent'))

        this.notchColumns = this.setupNotchColumns()

        this.activeDigit = this.lastDigitOf(STEP_YEARS[0])
        this.drumState = { position: this.activeDigit }
        this.notchState = { position: this.activeDigit }
        this.rollTween = null
        this.renderDrum()
        this.renderNotches()

        this.createStepTriggers()
        this.createNotchScrub()
    }

    setupNotchColumns() {
        return [...document.querySelectorAll(NOTCHES_SELECTOR)]
            .map((column) => {
                let notches = [...column.querySelectorAll(NOTCH_SELECTOR)]
                if (notches.length < 2) return null

                let measuredPitch = notches[1].offsetTop - notches[0].offsetTop
                return {
                    column,
                    notches,
                    pitch: measuredPitch > 0 ? measuredPitch : FALLBACK_PITCH_PX,
                    setColumnY: gsap.quickSetter(column, 'y', 'px'),
                    setScales: notches.map((notch) => gsap.quickSetter(notch, 'scaleX')),
                }
            })
            .filter(Boolean)
    }

    createStepTriggers() {
        document.querySelectorAll(STEP_SELECTOR).forEach((step, index) => {
            let year = STEP_YEARS[index]
            if (!year) return

            this.animate(ScrollTrigger.create({
                trigger: step,
                start: STEP_TRIGGER_START,
                end: STEP_TRIGGER_END,
                onToggle: (self) => {
                    if (self.isActive) this.rollTo(this.lastDigitOf(year))
                },
            }))
        })
    }

    //One scrubbed timeline across all steps, one equal segment per step
    createNotchScrub() {
        let steps = [...document.querySelectorAll(STEP_SELECTOR)].slice(0, STEP_YEARS.length)
        if (this.notchColumns.length === 0 || steps.length === 0) return

        let digits = STEP_YEARS.slice(0, steps.length).map((year) => this.lastDigitOf(year))
        let timeline = gsap.timeline({
            scrollTrigger: {
                trigger: steps[0],
                start: STEP_TRIGGER_START,
                endTrigger: steps[steps.length - 1],
                end: STEP_TRIGGER_END,
                scrub: NOTCH_SCRUB,
            },
        })

        digits.forEach((digit, index) => {
            let nextPosition = digits[index + 1] ?? digit + LAST_STEP_TRAVEL
            timeline.to(this.notchState, {
                position: nextPosition,
                duration: 1,
                ease: 'none',
                onUpdate: () => this.renderNotches(),
            })
        })

        this.animate(timeline)
    }

    //Helpers

    //"2020" -> drum > [prefix "202", slot > strip > 0..9]
    buildDrum(counter) {
        let drum = document.createElement('span')
        drum.className = 'steps-year__drum'

        let prefix = document.createElement('span')
        prefix.className = 'steps-year__prefix'
        prefix.textContent = STEP_YEARS[0].slice(0, -1)

        let slot = document.createElement('span')
        slot.className = 'steps-year__slot'

        let strip = document.createElement('span')
        strip.className = 'steps-year__strip'
        for (let digit = 0; digit < 10; digit++) {
            let digitElement = document.createElement('span')
            digitElement.className = 'steps-year__digit'
            digitElement.textContent = String(digit)
            strip.appendChild(digitElement)
        }

        slot.appendChild(strip)
        drum.append(prefix, slot)
        counter.textContent = ''
        counter.setAttribute('aria-label', STEP_YEARS[0])
        counter.appendChild(drum)
        return strip
    }

    lastDigitOf(year) {
        return Number(String(year).slice(-1))
    }

    //Animations

    //Tweens from wherever the strip is — an interrupted roll just continues to the new digit
    rollTo(digit) {
        if (digit === this.activeDigit) return
        this.activeDigit = digit

        let year = STEP_YEARS[0].slice(0, -1) + digit
        this.counters.forEach((counter) => counter.setAttribute('aria-label', year))

        this.rollTween?.kill()
        this.rollTween = this.animate(gsap.to(this.drumState, {
            position: digit,
            duration: ROLL_DURATION,
            ease: ROLL_EASE,
            onUpdate: () => this.renderDrum(),
        }))
    }

    renderDrum() {
        let position = this.drumState.position
        this.setStripPercents.forEach((setStripPercent) => setStripPercent(-position * DIGIT_PERCENT))
    }

    renderNotches() {
        let position = this.notchState.position

        //Fractional part only — the column wraps every whole pitch
        let offset = position - Math.floor(position)

        this.notchColumns.forEach(({ notches, pitch, setColumnY, setScales }) => {
            let lastIndex = notches.length - 1
            setColumnY(-offset * pitch)

            setScales.forEach((setScale, index) => {
                //Live slot, 0 = top, 1 = bottom
                let slot = Math.min(Math.max((index - offset) / lastIndex, 0), 1)
                setScale(Math.sin(Math.PI * slot))
            })
        })
    }

    //Cleanup — restore Webflow text

    destroy() {
        super.destroy()
        this.counters?.forEach((counter, index) => {
            counter.textContent = this.originalTexts[index]
            counter.removeAttribute('aria-label')
        })
        this.notchColumns?.forEach(({ column, notches }) => {
            gsap.set(column, { clearProps: 'transform' })
            gsap.set(notches, { clearProps: 'transform' })
        })
        this.counters = []
        this.strips = []
        this.notchColumns = []
    }
}
