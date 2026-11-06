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

    show({ instant = false } = {}) {
        if (instant) this.timeline.pause().progress(1)
        else this.timeline.play()
    }

    hide({ instant = false } = {}) {
        if (instant) this.timeline.pause().progress(0)
        else this.timeline.reverse()
    }

    //Masks off, lines back where Webflow has them, inline props cleared
    destroy() {
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
