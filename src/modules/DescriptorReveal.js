import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Header descriptor (.descriptor-svg) in / out. Its two .descriptor-line svgs sit in JS masks
//(kept for good — every compact hides it again); in: they rise out of the masks one after
//the other while the descriptor un-blurs (SplitBlurReveal's look). Out is the same timeline
//reversed, so a turn mid-way continues from where it is.
//Owned by HeaderCompact (hidden while compact, header intro via hold / release). No line
//embeds in Webflow: the whole descriptor fades instead.

const LINE_SELECTOR = '.descriptor-line'
const LINE_MASK_CLASS = 'descriptor-line-mask'

//SplitBlurReveal's defaults
const OFFSET_PERCENT = 110
const DURATION = 1.1
const STAGGER = 0.08
const EASE = 'power3.out'
const BLUR_PX = 12

//Hide — the intro reversed, faster. The handoff (hide's onHandoff — a docking element takes the
//motion over) fires at this share of the exit's time: the reversed power3.out is slow first,
//so 0.9 of the time ≈ lines 70% out
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
        this.lines = [...this.descriptor.querySelectorAll(LINE_SELECTOR)]
        this.masks = this.lines.map((line) => this.wrapInMask(line))

        if (this.lines.length) {
            this.timeline.fromTo(this.lines,
                { yPercent: OFFSET_PERCENT },
                { yPercent: 0, duration: DURATION, stagger: STAGGER, ease: EASE }, 0)
            this.timeline.fromTo(this.descriptor,
                { filter: `blur(${BLUR_PX}px)` },
                { filter: 'blur(0px)', duration: DURATION, ease: EASE }, 0)
        } else {
            this.timeline.fromTo(this.descriptor, { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION, ease: EASE }, 0)
        }

        //Starts shown — HeaderCompact hides it right away when it has to
        this.timeline.progress(1)
        this.animate(this.timeline)
    }

    //Helpers

    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = LINE_MASK_CLASS
        mask.style.overflow = 'hidden'
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        return mask
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

    //Masks off, lines back where Webflow has them, inline props cleared
    destroy() {
        this.cancelPending()
        super.destroy()
        this.masks?.forEach((mask) => {
            while (mask.firstChild) mask.parentNode.insertBefore(mask.firstChild, mask)
            mask.remove()
        })
        this.masks = []
        if (this.descriptor) gsap.set(this.descriptor, { clearProps: 'filter,opacity,visibility' })
        if (this.lines?.length) gsap.set(this.lines, { clearProps: 'transform' })
    }
}
