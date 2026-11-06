import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Rise out of a mask, no fade — each element is wrapped in a JS-injected overflow:hidden div and
//slides up from below its bottom edge. Plays on reveal() (preloader / eye done), no scroll.
//Usage: new MaskRiseReveal('.selector', { delay: 0.3 }).mount()

const MASK_CLASS = 'mask-rise'

const DEFAULTS = {
    offsetPercent: 110, //past the mask edge, so nothing peeks before it plays
    duration: 1.1,
    delay: 0,
    stagger: 0.08,
    ease: 'power3.out',
}

export class MaskRiseReveal extends Module {

    constructor(selector, options = {}) {
        super()
        this.selector = selector
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.elements = [...document.querySelectorAll(this.selector)]
        if (this.elements.length === 0) return

        this.isRevealed = false
        this.masks = this.elements.map((element) => this.wrapInMask(element))
        gsap.set(this.elements, { yPercent: this.options.offsetPercent })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.elements?.length || this.isRevealed) return
        this.isRevealed = true

        let { duration, delay, stagger, ease } = this.options
        this.animate(gsap.to(this.elements, { yPercent: 0, duration, delay, stagger, ease }))
    }

    //Helpers

    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = MASK_CLASS
        mask.style.overflow = 'hidden'
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        return mask
    }

    //Cleanup — unwrap, hand the element back untouched

    destroy() {
        super.destroy()
        this.masks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) mask.parentNode?.insertBefore(element, mask)
            mask.remove()
        })
        this.masks = []
        if (this.elements?.length) gsap.set(this.elements, { clearProps: 'transform' })
        this.elements = []
    }
}
