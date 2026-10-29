import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { SplitBlurReveal } from './SplitBlurReveal'

//Footer intro — one choreographed timeline, plays once when the footer comes into view
//(and the page is revealed):
//  CTA title + mission text — manual SplitBlurReveals, AT_CTA / AT_MISSION apart (the CTA's
//                 first-line text-indent is kept by lineMasks.js)
//  time / place — same rise, through a JS-injected mask (Clock.js rewrites their text,
//                 so they move as whole units instead of being split)
//  form overlay  — NOT part of the timeline: scrubbed by scroll. Wiped open bottom-up through a
//                 clip-path (top edge rises, rounded corners ride with it — same idea as the menu
//                 in MenuReveal) while .pre-footer-offset scrolls in, so the page content leaving
//                 drags it open at whatever speed it's scrolled
//  bottom row    — children fade in from below, staggered
//
//Footer is position:fixed (content scrolls away to uncover it) — ScrollTrigger can't
//measure a fixed element, so then the trigger is scroll-based: fires when the page is
//within FIXED_REVEAL_FRACTION of a footer height from the very bottom.
//The form marquee is pure CSS (main.css "Footer Marquee").

const FOOTER_SELECTOR = '.footer-component-element'

const CTA_TEXT_SELECTOR = '.footer_cta-title .huge-footer_text'
const MISSION_TEXT_SELECTOR = '.footer_mission-text .footer_p-text'
const TIME_SELECTOR = '.timer-place, .footer_time-wrap'
const FORM_OVERLAY_SELECTOR = '.footer_form-overlay'
//Clip goes on the card itself — the overlay is a full-screen layer with no radius, clipping it
//cuts flat. The wrapper holds the card + .contacts-form-part (image on the card's top-right
//edge, outside the card so the clip doesn't cut it): the wrapper rises, the image rides the clip edge
const FORM_WRAP_SELECTOR = '.contacts-form-wrap'
const FORM_CARD_SELECTOR = '.contacts-form'
const FORM_PART_SELECTOR = '.contacts-form-part'
const BOTTOM_ROW_SELECTOR = '.footer_bottom-row'
const LOCATION_GROUP_SELECTOR = '.footer_location-group'

//Trigger
const FIXED_REVEAL_FRACTION = 0.5
const FLOW_TRIGGER_START = 'top 70%'
//Mission text has its own trigger — plays once the page edge (spacer top) has uncovered this
//share of it (0 = its bottom edge just showing, 1 = fully uncovered)
const MISSION_UNCOVERED_SHARE = 0.5

//Clickable footer — Webflow has .footer-container at z-index -2 (under the page so the page can
//scroll off it), which also puts it under body / main / its own wrapper for clicks. Instead it's
//lifted above the page (main.css) and clipped at the page edge (spacer top): above the edge the
//page shows as before, below it the footer is visible and clickable from the first pixel
const FOOTER_CONTAINER_SELECTOR = '.footer-container'
const EDGE_CLIPPED_CLASS = 'is-edge-clipped'
//Form overlay scrub range on .pre-footer-offset (transparent spacer in flow that uncovers the
//fixed footer) — "<spacer edge> <viewport line>"
//Exported — FooterCtaMorph scrubs over the same range
export const OVERLAY_TRIGGER_SELECTOR = '.pre-footer-offset'
export const OVERLAY_SCRUB_START = 'top bottom' //spacer starts entering = footer starts showing
export const OVERLAY_SCRUB_END = 'top top' //footer fully uncovered
export const OVERLAY_SCRUB = true //true = locked to scroll; a number = seconds of catch-up lag

//Text Lines
const LINE_OFFSET_PERCENT = 110
const LINE_BLUR_PX = 12
const LINE_DURATION = 1.1
const LINE_STAGGER = 0.08
const LINE_EASE = 'power3.out'

//Form Overlay — clip wipe + a small rise, eased over the scroll range ('none' = even with scroll)
const OVERLAY_CLIP_EASE = 'none'
const CLIP_TOP_RIGHT_RADIUS = '0px'
const OVERLAY_RISE = '10vw'
const OVERLAY_RISE_EASE = 'none'
const PART_FADE_SHARE = 0.1 //image fades in over this share of the scrub — alone at the card's bottom while shut
const PART_LAG_VW = 2.5 //image starts this far below the clip edge and catches up to it by the end of the scrub

//Form fields — each wiped open left to right through a clip-path, one after another, as shares
//of the scrub (the card's clip has uncovered them by then)
const FIELDS_SELECTOR = '.contact-fields-group > *'
const FIELDS_AT = 0.55
const FIELD_DURATION = 0.25 //keep FIELDS_AT + stagger × 2 + duration ≤ 1 — past 1 it stretches the whole scrub
const FIELD_STAGGER = 0.1
const FIELD_EASE = 'power2.out'
const FIELD_CLIP_SHUT = 'inset(0% 100% 0% 0%)'
const FIELD_CLIP_OPEN = 'inset(0% 0% 0% 0%)'

//Location Group + Bottom Row — plain fade
const FADE_DURATION = 0.8
const FADE_EASE = 'power2.out'

//Timeline Positions
const AT_CTA = 0
const AT_TIME = 0.1
const AT_LOCATION_GROUP = 0.1
const AT_MISSION = 0.2
const AT_BOTTOM_ROW = 0.4

const TIME_MASK_CLASS = 'footer_time-mask'

export class FooterIntro extends Module {

    setup() {
        this.footer = document.querySelector(FOOTER_SELECTOR)
        if (!this.footer) return

        this.ctaReveal = this.createTextReveal(CTA_TEXT_SELECTOR)
        this.missionReveal = this.createTextReveal(MISSION_TEXT_SELECTOR)
        this.timeUnits = this.outermostOnly([...this.footer.querySelectorAll(TIME_SELECTOR)])
        this.timeMasks = this.timeUnits.map((unit) => this.wrapInMask(unit))
        let formOverlay = this.footer.querySelector(FORM_OVERLAY_SELECTOR)
        this.formCard = formOverlay?.querySelector(FORM_CARD_SELECTOR) ?? formOverlay
        this.formWrap = formOverlay?.querySelector(FORM_WRAP_SELECTOR) ?? this.formCard
        this.formPart = this.formWrap?.querySelector(`:scope > ${FORM_PART_SELECTOR}`) ?? null
        this.formFields = this.formCard ? [...this.formCard.querySelectorAll(FIELDS_SELECTOR)] : []
        this.locationGroup = this.footer.querySelector(LOCATION_GROUP_SELECTOR)
        this.bottomRow = this.footer.querySelector(BOTTOM_ROW_SELECTOR)

        this.isRevealed = false
        this.isInView = false
        this.hasPlayed = false
        this.isMissionInView = false
        this.hasMissionPlayed = false
        this.hasMissionTrigger = false

        this.setHiddenStates()
        this.createTrigger(FIXED_REVEAL_FRACTION, FLOW_TRIGGER_START, () => {
            this.isInView = true
            this.tryPlay()
        })
        this.createMissionTrigger()
        this.createOverlayScrub()
        this.createEdgeClip()
    }

    //Called once the screen is visible
    reveal() {
        if (!this.footer || this.isRevealed) return
        this.isRevealed = true
        this.tryPlay()
        this.tryPlayMission()
    }

    //Trigger

    createTrigger(fixedRevealFraction, flowTriggerStart, onEnter) {
        if (this.isFixed(this.footer)) {
            this.animate(ScrollTrigger.create({
                start: () => ScrollTrigger.maxScroll(window) - this.footer.offsetHeight * fixedRevealFraction,
                once: true,
                invalidateOnRefresh: true,
                onEnter,
            }))
            return
        }

        this.animate(ScrollTrigger.create({
            trigger: this.footer,
            start: flowTriggerStart,
            once: true,
            onEnter,
        }))
    }

    //The fixed footer doesn't move, so the text's viewport line is fixed too: fires when the spacer
    //top crosses it. No spacer or text — the mission stays in the intro timeline (tryPlay)
    createMissionTrigger() {
        let spacer = this.footer.querySelector(OVERLAY_TRIGGER_SELECTOR)
        let missionText = this.missionReveal?.items?.[0]?.element
        if (!spacer || !missionText) return

        this.hasMissionTrigger = true
        this.animate(ScrollTrigger.create({
            trigger: spacer,
            start: () => {
                let rect = missionText.getBoundingClientRect()
                return `top ${rect.bottom - rect.height * MISSION_UNCOVERED_SHARE}px`
            },
            once: true,
            invalidateOnRefresh: true,
            onEnter: () => {
                this.isMissionInView = true
                this.tryPlayMission()
            },
        }))
    }

    //No spacer = no page edge to clip at — the footer keeps its Webflow stacking
    createEdgeClip() {
        let spacer = this.footer.querySelector(OVERLAY_TRIGGER_SELECTOR)
        this.footerContainer = this.footer.querySelector(FOOTER_CONTAINER_SELECTOR)
        if (!spacer || !this.footerContainer) return

        let clipToEdge = () => {
            let edge = Math.min(Math.max(spacer.getBoundingClientRect().top, 0), window.innerHeight)
            this.footerContainer.style.clipPath = `inset(${Math.round(edge)}px 0px 0px 0px)`
        }

        clipToEdge()
        this.footerContainer.classList.add(EDGE_CLIPPED_CLASS)
        this.animate(ScrollTrigger.create({
            trigger: spacer,
            start: OVERLAY_SCRUB_START,
            end: OVERLAY_SCRUB_END,
            onUpdate: clipToEdge,
            onRefresh: clipToEdge,
        }))
    }

    //Helpers

    isFixed(element) {
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (getComputedStyle(node).position === 'fixed') return true
        }
        return false
    }

    //Split now, parked hidden until tryPlay()
    createTextReveal(selector) {
        let elements = [...this.footer.querySelectorAll(selector)]
        return elements.length ? new SplitBlurReveal(elements, { trigger: 'manual' }).mount() : null
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

    //inset(top … round radius) in px — like MenuReveal, the card's own radius on the corners,
    //so the moving edge is always rounded. Top-right stays square (the part image sits there).
    //Shut = top inset is the card's full height
    formClipPath(isOpen) {
        let radius = getComputedStyle(this.formCard).borderTopLeftRadius || '0px'
        let top = isOpen ? 0 : this.formCard.offsetHeight
        return `inset(${top}px 0px 0px 0px round ${radius} ${CLIP_TOP_RIGHT_RADIUS} ${radius} ${radius})`
    }

    //Clip edge distance + the lag below it, in px
    partStartY() {
        return this.formCard.offsetHeight + window.innerWidth * PART_LAG_VW / 100
    }

    setHiddenStates() {
        if (this.timeUnits.length) gsap.set(this.timeUnits, { yPercent: LINE_OFFSET_PERCENT, filter: `blur(${LINE_BLUR_PX}px)` })
        if (this.formCard) gsap.set(this.formCard, { clipPath: this.formClipPath(false) })
        if (this.formWrap) gsap.set(this.formWrap, { y: OVERLAY_RISE })
        if (this.formPart) gsap.set(this.formPart, { y: this.partStartY(), autoAlpha: 0 })
        let fadeElements = [this.locationGroup, this.bottomRow].filter(Boolean)
        if (fadeElements.length) gsap.set(fadeElements, { autoAlpha: 0 })
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
            onComplete: () => {
                if (this.timeUnits.length) gsap.set(this.timeUnits, { clearProps: 'filter' })
            },
        })

        this.ctaReveal?.playIn(AT_CTA)
        if (this.timeUnits.length) timeline.to(this.timeUnits, lineVars, AT_TIME)
        if (!this.hasMissionTrigger) this.missionReveal?.playIn(AT_MISSION)

        let fadeVars = { autoAlpha: 1, duration: FADE_DURATION, ease: FADE_EASE }
        if (this.locationGroup) timeline.to(this.locationGroup, fadeVars, AT_LOCATION_GROUP)
        if (this.bottomRow) timeline.to(this.bottomRow, fadeVars, AT_BOTTOM_ROW)

        this.animate(timeline)
    }

    tryPlayMission() {
        if (!this.isRevealed || !this.isMissionInView || this.hasMissionPlayed) return
        this.hasMissionPlayed = true
        this.missionReveal?.playIn()
    }

    //Scroll drives it both ways — scrolling back up closes it again. No spacer: just shown
    createOverlayScrub() {
        if (!this.formCard) return
        let spacer = this.footer.querySelector(OVERLAY_TRIGGER_SELECTOR)
        if (!spacer) {
            gsap.set([this.formCard, this.formWrap, this.formPart, ...this.formFields].filter(Boolean), { clearProps: 'clipPath,transform,opacity,visibility' })
            return
        }

        let timeline = gsap.timeline({
            scrollTrigger: {
                trigger: spacer,
                start: OVERLAY_SCRUB_START,
                end: OVERLAY_SCRUB_END,
                scrub: OVERLAY_SCRUB,
                invalidateOnRefresh: true,
            },
        })

        //Function values — re-measured on refresh (resize changes height and radius)
        timeline.fromTo(this.formCard,
            { clipPath: () => this.formClipPath(false) },
            { clipPath: () => this.formClipPath(true), duration: 1, ease: OVERLAY_CLIP_EASE },
            0
        )
        timeline.fromTo(this.formWrap,
            { y: OVERLAY_RISE },
            { y: 0, duration: 1, ease: OVERLAY_RISE_EASE },
            0
        )

        if (this.formFields.length) {
            timeline.fromTo(this.formFields,
                { clipPath: FIELD_CLIP_SHUT },
                { clipPath: FIELD_CLIP_OPEN, duration: FIELD_DURATION, stagger: FIELD_STAGGER, ease: FIELD_EASE },
                FIELDS_AT
            )
        }

        //Image trails the clip's top edge — starts PART_LAG_VW below it, closes the gap by the end
        if (this.formPart) {
            timeline.fromTo(this.formPart,
                { y: () => this.partStartY() },
                { y: 0, duration: 1, ease: OVERLAY_CLIP_EASE },
                0
            )
            timeline.fromTo(this.formPart,
                { autoAlpha: 0 },
                { autoAlpha: 1, duration: PART_FADE_SHARE, ease: 'none' },
                0
            )
        }

        this.animate(timeline)
    }

    //Cleanup — unwrap time masks, clear inline states

    destroy() {
        super.destroy()
        if (!this.footer || !this.timeUnits) return

        this.footerContainer?.classList.remove(EDGE_CLIPPED_CLASS)
        this.footerContainer?.style.removeProperty('clip-path')
        this.footerContainer = null

        this.ctaReveal?.destroy()
        this.missionReveal?.destroy()
        this.ctaReveal = null
        this.missionReveal = null

        this.timeMasks?.forEach((mask) => {
            let element = mask.firstElementChild
            if (element) mask.parentNode?.insertBefore(element, mask)
            mask.remove()
        })
        this.timeMasks = []

        let animated = [...this.timeUnits, this.formCard, this.formWrap, this.formPart, ...(this.formFields ?? []), this.locationGroup, this.bottomRow].filter(Boolean)
        if (animated.length) gsap.set(animated, { clearProps: 'transform,filter,opacity,visibility,clipPath' })
    }
}
