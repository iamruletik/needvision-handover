import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Cases page intro — hidden on mount (preloader / eye still covers the screen), played once the
//page is revealed:
//  rows    — fade in out of a blur one after another; filter cleared at the end so the rows
//            don't stay on their own layers
//  markers — .cases-page-marker-wrap children (number + label, a flex row — like
//            SectionMarkerReveal), SplitBlurReveal on page reveal, cascading in DOM order
//  sidebar — preview display fades in rising from below, the scroll tip fades in once it lands

const ROW_SELECTOR = '.case-row'
const MARKER_SELECTOR = '.cases-page-marker-wrap'
const DISPLAY_SELECTOR = '.cases-sidebar_display'
const SCROLL_TIP_SELECTOR = '.cases-sidebar_scroll-tip'

//Exported — CaseRowSort brings the rows back in with the same reveal after a re-sort
export const REVEAL_BLUR_PX = 10
export const REVEAL_DURATION = 0.8
export const REVEAL_STAGGER = 0.1
export const REVEAL_EASE = 'power2.out'

//Sidebar
const DISPLAY_OFFSET_PX = 40
const DISPLAY_DURATION = 1
const DISPLAY_EASE = 'power3.out'
const AT_DISPLAY = 0
const SCROLL_TIP_DURATION = 0.6
const SCROLL_TIP_EASE = 'power2.out'

export class CaseRowsReveal extends Module {

    setup() {
        this.rows = [...document.querySelectorAll(ROW_SELECTOR)]
        if (this.rows.length) gsap.set(this.rows, { autoAlpha: 0, filter: `blur(${REVEAL_BLUR_PX}px)` })

        let markerParts = [...document.querySelectorAll(MARKER_SELECTOR)].flatMap((marker) => [...marker.children])
        this.markerReveal = markerParts.length ? new SplitBlurReveal(markerParts, { trigger: null }).mount() : null

        this.display = document.querySelector(DISPLAY_SELECTOR)
        this.scrollTip = document.querySelector(SCROLL_TIP_SELECTOR)
        if (this.display) gsap.set(this.display, { autoAlpha: 0, y: DISPLAY_OFFSET_PX })
        if (this.scrollTip) gsap.set(this.scrollTip, { autoAlpha: 0 })
    }

    //Called by main.js (via the cases page script) once the screen is visible
    reveal() {
        this.markerReveal?.reveal()

        if (this.hasRevealed) return
        this.hasRevealed = true

        let timeline = gsap.timeline()

        if (this.rows?.length) {
            timeline.to(this.rows, {
                autoAlpha: 1,
                filter: 'blur(0px)',
                duration: REVEAL_DURATION,
                stagger: REVEAL_STAGGER,
                ease: REVEAL_EASE,
                onComplete: () => gsap.set(this.rows, { clearProps: 'filter' }),
            }, 0)
        }

        //Scroll tip waits for the display to land ('>' — right after the display tween)
        if (this.display) {
            timeline.to(this.display, {
                autoAlpha: 1,
                y: 0,
                duration: DISPLAY_DURATION,
                ease: DISPLAY_EASE,
                onComplete: () => gsap.set(this.display, { clearProps: 'transform' }),
            }, AT_DISPLAY)
        }
        if (this.scrollTip) {
            timeline.to(this.scrollTip, { autoAlpha: 1, duration: SCROLL_TIP_DURATION, ease: SCROLL_TIP_EASE }, this.display ? '>' : AT_DISPLAY)
        }

        this.animate(timeline)
    }

    destroy() {
        super.destroy()
        let animated = [...(this.rows ?? []), this.display, this.scrollTip].filter(Boolean)
        if (animated.length) gsap.set(animated, { clearProps: 'opacity,visibility,filter,transform' })
        this.markerReveal?.destroy()
        this.markerReveal = null
        this.rows = []
    }
}
