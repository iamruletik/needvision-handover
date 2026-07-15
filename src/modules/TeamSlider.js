import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Team slider. Slot positions and sizes are measured once from the Webflow layout,
//converted to vw, then everything goes position:absolute and animates in vw only —
//scales with any viewport width without re-measuring. The .is-active slide in Webflow
//marks the CENTRAL (large) slot; card #0 starts inside it.
//Cards that would visibly crawl across the whole carousel (wrap-around moves)
//teleport instead: fade out -> jump -> fade in.
//Known limit: measured proportions freeze at load — a breakpoint change mid-session
//(portrait flip) keeps desktop proportions until reload.

const ANIMATION_DURATION = 1.0
const ANIMATION_EASE = 'power2.inOut'
const DRAG_THRESHOLD_MOUSE = 50
const DRAG_THRESHOLD_TOUCH = 40

//Text swap
const TEXT_EXIT_DURATION = 0.4
const TEXT_ENTRY_DURATION = 0.6
const TEXT_STAGGER = 0.04
const TEXT_BLUR_PX = 6
const TEXT_SHIFT = '0.69vw'

export class TeamSlider extends Module {

    setup() {
        this.track = document.querySelector('.team_photo-track')
        this.slides = [...document.querySelectorAll('.team_photo-slide')]
        if (!this.track || this.slides.length === 0) return

        this.totalSlides = this.slides.length
        this.activeIndex = 0
        this.isAnimating = false

        this.dividers = [...document.querySelectorAll('.team_div')]
        this.nextButton = document.querySelector('.team_nav-btn')

        this.syncDotCount()
        this.dots = [...document.querySelectorAll('.team_dot')]
        this.dotFills = this.dots.map((dot) => dot.querySelector('.team_dot-full'))
        this.slideHeaders = this.slides.map((slide) => slide.querySelector('.team_member-header'))

        this.textTargets = {
            role: document.querySelector('.team_role-text'),
            quote: document.querySelector('.team_quote-text'),
            description: document.querySelector('.team_desc-text'),
            signature: document.querySelector('.team-sign'),
        }

        //Slide number lives in the second .label-wrapper inside .team_info-meta
        let metaLabels = document.querySelectorAll('.team_info-meta .label-wrapper')
        this.numberTarget = metaLabels.length > 1
            ? metaLabels[1].querySelectorAll('.label-text')[1]
            : null

        this.measureSlots()
        this.applyAbsoluteLayout()

        if (this.totalSlides > 1) this.bindControls()
    }

    syncDotCount() {
        let container = document.querySelector('.team_pagination')
        if (!container) return

        let existing = [...container.querySelectorAll('.team_dot')]
        while (existing.length > this.totalSlides) existing.pop().remove()

        if (existing.length > 0 && existing.length < this.totalSlides) {
            let template = existing[0]
            while (existing.length < this.totalSlides) {
                let clone = template.cloneNode(true)
                let fullImage = clone.querySelector('.team_dot-full')
                let emptyImage = clone.querySelector('.team_dot-empty')
                if (fullImage) fullImage.style.opacity = '0'
                if (emptyImage) emptyImage.style.opacity = '1'
                container.appendChild(clone)
                existing.push(clone)
            }
        }
    }

    //Measurement — everything in vw so the layout scales

    measureSlots() {
        //Central slot = the .is-active slide in Webflow (a SLOT index, not a card)
        this.centralSlotIndex = Math.max(0, this.slides.findIndex((slide) => slide.classList.contains('is-active')))

        let trackRect = this.track.getBoundingClientRect()
        let trackCenterX = trackRect.left + trackRect.width / 2
        let viewportWidthUnit = window.innerWidth / 100
        const toVw = (px) => px / viewportWidthUnit

        this.trackHeightVw = toVw(trackRect.height)

        this.slotPositions = this.slides.map((slide) => {
            let rect = slide.getBoundingClientRect()
            return {
                x: toVw(rect.left + rect.width / 2 - trackCenterX),
                bottom: toVw(trackRect.bottom - rect.bottom),
                width: toVw(rect.width),
                height: toVw(rect.height),
            }
        })

        this.dividerPositions = this.dividers.map((divider) => {
            let rect = divider.getBoundingClientRect()
            return {
                x: toVw(rect.left + rect.width / 2 - trackCenterX),
                bottom: toVw(trackRect.bottom - rect.bottom),
            }
        })

        let central = this.slotPositions[this.centralSlotIndex]
        this.activeSize = { width: central.width, height: central.height }

        let smallSlot = this.slotPositions.find((slot, index) => index !== this.centralSlotIndex)
        this.smallSize = smallSlot
            ? { width: smallSlot.width, height: smallSlot.height }
            : { ...this.activeSize }
    }

    applyAbsoluteLayout() {
        this.track.style.cssText += `
            display: block !important;
            position: relative !important;
            height: ${this.trackHeightVw}vw !important;
            width: 100% !important;
            overflow: visible !important;
        `

        this.slides.forEach((slide) => {
            slide.classList.remove('is-active')
            slide.querySelector('.team_member-header')?.classList.remove('is-hidden')
            slide.style.cssText += `
                position: absolute !important;
                left: 50% !important;
                min-width: 0 !important;
                max-width: none !important;
                margin: 0 !important;
                transition: none !important;
            `
        })

        gsap.set(this.slides, { xPercent: -50, yPercent: 0, transformOrigin: 'center bottom' })

        this.dividers.forEach((divider, index) => {
            divider.style.cssText += `
                position: absolute !important;
                bottom: ${this.dividerPositions[index].bottom}vw !important;
                left: 50% !important;
                margin: 0 !important;
                transition: none !important;
            `
            gsap.set(divider, { xPercent: -50, x: `${this.dividerPositions[index].x}vw` })
        })

        //Card #0 into the central slot, the rest distributed around it
        this.currentSlotByCard = new Array(this.totalSlides)
        this.slides.forEach((slide, index) => {
            let state = this.slideState(index)
            this.currentSlotByCard[index] = this.physicalSlot(index)

            slide.style.cssText += `
                bottom: ${state.bottom}vw !important;
                width: ${state.width}vw !important;
                height: ${state.height}vw !important;
            `
            gsap.set(slide, { x: `${state.x}vw`, zIndex: state.z })

            let header = this.slideHeaders[index]
            if (header) gsap.set(header, { opacity: index === this.activeIndex ? 1 : 0 })
        })

        this.dotFills.forEach((fill, index) => {
            if (fill) gsap.set(fill, { opacity: index === this.activeIndex ? 1 : 0 })
        })
    }

    //Card -> physical slot mapping with carousel wrap

    physicalSlot(cardIndex) {
        let offset = cardIndex - this.activeIndex
        if (offset > Math.floor(this.totalSlides / 2)) offset -= this.totalSlides
        if (offset < -Math.floor(this.totalSlides / 2)) offset += this.totalSlides

        let slot = this.centralSlotIndex + offset
        while (slot < 0) slot += this.totalSlides
        while (slot >= this.totalSlides) slot -= this.totalSlides
        return slot
    }

    slideState(cardIndex) {
        let slot = this.physicalSlot(cardIndex)
        let isCentral = slot === this.centralSlotIndex
        let size = isCentral ? this.activeSize : this.smallSize

        return {
            x: this.slotPositions[slot].x,
            bottom: this.slotPositions[slot].bottom,
            width: size.width,
            height: size.height,
            z: isCentral ? 10 : 5,
            headerOpacity: isCentral ? 1 : 0,
        }
    }

    //Transitions

    goTo(newIndex) {
        if (this.isAnimating || newIndex === this.activeIndex) return
        this.isAnimating = true

        let previousSlots = this.currentSlotByCard.slice()
        this.activeIndex = newIndex
        this.slides.forEach((slide, index) => {
            this.currentSlotByCard[index] = this.physicalSlot(index)
        })

        //Moves longer than half the carousel would crawl across the screen — teleport those
        let wrapThreshold = this.totalSlides / 2

        const transition = this.animate(gsap.timeline({
            defaults: { duration: ANIMATION_DURATION, ease: ANIMATION_EASE },
            onComplete: () => { this.isAnimating = false },
        }))

        this.slides.forEach((slide, index) => {
            let state = this.slideState(index)
            let wraps = Math.abs(this.currentSlotByCard[index] - previousSlots[index]) > wrapThreshold

            if (wraps) {
                //Fade out -> instant jump -> fade in, all inside the shared duration
                let fadeDuration = ANIMATION_DURATION * 0.3
                transition.to(slide, { opacity: 0, duration: fadeDuration, ease: 'power2.in' }, 0)
                transition.set(slide, {
                    x: `${state.x}vw`,
                    bottom: `${state.bottom}vw`,
                    width: `${state.width}vw`,
                    height: `${state.height}vw`,
                    zIndex: state.z,
                }, fadeDuration)
                transition.to(slide, { opacity: 1, duration: fadeDuration, ease: 'power2.out' }, ANIMATION_DURATION - fadeDuration)
            } else {
                transition.to(slide, {
                    x: `${state.x}vw`,
                    bottom: `${state.bottom}vw`,
                    width: `${state.width}vw`,
                    height: `${state.height}vw`,
                    zIndex: state.z,
                }, 0)
            }

            let header = this.slideHeaders[index]
            if (header) {
                transition.to(header, {
                    opacity: state.headerOpacity,
                    duration: ANIMATION_DURATION * 0.5,
                    ease: 'power2.out',
                }, state.headerOpacity === 1 ? ANIMATION_DURATION * 0.5 : 0)
            }
        })

        this.dotFills.forEach((fill, index) => {
            if (fill) transition.to(fill, { opacity: index === this.activeIndex ? 1 : 0, duration: 0.3 }, 0)
        })

        this.swapTexts()
    }

    swapTexts() {
        let activeSlide = this.slides[this.activeIndex]
        let newContent = {
            role: activeSlide.querySelector('.team_data-role')?.innerHTML || '',
            quote: activeSlide.querySelector('.team_data-quote')?.innerHTML || '',
            description: activeSlide.querySelector('.team_data-description')?.innerHTML || '',
            signatureSource: activeSlide.querySelector('.team_data-sign')?.getAttribute('src') || '',
        }

        let elements = [
            this.textTargets.role,
            this.textTargets.quote,
            this.textTargets.description,
            this.textTargets.signature,
            this.numberTarget,
        ].filter((element) => element)
        if (elements.length === 0) return

        //Blur renders as squares on retina without these
        elements.forEach((element) => {
            element.style.willChange = 'filter, transform, opacity'
            element.style.backfaceVisibility = 'hidden'
        })

        const swap = this.animate(gsap.timeline({
            onComplete: () => {
                elements.forEach((element) => { element.style.willChange = 'auto' })
            },
        }))

        swap.to(elements, {
            y: `-${TEXT_SHIFT}`,
            opacity: 0,
            filter: `blur(${TEXT_BLUR_PX}px)`,
            duration: TEXT_EXIT_DURATION,
            stagger: TEXT_STAGGER,
            ease: 'power2.in',
        })

        swap.call(() => {
            if (this.textTargets.role) this.textTargets.role.innerHTML = newContent.role
            if (this.textTargets.quote) this.textTargets.quote.innerHTML = newContent.quote
            if (this.textTargets.description) this.textTargets.description.innerHTML = newContent.description
            if (this.numberTarget) this.numberTarget.innerHTML = this.activeIndex + 1
            if (this.textTargets.signature && newContent.signatureSource) {
                this.textTargets.signature.src = newContent.signatureSource
                this.textTargets.signature.removeAttribute('srcset')
            }
        })

        swap.fromTo(elements,
            { y: TEXT_SHIFT, opacity: 0, filter: `blur(${TEXT_BLUR_PX}px)` },
            {
                y: 0,
                opacity: 1,
                filter: 'blur(0px)',
                duration: TEXT_ENTRY_DURATION,
                stagger: TEXT_STAGGER,
                ease: 'power2.out',
            }
        )
    }

    //Controls

    next() {
        this.goTo((this.activeIndex + 1) % this.totalSlides)
    }

    previous() {
        this.goTo((this.activeIndex - 1 + this.totalSlides) % this.totalSlides)
    }

    bindControls() {
        if (this.nextButton) this.listen(this.nextButton, 'click', () => this.next())

        this.slides.forEach((slide, index) => {
            this.listen(slide, 'click', () => {
                if (index !== this.activeIndex && !this.isAnimating) this.goTo(index)
            })
        })

        this.dots.forEach((dot, index) => {
            this.listen(dot, 'click', () => {
                if (index !== this.activeIndex && !this.isAnimating && index < this.totalSlides) this.goTo(index)
            })
        })

        let dragStartX = 0
        let isDragging = false

        this.listen(this.track, 'mousedown', (event) => {
            dragStartX = event.clientX
            isDragging = true
        })
        this.listen(window, 'mouseup', (event) => {
            if (!isDragging) return
            isDragging = false
            let distance = dragStartX - event.clientX
            if (distance > DRAG_THRESHOLD_MOUSE) this.next()
            if (distance < -DRAG_THRESHOLD_MOUSE) this.previous()
        })

        this.listen(this.track, 'touchstart', (event) => {
            dragStartX = event.touches[0].clientX
        }, { passive: true })
        this.listen(this.track, 'touchend', (event) => {
            let distance = dragStartX - event.changedTouches[0].clientX
            if (distance > DRAG_THRESHOLD_TOUCH) this.next()
            if (distance < -DRAG_THRESHOLD_TOUCH) this.previous()
        })
    }
}
