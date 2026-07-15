import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Generalized blur+mask text rise — the signature reveal used across the site.
//Add a variant to REVEALS to put the effect on any text group:
//  selector — what animates
//  trigger  — 'self' gives every element its own trigger (needed under sticky sections,
//             where one shared section trigger misfires with Lenis), or a container selector
//  start    — ScrollTrigger start for the trigger element
//  stagger  — delay between elements when they share a trigger
//Plays once, no reverse. filter is cleared after the tween — blur left on elements
//keeps costing GPU time, especially on Safari retina.

const REVEALS = [
    {
        //Logo section — lines rise together, cascaded
        selector: '.logo-anim__txt',
        trigger: '.section-logo',
        start: 'top 95%',
        stagger: 0.2,
    },
    {
        //Manifesto — each line is its own trigger
        selector: '.man-anim__txt',
        trigger: 'self',
        start: 'top bottom',
        stagger: 0,
    },
]

const RISE_DISTANCE = '6.94vw'
const BLUR_START_PX = 20
const REVEAL_DURATION = 1
const REVEAL_EASE = 'power2.out'

export class TextReveal extends Module {

    setup() {
        REVEALS.forEach((config) => this.buildReveal(config))
    }

    buildReveal({ selector, trigger, start, stagger }) {
        let elements = [...document.querySelectorAll(selector)]
        if (elements.length === 0) return

        if (trigger === 'self') {
            elements.forEach((element) => this.animateGroup([element], element, start, 0))
            return
        }

        let triggerElement = document.querySelector(trigger)
        if (!triggerElement) return
        this.animateGroup(elements, triggerElement, start, stagger)
    }

    animateGroup(elements, triggerElement, start, stagger) {
        this.animate(gsap.fromTo(elements,
            {
                y: RISE_DISTANCE,
                opacity: 0,
                filter: `blur(${BLUR_START_PX}px)`,
            },
            {
                y: 0,
                opacity: 1,
                filter: 'blur(0px)',
                duration: REVEAL_DURATION,
                stagger,
                ease: REVEAL_EASE,
                scrollTrigger: {
                    trigger: triggerElement,
                    start,
                    toggleActions: 'play none none none',
                },
                //Leftover filter keeps the layer expensive — drop it once done
                onComplete: () => gsap.set(elements, { clearProps: 'filter' }),
            }
        ))
    }
}
