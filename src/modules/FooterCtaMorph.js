import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { OVERLAY_TRIGGER_SELECTOR, OVERLAY_SCRUB_START, OVERLAY_SCRUB_END, OVERLAY_SCRUB } from './FooterIntro'

//Floating CTA (.call-to-action in the fixed floating button) morphs into the footer form's button
//(.footer_form-marquee-btn), scrubbed over the same range as the form's clip in FooterIntro —
//from .about-wrapper filling the screen (spacer top at the viewport bottom) to the footer fully
//uncovered. Reverses on scroll back.
//
//A third element does the moving (.footer-cta-morph, built here, appended to <body>): both real
//buttons stay as they are in Webflow, the stand-in reads their look — rect, radius, colors,
//content offsets — on every refresh, so Designer edits to either carry over.
//  start — the CTA stops being fixed: the stand-in takes its place and the page drags it up
//          (bottom edge carried 1:1 with the scroll, like it hangs off .about-wrapper)
//  then  — size / radius / x / colors morph by how much of the trip to the button is done
//  mask  — the stand-in clips its content: the CTA's svg leaves upward, a copy of the footer
//          button's marquee track comes in from below
//  end   — its bottom meets the form button's (live rect, read each frame): dropped off, it rides
//          the button until the button is fully below .about-wrapper's edge (the real one is in
//          the fixed footer, behind the page), then the real button takes over in the same frame
//Only on pages with both the floating CTA and the footer form.

const CTA_SELECTOR = '.floating-button-wrapper .call-to-action'
const CTA_SVG_SELECTOR = '.call-to-action-svg'
const BUTTON_SELECTOR = '.footer_form-marquee-btn'
const BUTTON_TRACK_SELECTOR = '.footer-marquee_track'
const FLOATING_SELECTOR = '.floating-button-wrapper'
const MORPH_CLASS = 'footer-cta-morph' //main.css "Footer CTA Morph"
const LAYER_CLASS = 'footer-cta-morph_layer'
const HANDED_OFF_CLASS = 'is-cta-handed-off' //on the floating button while the stand-in has its place

//Shape (size, radius, x, color) — position itself isn't eased, it's carried by the scroll 1:1.
//Morph progress runs over two legs: the carry up to the drop-off, then the ride with the form
//until the button clears the page's edge (handover). SHAPE_AT_DROP = how much is done at the
//drop-off; the rest finishes in the form, so it never looks fully "form button" over the page
const MORPH_EASE = 'power2.inOut'
const SHAPE_AT_DROP = 0.5

//Content swap inside the mask, as shares of the morph progress
const SVG_OUT_FROM = 0
const SVG_OUT_TO = 0.5
const TRACK_IN_FROM = 0.4
const TRACK_IN_TO = 1
const CONTENT_EASE = 'power2.inOut'

export class FooterCtaMorph extends Module {

    setup() {
        this.cta = document.querySelector(CTA_SELECTOR)
        this.button = document.querySelector(BUTTON_SELECTOR)
        let spacer = document.querySelector(OVERLAY_TRIGGER_SELECTOR)
        this.spacer = spacer
        let ctaSvg = this.cta?.querySelector(CTA_SVG_SELECTOR)
        let buttonTrack = this.button?.querySelector(BUTTON_TRACK_SELECTOR)
        if (!this.cta || !this.button || !spacer || !ctaSvg || !buttonTrack) return

        this.floating = this.cta.closest(FLOATING_SELECTOR)
        this.ctaSvg = ctaSvg
        this.buttonTrack = buttonTrack
        this.ease = gsap.parseEase(MORPH_EASE)
        this.contentEase = gsap.parseEase(CONTENT_EASE)
        this.phase = 'idle' //idle | morphing | landed

        this.buildMorph()
        gsap.set(this.button, { visibility: 'hidden' })

        this.animate(ScrollTrigger.create({
            trigger: spacer,
            start: OVERLAY_SCRUB_START,
            end: OVERLAY_SCRUB_END,
            scrub: OVERLAY_SCRUB,
            onRefresh: (self) => {
                this.measure()
                this.render(self)
            },
            onUpdate: (self) => this.render(self),
        }))
    }

    //Helpers

    //Stand-in + its two masked layers: copies of the CTA's svg and of the button's marquee track
    buildMorph() {
        this.morph = document.createElement('div')
        this.morph.className = MORPH_CLASS
        this.morph.setAttribute('aria-hidden', 'true')

        this.svgLayer = this.createLayer(this.ctaSvg)
        this.trackLayer = this.createLayer(this.buttonTrack)
        this.morph.append(this.svgLayer, this.trackLayer)
        document.body.appendChild(this.morph)
    }

    createLayer(source) {
        let layer = document.createElement('div')
        layer.className = LAYER_CLASS
        let copy = source.cloneNode(true)
        copy.removeAttribute('id')
        copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
        layer.appendChild(copy)
        return layer
    }

    //Everything at rest, transforms taken out: the floating button may still be parked below the
    //screen by FloatingButtonReveal, the card carries its rise
    measure() {
        let ctaRect = this.cta.getBoundingClientRect()
        let ctaStyle = getComputedStyle(this.cta)
        let floatingY = this.floatingOffset()

        this.rest = {
            left: ctaRect.left,
            top: ctaRect.top - floatingY,
            width: ctaRect.width,
            height: ctaRect.height,
            radius: Math.min(parseFloat(ctaStyle.borderTopLeftRadius) || 0, ctaRect.height / 2),
            backgroundColor: ctaStyle.backgroundColor,
            color: getComputedStyle(this.ctaSvg).color, //the svg draws in currentColor — its own, not the pill's
            //offsetLeft, not a rect: the marquee's own translateX must not count (CTA is position: relative)
            contentLeft: this.contentOffset(this.ctaSvg, this.cta),
        }

        //Position isn't stored — render() reads the button's live rect
        let buttonRect = this.button.getBoundingClientRect()
        let buttonStyle = getComputedStyle(this.button)

        this.target = {
            width: buttonRect.width,
            height: buttonRect.height,
            radius: parseFloat(buttonStyle.borderTopLeftRadius) || 0,
            backgroundColor: buttonStyle.backgroundColor,
            color: getComputedStyle(this.buttonTrack).color,
            contentLeft: this.contentOffset(this.buttonTrack, this.button),
        }

        this.backgroundLerp = gsap.utils.interpolate(this.rest.backgroundColor, this.target.backgroundColor)
        gsap.set(this.svgLayer, { left: this.rest.contentLeft, yPercent: -50 })
        gsap.set(this.trackLayer, { left: this.target.contentLeft, yPercent: -50 })
        this.copyColor(this.ctaSvg, this.svgLayer)
        this.copyColor(this.buttonTrack, this.trackLayer)
        this.svgLayerHeight = this.svgLayer.offsetHeight
        this.trackLayerHeight = this.trackLayer.offsetHeight
    }

    //The copies draw in currentColor. Their color can come from places the copy doesn't have —
    //a component variant on the CTA, a parent rule — so the original's resolved color goes inline
    //on the copy itself, beating any class
    copyColor(source, layer) {
        let copy = layer.firstElementChild
        if (copy) copy.style.color = getComputedStyle(source).color
    }

    //Layout position of a marquee inside its button, transforms ignored — summed up the offsetParent
    //chain in case something positioned sits between them
    contentOffset(element, container) {
        let offset = 0
        let node = element
        while (node && node !== container) {
            offset += node.offsetLeft
            let parent = node.offsetParent
            //Container isn't positioned: offsets ran past it — subtract its own to stay relative
            if (!parent || !container.contains(parent)) return parent === container ? offset : offset - container.offsetLeft
            node = parent
        }
        return offset
    }

    floatingOffset() {
        let content = this.cta.closest('.floating-button-content')
        return content ? gsap.getProperty(content, 'y') || 0 : 0
    }

    //Share of [from, to] covered at progress, eased
    segment(progress, from, to) {
        return this.contentEase(gsap.utils.clamp(0, 1, (progress - from) / (to - from)))
    }

    //Marquees hand their position over at every swap, in the swap's direction — whoever was on
    //screen is the source, whoever appears continues from there
    syncMarquees(previousPhase, phase) {
        let svgCopy = this.svgLayer.firstElementChild
        let trackCopy = this.trackLayer.firstElementChild
        if (phase === 'morphing') {
            if (previousPhase === 'idle') this.syncAnimation(this.ctaSvg, svgCopy)
            this.syncAnimation(this.buttonTrack, trackCopy) //from rest: the hidden original's clock, fine either way
        }
        if (phase === 'idle') this.syncAnimation(svgCopy, this.ctaSvg)
        if (phase === 'landed') this.syncAnimation(trackCopy, this.buttonTrack)
    }

    syncAnimation(from, to) {
        try {
            let fromAnimation = from?.getAnimations?.()[0]
            let toAnimation = to?.getAnimations?.()[0]
            if (fromAnimation && toAnimation) toAnimation.currentTime = fromAnimation.currentTime
        } catch (error) {
            //Web Animations API missing — each runs on its own clock
        }
    }

    setPhase(phase) {
        if (phase === this.phase) return
        let previousPhase = this.phase
        this.phase = phase
        this.syncMarquees(previousPhase, phase)
        //Hidden CTA: no color transitions (its hover fade) — its zone can switch while it's away,
        //and a fade still running when it comes back flashes the old color
        this.floating?.classList.toggle(HANDED_OFF_CLASS, phase !== 'idle')
        if (phase === 'morphing') {
            //The CTA's color follows its own color zones — start from what it shows as it leaves its
            //spot. Only when leaving from rest: coming back from the footer its zone may already have
            //switched (it ends a few px into the morph), and the reverse must end on the color the
            //CTA shows again at rest
            if (previousPhase === 'idle') {
                this.backgroundLerp = gsap.utils.interpolate(getComputedStyle(this.cta).backgroundColor, this.target.backgroundColor)
                this.copyColor(this.ctaSvg, this.svgLayer)
            }
        }
        gsap.set(this.floating, phase === 'idle' ? { clearProps: 'visibility' } : { visibility: 'hidden' })
        gsap.set(this.morph, { visibility: phase === 'morphing' ? 'visible' : 'hidden' })
        gsap.set(this.button, { visibility: phase === 'landed' ? 'visible' : 'hidden' })
    }

    //Animations

    //The page drags the stand-in: its bottom edge is carried up with the scroll from where the CTA
    //was fixed, until it reaches the form button's bottom — there it's dropped off and the real
    //button takes over. Shape and content follow how much of that trip is done
    render(self) {
        if (!this.rest || !this.target) return
        if (self.progress <= 0) return this.setPhase('idle')

        //Read before any write this frame — live, so the rise / clip / layout never desync it
        let buttonRect = this.button.getBoundingClientRect()
        let pageEdge = this.spacer.getBoundingClientRect().top //.about-wrapper's bottom edge

        let carriedBottom = this.rest.top + this.rest.height - (self.scroll() - self.start)
        let tripLength = this.rest.top + this.rest.height - buttonRect.bottom
        let trip = tripLength > 0 ? gsap.utils.clamp(0, 1, 1 - (carriedBottom - buttonRect.bottom) / tripLength) : 1

        //Ride leg — the real button lives in the fixed footer, behind the page: hand over only once
        //it's fully below the page's edge. Until then the stand-in rides it, on top.
        //At the drop-off the page's edge sits gapToEdge below the button's bottom (the carry keeps
        //that gap constant), so the ride is that gap plus the button's height
        let gapToEdge = pageEdge - carriedBottom
        let rideLength = gapToEdge + this.target.height
        let coveredByPage = pageEdge - buttonRect.top
        let ride = trip >= 1 && rideLength > 0 ? gsap.utils.clamp(0, 1, 1 - coveredByPage / rideLength) : 0

        if (trip >= 1 && coveredByPage <= 0) return this.setPhase('landed')
        this.setPhase('morphing')
        if (trip >= 1) carriedBottom = buttonRect.bottom

        let morph = trip < 1 ? trip * SHAPE_AT_DROP : SHAPE_AT_DROP + (1 - SHAPE_AT_DROP) * ride
        let eased = this.ease(morph)
        let mix = (from, to) => from + (to - from) * eased

        let height = mix(this.rest.height, this.target.height)
        gsap.set(this.morph, {
            x: mix(this.rest.left, buttonRect.left),
            y: carriedBottom - height,
            width: mix(this.rest.width, this.target.width),
            height,
            borderRadius: mix(this.rest.radius, this.target.radius),
            backgroundColor: this.backgroundLerp(eased),
        })

        //Content leaves / enters past the mask's edge — half the box plus half the layer
        let svgExit = height / 2 + this.svgLayerHeight / 2
        let trackEntry = height / 2 + this.trackLayerHeight / 2
        gsap.set(this.svgLayer, { y: -svgExit * this.segment(morph, SVG_OUT_FROM, SVG_OUT_TO) })
        gsap.set(this.trackLayer, { y: trackEntry * (1 - this.segment(morph, TRACK_IN_FROM, TRACK_IN_TO)) })
    }

    //Cleanup

    destroy() {
        super.destroy()
        this.morph?.remove()
        this.morph = null
        if (this.floating) {
            gsap.set(this.floating, { clearProps: 'visibility' })
            this.floating.classList.remove(HANDED_OFF_CLASS)
        }
        if (this.button) gsap.set(this.button, { clearProps: 'visibility' })
    }
}
