import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Footer slides out of its mask as .footer enters the viewport. Plain scrub.

export class FooterReveal extends Module {

    setup() {
        this.footer = document.querySelector('.footer')
        this.wrapper = document.querySelector('.footer-wrapper')
        if (!this.footer || !this.wrapper) return

        this.animate(gsap.fromTo(this.wrapper,
            { yPercent: -100 },
            {
                yPercent: 0,
                ease: 'none',
                scrollTrigger: {
                    trigger: this.footer,
                    start: 'top bottom',
                    end: 'top top',
                    scrub: true,
                },
            }
        ))
    }
}
