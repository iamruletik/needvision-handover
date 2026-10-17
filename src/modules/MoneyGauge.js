import { gsap } from '../core/gsap'
import { Module } from '../core/Module'
import { MENU_OPEN_EVENT, MENU_CLOSE_EVENT } from './HeaderCompact'
import { GAUGE_FADE_AT } from './MenuReveal'

//Menu speedometer (.money-counter-svg). One progress value (0..1) drives both the bar
//(.gauge-progress stroke-dashoffset, pathLength 100) and the needle (.gauge-needle rotation
//around the gauge center — -90° empty, +90° full).
//  1. First time the user opens the menu: fills 0 → FILL_TARGET, starting together with the
//     gauge's fade in MenuReveal (open event's revealDelay + GAUGE_FADE_AT). Closed before
//     that moment: the fill is called off and waits for the next open.
//  2. From then on, every second it reads the counter's growth for that second (2..98) and
//     maps it into IDLE_MIN..IDLE_MAX — rocks back and forth in step with the drum ticks.
//     Clamped to MAX_PROGRESS: never reaches the end.

const GAUGE_SELECTOR = '.money-counter-svg .gauge'
const NEEDLE_PIVOT = '74.97 74.97' //gauge center in viewBox units
const NEEDLE_EMPTY_ROTATION = -90
const NEEDLE_SWEEP = 180

//First Fill
const FILL_TARGET = 0.9
const FILL_DURATION = 3
const FILL_EASE = 'power3.out'

//Idle Wobble
const IDLE_MIN = 0.74
const IDLE_MAX = 0.92
const IDLE_DURATION = 1.3 //longer than a tick on purpose — each tick re-aims from where the needle is
const IDLE_EASE = 'power2.inOut'
const MAX_PROGRESS = 0.95
const STEP_MIN = 2
const STEP_MAX = 98

export class MoneyGauge extends Module {

    constructor(counter) {
        super()
        this.counter = counter
    }

    setup() {
        this.gauges = [...document.querySelectorAll(GAUGE_SELECTOR)]
            .map((svg) => ({ progress: svg.querySelector('.gauge-progress'), needle: svg.querySelector('.gauge-needle') }))
            .filter(({ progress, needle }) => progress && needle)
        if (this.gauges.length === 0) return

        this.state = { progress: 0 }
        this.hasFilled = false
        this.progressTween = null
        this.pendingFill = null

        this.gauges.forEach(({ needle }) => gsap.set(needle, { svgOrigin: NEEDLE_PIVOT }))
        this.render()

        this.listen(document, MENU_OPEN_EVENT, (event) => this.onMenuOpen(event))
        this.listen(document, MENU_CLOSE_EVENT, () => this.onMenuClose())
    }

    //Animations

    onMenuOpen(event) {
        if (this.hasFilled || this.pendingFill) return
        let delay = (event?.detail?.revealDelay ?? 0) + GAUGE_FADE_AT
        this.pendingFill = gsap.delayedCall(delay, () => {
            this.pendingFill = null
            this.hasFilled = true
            this.tweenTo(FILL_TARGET, FILL_DURATION, FILL_EASE, () => this.startIdle())
        })
    }

    onMenuClose() {
        this.pendingFill?.kill()
        this.pendingFill = null
    }

    //Wobble ticks land on whole seconds — same moment the drum counter rolls
    startIdle() {
        this.later(() => {
            this.idleTick()
            this.every(() => this.idleTick(), 1000)
        }, this.counter?.msUntilNextSecond() ?? 0)
    }

    idleTick() {
        let step = this.counter?.currentStep() ?? (STEP_MIN + STEP_MAX) / 2
        let stepFraction = (step - STEP_MIN) / (STEP_MAX - STEP_MIN)
        let target = Math.min(IDLE_MIN + stepFraction * (IDLE_MAX - IDLE_MIN), MAX_PROGRESS)
        this.tweenTo(target, IDLE_DURATION, IDLE_EASE)
    }

    //Untracked by this.animate() — one tween per second for the whole session would only grow
    //its list; the previous one is killed here and the last one on destroy
    tweenTo(progress, duration, ease, onComplete) {
        this.progressTween?.kill()
        this.progressTween = gsap.to(this.state, {
            progress,
            duration,
            ease,
            onUpdate: () => this.render(),
            onComplete,
        })
    }

    render() {
        let progress = this.state.progress
        this.gauges.forEach(({ progress: bar, needle }) => {
            bar.style.strokeDashoffset = String(100 - progress * 100)
            gsap.set(needle, { rotation: NEEDLE_EMPTY_ROTATION + NEEDLE_SWEEP * progress })
        })
    }

    //Cleanup

    destroy() {
        this.pendingFill?.kill()
        this.pendingFill = null
        this.progressTween?.kill()
        super.destroy()
        this.gauges?.forEach(({ progress, needle }) => {
            progress.style.strokeDashoffset = ''
            gsap.set(needle, { clearProps: 'transform' })
        })
        this.gauges = []
    }
}
