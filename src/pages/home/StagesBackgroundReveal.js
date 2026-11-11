import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'

//Stages sections (desktop + mobile) — background fades in from transparent to its Webflow color
//once the section's top crosses the bottom of the viewport. Plays once, never reverses.
//Only the alpha moves: GSAP reads 'transparent' as black at 0 alpha, which would grey the fade.

const SECTION_SELECTOR = '.stages'
const START = 'top bottom'
const DURATION = 1.8
const EASE = 'power1.inOut'

export class StagesBackgroundReveal extends Module {

    setup() {
        //Only the rendered version — Webflow shows one per breakpoint
        this.sections = [...document.querySelectorAll(SECTION_SELECTOR)]
            .filter((section) => section.getClientRects().length > 0)

        this.sections.forEach((section) => this.buildFade(section))
    }

    buildFade(section) {
        let color = getComputedStyle(section).backgroundColor
        let [red, green, blue, alpha = 1] = gsap.utils.splitColor(color)
        if (alpha === 0) return

        this.animate(gsap.fromTo(section,
            { backgroundColor: `rgba(${red}, ${green}, ${blue}, 0)` },
            {
                backgroundColor: color,
                duration: DURATION,
                ease: EASE,
                //Webflow's variable takes over again once done
                clearProps: 'backgroundColor',
                scrollTrigger: {
                    trigger: section,
                    start: START,
                    once: true,
                },
            }
        ))
    }

    destroy() {
        super.destroy()
        if (this.sections?.length) gsap.set(this.sections, { clearProps: 'backgroundColor' })
        this.sections = []
    }
}
