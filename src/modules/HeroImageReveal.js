import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Hero image expands from a thin strip to full frame — plays once when
//.hero-image-wrapper hits viewport center. Animates width by design decision:
//surrounding layout is meant to react to the image growing.
//Desktop: the labels are flex siblings beside it, so they ride out to the sides.
//≤991: the labels sit under it (main.css "Hero Image Stacked") and spread to its edges
//the same way; the image ends at the viewport width minus STACKED_GUTTER_REM each side.

//Webflow authors .hero__img at width 0 too — no strip on the frames before JS runs
const START_WIDTH = '0px'
const END_WIDTH = '40vw'
const STACKED_MEDIA = '(max-width: 991px)'
const STACKED_GUTTER_REM = 1
const REVEAL_DURATION = 1.4
const REVEAL_EASE = 'power2.out'
//Wrapper, not .hero-image — the section is 1400px tall with heavy padding,
//its center lands far below the image's actual center.
//Exported — the 3D video starts at this same point (SceneScrollTimeline)
export const HERO_IMAGE_TRIGGER_SELECTOR = '.hero-image-wrapper'
export const HERO_IMAGE_TRIGGER_START = 'center center'

export class HeroImageReveal extends Module {

    setup() {
        this.image = document.querySelector('.hero__img')
        if (!this.image) return

        let triggerElement = document.querySelector(HERO_IMAGE_TRIGGER_SELECTOR) || document.querySelector('.hero-image')
        if (!triggerElement) return

        this.stackedMedia = window.matchMedia(STACKED_MEDIA)

        gsap.set(this.image, { width: START_WIDTH, overflow: 'hidden' })

        this.animate(gsap.to(this.image, {
            width: () => this.endWidth(),
            duration: REVEAL_DURATION,
            ease: REVEAL_EASE,
            scrollTrigger: {
                trigger: triggerElement,
                start: HERO_IMAGE_TRIGGER_START,
                toggleActions: 'play none none none',
                invalidateOnRefresh: true,
            },
        }))
    }

    //Helpers

    //GSAP can't tween into calc() — the stacked end width is resolved to px
    endWidth() {
        if (!this.stackedMedia?.matches) return END_WIDTH
        let rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        return `${document.documentElement.clientWidth - STACKED_GUTTER_REM * 2 * rootFontSize}px`
    }
}
