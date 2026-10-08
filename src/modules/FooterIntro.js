import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'

//Footer intro — one choreographed timeline, plays once when the footer comes into view
//(and the page is revealed):
//  CTA title lines + mission lines — rise out of their Webflow masks, un-blurring
//  time / place — same rise, through a JS-injected mask (Clock.js rewrites their text,
//                 so they move as whole units instead of being split)
//  form overlay  — slides up into place
//  bottom row    — children fade in from below, staggered
//
//Footer is position:fixed (content scrolls away to uncover it) — ScrollTrigger can't
//measure a fixed element, so then the trigger is scroll-based: fires when the page is
//within FIXED_REVEAL_FRACTION of a footer height from the very bottom.
//The form marquee is pure CSS (main.css "Footer Marquee").

const FOOTER_SELECTOR = '.footer'

const CTA_LINE_SELECTOR = '.huge-footer_line-mask > .huge-footer_text'
const MISSION_LINE_SELECTOR = '.footer_p-mask > .footer_p-text'
const TIME_SELECTOR = '.timer-place, .footer_time-wrap'
const FORM_OVERLAY_SELECTOR = '.footer_form-overlay'
const BOTTOM_ROW_SELECTOR = '.footer_bottom-row'

//Trigger
const FIXED_REVEAL_FRACTION = 0.5
const FLOW_TRIGGER_START = 'top 70%'

//Text Lines
const LINE_OFFSET_PERCENT = 110
const LINE_BLUR_PX = 12
const LINE_DURATION = 1.1
const LINE_STAGGER = 0.08
const LINE_EASE = 'power3.out'

//Form Overlay
const OVERLAY_OFFSET_PERCENT = 100
const OVERLAY_DURATION = 1.2
const OVERLAY_EASE = 'expo.out'

//Bottom Row
const ROW_OFFSET_PX = 30
const ROW_DURATION = 0.8
const ROW_STAGGER = 0.06
const ROW_EASE = 'power2.out'

//Timeline Positions
const AT_CTA = 0
const AT_TIME = 0.1
const AT_MISSION = 0.2
const AT_OVERLAY = 0.25
const AT_BOTTOM_ROW = 0.4

const TIME_MASK_CLASS = 'footer_time-mask'

export class FooterIntro extends Module {

    setup() {
        this.footer = document.querySelector(FOOTER_SELECTOR)
        if (!this.footer) return

        this.ctaLines = [...this.footer.querySelectorAll(CTA_LINE_SELECTOR)]
        this.missionLines = [...this.footer.querySelectorAll(MISSION_LINE_SELECTOR)]
        this.timeUnits = this.outermostOnly([...this.footer.querySelectorAll(TIME_SELECTOR)])
        this.timeMasks = this.timeUnits.map((unit) => this.wrapInMask(unit))
        this.formOverlay = this.footer.querySelector(FORM_OVERLAY_SELECTOR)
        this.bottomRowItems = [...(this.footer.querySelector(BOTTOM_ROW_SELECTOR)?.children ?? [])]

        this.isRevealed = false
        this.isInView = false
        this.hasPlayed = false

        this.setHiddenStates()
        this.createTrigger()
    }

    //Called once the screen is visible
    reveal() {
        if (!this.footer || this.isRevealed) return
        this.isRevealed = true
        this.tryPlay()
    }

    //Trigger

    createTrigger() {
        let onEnter = () => {
            this.isInView = true
            this.tryPlay()
        }

        if (this.isFixed(this.footer)) {
            this.animate(ScrollTrigger.create({
                start: () => ScrollTrigger.maxScroll(window) - this.footer.offsetHeight * FIXED_REVEAL_FRACTION,
                once: true,
                invalidateOnRefresh: true,
                onEnter,
            }))
            return
        }

        this.animate(ScrollTrigger.create({
            trigger: this.footer,
            start: FLOW_TRIGGER_START,
            once: true,
            onEnter,
        }))
    }

    //Helpers

    isFixed(element) {
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (getComputedStyle(node).position === 'fixed') return true
        }
        return false
    }

    //.timer-place may sit inside .footer_time-wrap — animate only the outer one
    outermostOnly(elements) {
        return elements.filter((element) => !elements.some((other) => other !== element && other.contains(element)))
    }

    wrapInMask(element) {
        let mask = document.createElement('div')
        mask.className = TIME_MASK_CLASS
        mask.style.overflow = 'hidden'
        element.parentNode.insertBefore(mask, element)
        mask.appendChild(element)
        return mask
    }

    allLines() {
        return [...this.ctaLines, ...this.missionLines, ...this.timeUnits]
    }

    setHiddenStates() {
        let lines = this.allLines()
        if (lines.length) gsap.set(lines, { yPercent: LINE_OFFSET_PERCENT, filter: `blur(${LINE_BLUR_PX}px)` })
        if (this.formOverlay) gsap.set(this.formOverlay, { yPercent: OVERLAY_OFFSET_PERCENT })
        if (this.bottomRowItems.length) gsap.set(this.bottomRowItems, { y: ROW_OFFSET_PX, autoAlpha: 0 })
    }

    //Animations

    tryPlay() {
        if (!this.isRevealed || !this.isInView || this.hasPlayed) return
        this.hasPlayed = true

        let lineVars = {
            yPercent: 0,
            filter: 'blur(0px)',
            duration: LINE_DURATION,
            stagger: LINE_STAGGER,
            ease: LINE_EASE,
        }

        let timeline = gsap.timeline({
            //Leftover filter keeps layers expensive — drop it once done
            onComplete: () => gsap.set(this.allLines(), { clearProps: 'filter' }),
        })

        if (this.ctaLines.length) timeline.to(this.ctaLines, lineVars, AT_CTA)
        if (this.timeUnits.length) timeline.to(this.timeUnits, lineVars, AT_TIME)
        if (this.missionLines.length) timeline.to(this.missionLines, lineVars, AT_MISSION)

        if (this.formOverlay) {
            timeline.to(this.formOverlay, {
                yPercent: 0,
                duration: OVERLAY_DURATION,
                ease: OVERLAY_EASE,
            }, AT_OVERLAY)
        }

        if (this.bottomRowItems.length) {
            timeline.to(this.bottomRowItems, {
                y: 0,
                autoAlpha: 1,
                duration: ROW_DURATION,
                stagger: ROW_STAGGER,
                ease: ROW_EASE,
            }, AT_BOTTOM_ROW)
        }

        this.animate(timeline)
    }

    //Cleanup — unwrap time masks, clear inline states

    destroy() {
        super.destroy()
        if (!this.footer || !this.ctaLines) return

        this.timeMasks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) mask.parentNode?.insertBefore(element, mask)
            mask.remove()
        })
        this.timeMasks = []

        let animated = [...this.allLines(), this.formOverlay, ...this.bottomRowItems].filter(Boolean)
        if (animated.length) gsap.set(animated, { clearProps: 'transform,filter,opacity,visibility' })
    }
}
