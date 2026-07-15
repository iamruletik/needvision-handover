import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Hero image expands from a thin strip to full frame — plays once when
//.hero-image-wrapper hits viewport center. Animates width by design decision:
//surrounding layout is meant to react to the image growing.

const START_WIDTH = '0.01vw'
const END_WIDTH = '40vw'
const REVEAL_DURATION = 1.4
const REVEAL_EASE = 'power2.out'
//Wrapper, not .hero-image — the section is 1400px tall with heavy padding,
//its center lands far below the image's actual center
const TRIGGER_START = 'center center'

export class HeroImageReveal extends Module {

    setup() {
        this.image = document.querySelector('.hero__img')
        if (!this.image) return

        let triggerElement = document.querySelector('.hero-image-wrapper') || document.querySelector('.hero-image')
        if (!triggerElement) return

        gsap.set(this.image, { width: START_WIDTH, overflow: 'hidden' })

        this.animate(gsap.to(this.image, {
            width: END_WIDTH,
            duration: REVEAL_DURATION,
            ease: REVEAL_EASE,
            scrollTrigger: {
                trigger: triggerElement,
                start: TRIGGER_START,
                toggleActions: 'play none none none',
            },
        }))
    }
}
