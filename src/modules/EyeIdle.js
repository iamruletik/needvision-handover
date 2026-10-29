import { gsap } from '../core/gsap'

//Life for the eye cursor icon (svg with #outer — eye with the iris cut out — and #retina,
//the pupil, resting in the iris centre):
//  follow(x, y)   — the retina mirrors where the mouse is on the screen: left edge → full left,
//                   top → full up, centre → centre. Stays where it is when the hover ends
//  idle blinks    — every BLINK_MIN..BLINK_MAX seconds, sometimes twice — only between start()
//                   and stop(); the owner calls them while the icon is visible
//  blink()        — one blink now that also presses the icon down (pressTarget) — a click
//Not a Module: it has no DOM of its own to set up, the owner holds and destroys it.

const RETINA_SELECTOR = '[id="retina"]'

//Follow — retina shift in svg units (viewBox 27 × 16), at a screen edge. Capped to a circle
//of this radius, so corners don't push it out: 2 keeps the 2.8 retina inside the 4.8 iris hole
const FOLLOW_MAX = 2
const FOLLOW_DURATION = 0.3
const FOLLOW_EASE = 'power3.out'

//Idle Blinks
const BLINK_MIN_SECONDS = 0.8
const BLINK_MAX_SECONDS = 2.5
const DOUBLE_BLINK_CHANCE = 0.25
const DOUBLE_BLINK_GAP = 0.12

//Blink — whole svg squashes to its middle line
const BLINK_SCALE = 0.1
const BLINK_CLOSE_DURATION = 0.08
const BLINK_OPEN_DURATION = 0.14
const BLINK_CLOSE_EASE = 'power2.in'
const BLINK_OPEN_EASE = 'power2.out'

//Press — click blink also shrinks the icon, springs back as the eye opens
const PRESS_SCALE = 0.8
const PRESS_RELEASE_DURATION = 0.35
const PRESS_RELEASE_EASE = 'back.out(2)'

export class EyeIdle {

    //pressTarget — what shrinks on a click blink; must not carry a CSS !important transform
    constructor(container, pressTarget = null) {
        this.svg = container?.querySelector('svg') ?? null
        this.retina = this.svg?.querySelector(RETINA_SELECTOR) ?? null
        this.pressTarget = pressTarget
        this.isRunning = false
        this.timeline = null
        this.nextCall = null
        this.followX = this.retina ? gsap.quickTo(this.retina, 'x', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE }) : null
        this.followY = this.retina ? gsap.quickTo(this.retina, 'y', { duration: FOLLOW_DURATION, ease: FOLLOW_EASE }) : null
    }

    start() {
        if (!this.svg || this.isRunning) return
        this.isRunning = true
        this.scheduleNext()
    }

    //Blinks stop, eye opens; the retina keeps its last position
    stop() {
        this.isRunning = false
        this.nextCall?.kill()
        this.nextCall = null
        this.timeline?.kill()
        this.timeline = null
        this.resetPose()
    }

    //Pointer position in viewport px
    follow(clientX, clientY) {
        if (!this.followX) return
        let shiftX = ((clientX / Math.max(1, window.innerWidth)) * 2 - 1) * FOLLOW_MAX
        let shiftY = ((clientY / Math.max(1, window.innerHeight)) * 2 - 1) * FOLLOW_MAX
        let distance = Math.hypot(shiftX, shiftY)
        if (distance > FOLLOW_MAX) {
            shiftX *= FOLLOW_MAX / distance
            shiftY *= FOLLOW_MAX / distance
        }
        this.followX(shiftX)
        this.followY(shiftY)
    }

    //One blink right now with a press, cutting off an idle blink. Resolves once the eye is
    //open again (or at once without an svg) — e.g. blink, then navigate
    blink() {
        if (!this.svg) return Promise.resolve()
        this.nextCall?.kill()
        this.timeline?.kill()
        gsap.set(this.svg, { scaleY: 1 })

        return new Promise((resolve) => {
            this.timeline = gsap.timeline({
                onComplete: () => {
                    resolve()
                    if (this.isRunning) this.scheduleNext()
                },
                onInterrupt: resolve,
            })
            this.addBlink()
            if (this.pressTarget) {
                this.timeline
                    .to(this.pressTarget, { scale: PRESS_SCALE, duration: BLINK_CLOSE_DURATION, ease: BLINK_CLOSE_EASE }, 0)
                    .to(this.pressTarget, { scale: 1, duration: PRESS_RELEASE_DURATION, ease: PRESS_RELEASE_EASE }, BLINK_CLOSE_DURATION)
            }
        })
    }

    destroy() {
        this.stop()
        if (this.svg) gsap.set(this.svg, { clearProps: 'transform' })
        if (this.retina) gsap.set(this.retina, { clearProps: 'transform' })
        if (this.pressTarget) gsap.set(this.pressTarget, { clearProps: 'transform' })
    }

    //Helpers

    //Eye open. The retina is left alone; pressTarget's scale belongs to the owner's pop / hide
    resetPose() {
        if (this.svg) gsap.set(this.svg, { scaleY: 1 })
    }

    scheduleNext() {
        this.nextCall?.kill()
        this.nextCall = gsap.delayedCall(gsap.utils.random(BLINK_MIN_SECONDS, BLINK_MAX_SECONDS), () => this.playIdleBlink())
    }

    //Animations

    playIdleBlink() {
        if (!this.isRunning) return
        this.timeline?.kill()
        this.timeline = gsap.timeline({ onComplete: () => this.isRunning && this.scheduleNext() })
        this.addBlink()
        if (Math.random() < DOUBLE_BLINK_CHANCE) {
            this.timeline.to({}, { duration: DOUBLE_BLINK_GAP })
            this.addBlink()
        }
    }

    addBlink() {
        this.timeline
            .to(this.svg, { scaleY: BLINK_SCALE, transformOrigin: '50% 50%', duration: BLINK_CLOSE_DURATION, ease: BLINK_CLOSE_EASE })
            .to(this.svg, { scaleY: 1, duration: BLINK_OPEN_DURATION, ease: BLINK_OPEN_EASE })
    }
}
