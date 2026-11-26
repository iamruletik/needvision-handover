import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Header descriptor (.descriptor-svg) in / out — opacity + blur only, no movement. Out is the
//same timeline reversed, so a turn mid-way continues from where it is.
//Owned by HeaderCompact (hidden while compact, header intro via hold / release).

const DURATION = 1.1
const EASE = 'power3.out'
const BLUR_PX = 12

//Hide — the intro reversed, faster. The handoff (hide's onHandoff — a docking element takes the
//motion over) fires at this share of the exit's time: the reversed power3.out is slow first,
//so 0.9 of the time ≈ mostly faded
const HIDE_TIME_SCALE = 1.6
const HANDOFF_EXIT_SHARE = 0.9

export class DescriptorReveal extends Module {

    constructor(descriptor) {
        super()
        this.descriptor = descriptor
        this.timeline = gsap.timeline({ paused: true })
    }

    setup() {
        if (!this.descriptor) return

        this.timeline.fromTo(this.descriptor,
            { autoAlpha: 0, filter: `blur(${BLUR_PX}px)` },
            { autoAlpha: 1, filter: 'blur(0px)', duration: DURATION, ease: EASE }, 0)

        //Starts shown — HeaderCompact hides it right away when it has to
        this.timeline.progress(1)
        this.animate(this.timeline)
    }

    //Animations

    //delay — seconds to hold before coming in (a docked element leaving first).
    //Cancels a pending hide handoff
    show({ instant = false, delay = 0 } = {}) {
        this.cancelPending()
        if (instant) {
            this.timeline.pause().timeScale(1).progress(1)
            return
        }
        if (delay > 0) {
            this.pendingCall = gsap.delayedCall(delay, () => this.timeline.timeScale(1).play())
            return
        }
        this.timeline.timeScale(1).play()
    }

    //onHandoff — at HANDOFF_EXIT_SHARE of the exit (right away if instant or already out)
    hide({ instant = false, onHandoff = null } = {}) {
        this.cancelPending()
        if (instant || this.timeline.progress() === 0) {
            this.timeline.pause().timeScale(1).progress(0)
            onHandoff?.()
            return
        }
        this.timeline.timeScale(HIDE_TIME_SCALE).reverse()
        if (!onHandoff) return

        //Reversing: time left until the handoff point, at hide speed
        let handoffTime = this.timeline.duration() * (1 - HANDOFF_EXIT_SHARE)
        let wait = Math.max(0, this.timeline.time() - handoffTime) / HIDE_TIME_SCALE
        this.pendingCall = gsap.delayedCall(wait, onHandoff)
    }

    cancelPending() {
        this.pendingCall?.kill()
        this.pendingCall = null
    }

    destroy() {
        this.cancelPending()
        super.destroy()
        if (this.descriptor) gsap.set(this.descriptor, { clearProps: 'filter,opacity,visibility' })
    }
}
