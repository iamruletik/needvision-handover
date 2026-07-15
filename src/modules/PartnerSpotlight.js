import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Partner section:
//  1. Cursor lantern — GSAP drives --mouse-x/--mouse-y CSS vars, gradient lives in CSS
//  2. Background layer fades out as the section leaves the viewport
//  3. Background text drifts slightly slower than the scroll (parallax)

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

        //Starts once the section is half gone, done when it fully leaves
        this.animate(gsap.to(backgroundLayer, {
            opacity: 0,
            ease: 'none',
            scrollTrigger: {
                trigger: this.section,
                start: 'bottom 60%',
                end: 'bottom 15%',
                scrub: true,
            },
        }))
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
