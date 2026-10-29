import { gsap, ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Company page "tabs" section — a vertical list of category buttons on the left
//drives the heading + description in the content column. Content per tab lives
//as data attributes on each button (data-tab-title/data-tab-description), so
//copy stays editable from Webflow without touching this file.
//
//Text swap: heading + description are two manual SplitBlurReveals (the site's line
//reveal). Old lines rise out of their masks, text is replaced and re-split, new lines
//rise in from below; the description trails the heading by DESCRIPTION_DELAY.
//
//Image swap: images in .companypage_tabs-visual carry the same data-tab-target as
//their button. Active image slides up and out, next one pushes in from below.
//Starts with the text exit; the tab is locked in at swap start so text and image match.
//
//Intro: plays when the page is revealed AND the section crossed INTRO_START —
//buttons fade in staggered, text runs the same entry as a tab change, visual rises in.

//Text Reveal — SplitBlurReveal options shared by heading and description.
//In / out offsets, blur (12px on the block) and mask bleed are the SplitBlurReveal defaults
const TEXT_REVEAL_OPTIONS = {
    trigger: 'manual',
    duration: 0.9,
    stagger: 0.06,
    ease: 'power3.out',
    out: { duration: 0.4, stagger: 0.04, ease: 'power3.in' },
}

//Image Push
const IMAGE_DURATION = 1.1
const IMAGE_EASE = 'power3.inOut'

//Intro
const INTRO_START = 'top center'
const BUTTON_FADE_DURATION = 0.5
const BUTTON_FADE_STAGGER = 0.04
const BUTTON_FADE_EASE = 'power2.out'
const VISUAL_OFFSET_PX = 200
const VISUAL_DURATION = 1.2
const VISUAL_EASE = 'expo.out'
const INTRO_TEXT_DELAY = 0.1

const DESCRIPTION_DELAY = 0.1 //description trails the heading, in and out

export class CompanyTabs extends Module {

    setup() {
        this.section = document.querySelector('.companypage_tabs-section')
        if (!this.section) return

        this.buttons = [...this.section.querySelectorAll('.companypage_tabs-item')]
        this.heading = this.section.querySelector('.companypage_tabs-heading')
        this.description = this.section.querySelector('.companypage_tabs-content .text_body')
        if (this.buttons.length === 0 || !this.heading || !this.description) return

        //activeButton — what the buttons show (instant), displayedButton — whose text is on screen
        this.activeButton = this.buttons.find((button) => button.classList.contains('is-active')) || this.buttons[0]
        this.displayedButton = this.activeButton
        this.isAnimating = false

        this.visual = this.section.querySelector('.companypage_tabs-visual')
        this.images = this.visual ? [...this.visual.querySelectorAll('[data-tab-target]')] : []
        this.activeImage = this.imageFor(this.activeButton)
        if (this.images.length) gsap.set(this.images, { yPercent: 100 })
        if (this.activeImage) gsap.set(this.activeImage, { yPercent: 0 })

        this.originalTexts = { heading: this.heading.innerHTML, description: this.description.innerHTML }
        this.isRevealed = false
        this.isInView = false
        this.hasIntroPlayed = false
        this.isDestroyed = false

        //Both start hidden (lines below their masks, blurred) until the intro plays them
        this.headingReveal = new SplitBlurReveal(this.heading, TEXT_REVEAL_OPTIONS).mount()
        this.descriptionReveal = new SplitBlurReveal(this.description, { ...TEXT_REVEAL_OPTIONS, delay: DESCRIPTION_DELAY }).mount()

        gsap.set(this.buttons, { autoAlpha: 0 })
        if (this.visual) gsap.set(this.visual, { y: VISUAL_OFFSET_PX, autoAlpha: 0 })

        this.buttons.forEach((button) => {
            this.listen(button, 'click', (event) => {
                event.preventDefault()
                this.selectTab(button)
            })
        })

        this.animate(ScrollTrigger.create({
            trigger: this.section,
            start: INTRO_START,
            once: true,
            onEnter: () => {
                this.isInView = true
                this.tryPlayIntro()
            },
        }))
    }

    //Called once the screen is visible
    reveal() {
        if (!this.section || this.isRevealed) return
        this.isRevealed = true
        this.tryPlayIntro()
    }

    //Buttons switch instantly; the swap never gets cut off. Clicks during a swap only
    //move the target — one more swap runs to the latest tab once the current one finishes.
    selectTab(button) {
        if (button === this.activeButton) return

        this.buttons.forEach((item) => {
            let isActive = item === button
            item.classList.toggle('is-active', isActive)
            item.setAttribute('aria-pressed', isActive ? 'true' : 'false')
        })
        this.activeButton = button

        if (!this.isAnimating) this.playSwap()
    }

    //Helpers

    textReveals() {
        return [this.headingReveal, this.descriptionReveal]
    }

    imageFor(button) {
        let target = button?.dataset.tabTarget
        if (!target || !this.visual) return null
        return this.visual.querySelector(`[data-tab-target="${CSS.escape(target)}"]`)
    }

    //New copy into both blocks — re-split and parked hidden, ready for playEntry()
    renderTab(button) {
        this.headingReveal.setText(button.dataset.tabTitle || button.textContent.trim())
        this.descriptionReveal.setText(button.dataset.tabDescription || '')
        this.displayedButton = button
    }

    //Animations

    tryPlayIntro() {
        if (!this.isRevealed || !this.isInView || this.hasIntroPlayed) return
        this.hasIntroPlayed = true

        this.animate(gsap.to(this.buttons, {
            autoAlpha: 1,
            duration: BUTTON_FADE_DURATION,
            stagger: BUTTON_FADE_STAGGER,
            ease: BUTTON_FADE_EASE,
        }))

        if (this.visual) {
            this.animate(gsap.to(this.visual, {
                y: 0,
                autoAlpha: 1,
                duration: VISUAL_DURATION,
                ease: VISUAL_EASE,
            }))
        }

        //Same entry as a tab change — also holds clicks in the swap queue until it's done
        this.isAnimating = true
        this.animate(gsap.delayedCall(INTRO_TEXT_DELAY, () => this.playEntry()))
    }

    //Old text out, new text in. The tab is locked in at the start so text and image match
    async playSwap() {
        this.isAnimating = true
        let targetButton = this.activeButton

        this.playImageSwap(targetButton)

        await Promise.all(this.textReveals().map((reveal) => reveal.playOut()))
        if (this.isDestroyed) return

        this.renderTab(targetButton)
        this.playEntry()
    }

    //Entry for both blocks; afterwards runs one more swap if a click moved the target meanwhile
    async playEntry() {
        await Promise.all(this.textReveals().map((reveal) => reveal.playIn()))
        if (this.isDestroyed) return

        this.isAnimating = false
        if (this.displayedButton !== this.activeButton) this.playSwap()
    }

    //Active image leaves upward, next one pushes in from below
    playImageSwap(button) {
        let nextImage = this.imageFor(button)
        let currentImage = this.activeImage
        if (!nextImage || nextImage === currentImage) return

        if (currentImage) {
            this.animate(gsap.to(currentImage, {
                yPercent: -100,
                duration: IMAGE_DURATION,
                ease: IMAGE_EASE,
            }))
        }
        this.animate(gsap.fromTo(nextImage,
            { yPercent: 100 },
            { yPercent: 0, duration: IMAGE_DURATION, ease: IMAGE_EASE }
        ))
        this.activeImage = nextImage
    }

    //Cleanup — kill timelines first, then restore Webflow markup

    destroy() {
        this.isDestroyed = true
        super.destroy()
        if (this.images?.length) gsap.set(this.images, { clearProps: 'transform' })
        if (this.buttons?.length) gsap.set(this.buttons, { clearProps: 'opacity,visibility' })
        if (this.visual) gsap.set(this.visual, { clearProps: 'transform,opacity,visibility' })
        this.headingReveal?.destroy()
        this.descriptionReveal?.destroy()
        if (this.originalTexts) {
            this.heading.innerHTML = this.originalTexts.heading
            this.description.innerHTML = this.originalTexts.description
        }
    }
}
