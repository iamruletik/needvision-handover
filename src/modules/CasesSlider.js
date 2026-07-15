import { gsap, Observer } from '../core/gsap'
import { Module } from '../core/Module'

//Cases carousel on the home page. The line of cards (.case_cards-line) moves,
//the single tag above it (.case_tag-text) stays and fade-swaps its text from the
//active card's hidden .case_tag-text-base. Drag on the overlay zone steps one
//slide per gesture; dots, card clicks and a custom cursor over the click zone.

//Step = card content width (24vw) + line gap (1vw)
const SLIDE_STEP_VW = 25
const TRACK_DURATION = 0.8
const CONTENT_DURATION = 0.4
const HOVER_DURATION = 0.4
const BACKGROUND_DURATION = 0.8
const DOT_DURATION = 0.4
const TAG_FADE_DURATION = 0.35
const DRAG_MINIMUM = 10
const DRAG_TOLERANCE = 20

const IDLE_BORDER = '#ffffff'
const HOVER_BORDER = 'rgba(255,255,255,0)'
const IDLE_BACKGROUND = '#ffffff'
const HOVER_BACKGROUND = '#8F8E84'

export class CasesSlider extends Module {

    setup() {
        this.slides = [...document.querySelectorAll('.case_card')]
        this.cardsLine = document.querySelector('.case_cards-line')
        if (this.slides.length === 0 || !this.cardsLine) return

        this.totalSlides = this.slides.length
        this.activeIndex = 0

        this.syncDotCount()
        this.dots = [...document.querySelectorAll('.cases_slider-dot')]
        this.backgroundImages = [...document.querySelectorAll('.case_bg-image')]
        this.fractionText = document.querySelector('.cases_fraction-txt')
        //The tag OUTSIDE the moving line — cards carry hidden .case_tag-text-base sources
        this.tagText = document.querySelector('.case_card-wrapper > .case_tag-text')
            || document.querySelector('.case_tag-text')

        gsap.set(this.backgroundImages, { opacity: 0 })

        this.bindCustomCursor()
        if (this.totalSlides > 1) {
            this.bindDrag()
            this.bindDots()
            this.bindCardHovers()
        }

        this.update(0)
    }

    //Webflow usually has a static dot count — remove extras, clone missing from the first
    syncDotCount() {
        let container = document.querySelector('.cases_slider-dots')
        if (!container) return

        let existing = [...container.querySelectorAll('.cases_slider-dot')]
        while (existing.length > this.totalSlides) existing.pop().remove()

        if (existing.length > 0 && existing.length < this.totalSlides) {
            let template = existing[0]
            while (existing.length < this.totalSlides) {
                let clone = template.cloneNode(true)
                clone.classList.remove('active')
                let fullImage = clone.querySelector('.cases_slider-dot-full')
                let emptyImage = clone.querySelector('.cases_slider-dot-empty')
                if (fullImage) fullImage.style.opacity = '0'
                if (emptyImage) emptyImage.style.opacity = '1'
                container.appendChild(clone)
                existing.push(clone)
            }
        }
    }

    //Custom cursor over the click zone — leads to the active case page

    bindCustomCursor() {
        let clickZone = document.querySelector('.case-click-zone')
        let cursorIcon = document.querySelector('.case-mouse-click')
        if (!clickZone || !cursorIcon) return

        clickZone.style.cursor = 'none'
        cursorIcon.style.cssText += `
            position: fixed !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            opacity: 0 !important;
            transform: translate(-50%, -50%) !important;
            transition: opacity 0.2s ease !important;
        `

        const moveX = gsap.quickTo(cursorIcon, 'left', { duration: 0.25, ease: 'power3.out' })
        const moveY = gsap.quickTo(cursorIcon, 'top', { duration: 0.25, ease: 'power3.out' })

        this.listen(clickZone, 'mouseenter', () => { cursorIcon.style.opacity = '1' })
        this.listen(clickZone, 'mouseleave', () => { cursorIcon.style.opacity = '0' })
        this.listen(clickZone, 'mousemove', (event) => {
            moveX(event.clientX)
            moveY(event.clientY)
        })
        this.listen(clickZone, 'click', () => {
            let activeSlide = this.slides[this.activeIndex]
            let link = activeSlide?.querySelector('a')?.getAttribute('href') || activeSlide?.getAttribute('data-href')
            if (link) window.location.href = link
        })
    }

    //Drag — one step per gesture. Observer fires onLeft/onRight every TOLERANCE px,
    //without the flag one long swipe jumps to the first/last slide.

    bindDrag() {
        let dragZone = document.querySelector('.case-drag-zone')
        if (!dragZone || this.cardsLine.contains(dragZone)) {
            dragZone = this.cardsLine.parentElement || this.cardsLine
        }
        dragZone.style.cursor = 'grab'
        dragZone.style.userSelect = 'none'
        dragZone.style.webkitUserSelect = 'none'

        let didStep = false

        this.animate(Observer.create({
            target: dragZone,
            type: 'touch,pointer',
            dragMinimum: DRAG_MINIMUM,
            tolerance: DRAG_TOLERANCE,
            onPress: () => {
                dragZone.style.cursor = 'grabbing'
                didStep = false
            },
            onRelease: () => {
                dragZone.style.cursor = 'grab'
                didStep = false
            },
            onLeft: () => {
                if (didStep) return
                didStep = true
                this.next()
            },
            onRight: () => {
                if (didStep) return
                didStep = true
                this.previous()
            },
            //Zone covers the cards — find the clicked card through it
            onClick: (self) => {
                let clicked = this.cardUnderPointer(self.event, dragZone)
                if (!clicked) return
                let index = this.slides.indexOf(clicked)
                if (index >= 0 && index !== this.activeIndex) this.update(index)
            },
        }))
    }

    cardUnderPointer(event, dragZone) {
        let x = event?.clientX
        let y = event?.clientY

        if (x != null && y != null) {
            let previousPointerEvents = dragZone.style.pointerEvents
            dragZone.style.pointerEvents = 'none'
            let underneath = document.elementFromPoint(x, y)
            dragZone.style.pointerEvents = previousPointerEvents
            let card = underneath?.closest?.('.case_card')
            if (card) return card
        }
        return event?.target?.closest?.('.case_card') || null
    }

    bindDots() {
        this.dots.forEach((dot, index) => {
            this.listen(dot, 'click', () => {
                if (this.activeIndex !== index) this.update(index)
            })
        })
    }

    //Hover on inactive cards only — gray fill, border melts away
    bindCardHovers() {
        this.slides.forEach((slide, index) => {
            let content = slide.querySelector('.case_card-content')
            if (!content) return

            this.listen(slide, 'mouseenter', () => {
                if (index === this.activeIndex) return
                gsap.to(content, {
                    backgroundColor: HOVER_BACKGROUND,
                    borderColor: HOVER_BORDER,
                    duration: HOVER_DURATION,
                    ease: 'power2.out',
                    overwrite: 'auto',
                })
            })
            this.listen(slide, 'mouseleave', () => {
                if (index === this.activeIndex) return
                gsap.to(content, {
                    backgroundColor: IDLE_BACKGROUND,
                    borderColor: IDLE_BORDER,
                    duration: HOVER_DURATION,
                    ease: 'power2.out',
                    overwrite: 'auto',
                })
            })
        })
    }

    //State

    next() {
        if (this.activeIndex < this.totalSlides - 1) this.update(this.activeIndex + 1)
    }

    previous() {
        if (this.activeIndex > 0) this.update(this.activeIndex - 1)
    }

    update(index) {
        this.activeIndex = index

        //Move the line, not the track — the tag lives in the wrapper above the line
        this.animate(gsap.to(this.cardsLine, {
            x: `-${index * SLIDE_STEP_VW}vw`,
            duration: TRACK_DURATION,
            ease: 'power2.inOut',
            overwrite: 'auto',
        }))

        if (this.fractionText) this.fractionText.textContent = `${index + 1}/${this.totalSlides}`

        this.dots.forEach((dot, dotIndex) => {
            let fullDot = dot.querySelector('.cases_slider-dot-full')
            if (fullDot) {
                gsap.to(fullDot, {
                    opacity: dotIndex === index ? 1 : 0,
                    duration: DOT_DURATION,
                    ease: 'power2.inOut',
                })
            }
        })

        this.backgroundImages.forEach((background, backgroundIndex) => {
            gsap.to(background, {
                opacity: backgroundIndex === index ? 1 : 0,
                duration: BACKGROUND_DURATION,
                ease: 'power2.inOut',
            })
        })

        //Active card sits transparent on the dark bg, idle cards are white plates
        this.slides.forEach((slide, slideIndex) => {
            let content = slide.querySelector('.case_card-content')
            let logo = slide.querySelector('.case_client-logo')
            let isActive = slideIndex === index
            if (!content) return

            gsap.to(content, {
                backgroundColor: isActive ? 'transparent' : IDLE_BACKGROUND,
                color: isActive ? '#ffffff' : '#000000',
                borderColor: IDLE_BORDER,
                duration: CONTENT_DURATION,
                overwrite: 'auto',
            })
            if (logo) {
                gsap.to(logo, {
                    filter: isActive ? 'brightness(0) invert(1)' : 'brightness(0) invert(0)',
                    duration: CONTENT_DURATION,
                    overwrite: 'auto',
                })
            }
        })

        this.swapTagText(index)
    }

    swapTagText(index) {
        if (!this.tagText) return

        let base = this.slides[index]?.querySelector('.case_tag-text-base')
        let newText = (base?.textContent || '').trim()
        if (!newText || newText === this.tagText.textContent.trim()) return

        this.animate(gsap.to(this.tagText, {
            opacity: 0,
            duration: TAG_FADE_DURATION,
            ease: 'power2.in',
            overwrite: 'auto',
            onComplete: () => {
                this.tagText.textContent = newText
                gsap.to(this.tagText, {
                    opacity: 1,
                    duration: TAG_FADE_DURATION + 0.04,
                    ease: 'power2.out',
                    overwrite: 'auto',
                })
            },
        }))
    }
}
