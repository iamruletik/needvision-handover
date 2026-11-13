import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Partner section:
//  1. Cursor lantern — GSAP drives --mouse-x/--mouse-y CSS vars, gradient lives in CSS
//  2. Background layer fades in as the section arrives, out as it leaves the viewport
//  3. Background text drifts slightly slower than the scroll (parallax)
//≤991 the lantern stays centered — a tap fires mousemove too, so the listener isn't bound there

const LANTERN_MEDIA = '(min-width: 992px)'
//Background fade-in — scrubbed, section top from the screen bottom to 40% down
const BACKGROUND_FADE_IN_START = 'top bottom'
const BACKGROUND_FADE_IN_END = 'top 40%'
const LANTERN_FOLLOW_DURATION = 1.8
//Fraction of scroll speed the background text lags behind (0.05 = 5% slower)
const TEXT_PARALLAX_RATIO = 0.05

export class PartnerSpotlight extends Module {

    setup() {
        this.section = document.querySelector('.partner')
        this.overlay = document.querySelector('.spotlight-overlay')
        if (!this.section || !this.overlay) return

        this.bindLantern()
        this.buildBackgroundFade()
        this.buildTextParallax()
    }

    bindLantern() {
        if (!window.matchMedia(LANTERN_MEDIA).matches) return

        this.listen(this.section, 'mousemove', (event) => {
            let rect = this.section.getBoundingClientRect()

            this.animate(gsap.to(this.overlay, {
                '--mouse-x': `${event.clientX - rect.left}px`,
                '--mouse-y': `${event.clientY - rect.top}px`,
                duration: LANTERN_FOLLOW_DURATION,
                ease: 'power3.out',
                overwrite: 'auto',
            }))
        })
    }

    buildBackgroundFade() {
        let backgroundLayer = document.querySelector('.partner_bg-layer')
        if (!backgroundLayer) return

        //Fades in as the section comes up from the bottom of the screen
        this.animate(gsap.fromTo(backgroundLayer,
            { opacity: 0 },
            {
                opacity: 1,
                ease: 'none',
                scrollTrigger: {
                    trigger: this.section,
                    start: BACKGROUND_FADE_IN_START,
                    end: BACKGROUND_FADE_IN_END,
                    scrub: true,
                },
            }
        ))

        //Starts once the section is half gone, done when it fully leaves.
        //fromTo + no immediate render — the fade-in above owns the starting 0
        this.animate(gsap.fromTo(backgroundLayer,
            { opacity: 1 },
            {
                opacity: 0,
                ease: 'none',
                immediateRender: false,
                scrollTrigger: {
                    trigger: this.section,
                    start: 'bottom 60%',
                    end: 'bottom 15%',
                    scrub: true,
                },
            }
        ))
    }

    buildTextParallax() {
        let backgroundText = document.querySelector('.bg-parallax-text')
        if (!backgroundText) return

        //Positive y as scroll grows = text falls behind = moves up slower than the page
        this.animate(gsap.to(backgroundText, {
            y: () => (this.section.offsetHeight + window.innerHeight) * TEXT_PARALLAX_RATIO,
            ease: 'none',
            scrollTrigger: {
                trigger: this.section,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1,
                invalidateOnRefresh: true,
            },
        }))
    }
}
