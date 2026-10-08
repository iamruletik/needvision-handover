import { gsap, ScrollTrigger, SplitText } from '../../core/gsap'
import { Module } from '../../core/Module'
import { styleLineMasks } from './lineMasks'

//Company page "tabs" section — a vertical list of category buttons on the left
//drives the heading + description in the content column. Content per tab lives
//as data attributes on each button (data-tab-title/data-tab-description), so
//copy stays editable from Webflow without touching this file.
//
//Text swap: heading + description are split into masked lines (same look as the
//hero heading). Old lines rise out of their masks, text is replaced and re-split,
//new lines rise in from below. Blur sits on the text containers (heading /
//description), not on each line — one filter layer per block instead of one per line.
//
//Image swap: images in .companypage_tabs-visual carry the same data-tab-target as
//their button. Active image slides up and out, next one pushes in from below.
//Starts with the text exit; the tab is locked in at swap start so text and image match.
//
//Intro: plays when the page is revealed AND the section crossed INTRO_START —
//buttons fade in staggered, text runs the same entry as a tab change, visual rises in.

//Line Out
const LINE_EXIT_PERCENT = -150
const LINE_EXIT_DURATION = 0.4
const LINE_EXIT_STAGGER = 0.04
const LINE_EXIT_EASE = 'power3.in'

//Line In
const LINE_ENTER_PERCENT = 150
const LINE_ENTER_DURATION = 0.9
const LINE_ENTER_STAGGER = 0.06
const LINE_ENTER_EASE = 'power3.out'

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

const BLUR_PX = 12
const DESCRIPTION_DELAY = 0.1 //description trails the heading
const MASK_BLEED = '0.2em'

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
        this.splits = []
        this.isRevealed = false
        this.isInView = false
        this.hasIntroPlayed = false
        this.splitText()

        gsap.set(this.textBlocks(), { filter: `blur(${BLUR_PX}px)` })
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

    splitText() {
        this.splits = [this.heading, this.description].map((element) => SplitText.create(element, {
            type: 'lines',
            mask: 'lines',
            autoSplit: true,
            onSplit: (split) => {
                styleLineMasks(split.masks, MASK_BLEED)
                //Re-split before the intro (font load, resize) must stay hidden
                if (!this.hasIntroPlayed) gsap.set(split.lines, this.hiddenLineState())
            },
        }))
    }

    hiddenLineState() {
        return { yPercent: LINE_ENTER_PERCENT }
    }

    textBlocks() {
        return [this.heading, this.description]
    }

    imageFor(button) {
        let target = button?.dataset.tabTarget
        if (!target || !this.visual) return null
        return this.visual.querySelector(`[data-tab-target="${CSS.escape(target)}"]`)
    }

    revertSplits() {
        this.splits?.forEach((split) => split.revert())
        this.splits = []
    }

    renderTab(button) {
        this.revertSplits()
        this.heading.textContent = button.dataset.tabTitle || button.textContent.trim()
        this.description.textContent = button.dataset.tabDescription || ''
        this.displayedButton = button
        this.splitText()
    }

    //[heading lines, description lines] — read fresh, autoSplit may have replaced them
    currentLines() {
        return this.splits.map((split) => split.lines)
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

    playSwap() {
        this.isAnimating = true
        let targetButton = this.activeButton

        this.playImageSwap(targetButton)

        let exit = gsap.timeline({
            onComplete: () => {
                this.renderTab(targetButton)
                this.playEntry()
            },
        })
        this.animate(exit)

        this.currentLines().forEach((lines, index) => {
            let at = index * DESCRIPTION_DELAY
            exit.to(lines, {
                yPercent: LINE_EXIT_PERCENT,
                duration: LINE_EXIT_DURATION,
                stagger: LINE_EXIT_STAGGER,
                ease: LINE_EXIT_EASE,
            }, at)
            exit.to(this.textBlocks()[index], {
                filter: `blur(${BLUR_PX}px)`,
                duration: LINE_EXIT_DURATION,
                ease: LINE_EXIT_EASE,
            }, at)
        })
    }

    playEntry() {
        let entry = gsap.timeline({
            onComplete: () => {
                //Leftover filter keeps the layer expensive — drop it once done
                gsap.set(this.textBlocks(), { clearProps: 'filter' })
                this.isAnimating = false
                if (this.displayedButton !== this.activeButton) this.playSwap()
            },
        })
        this.animate(entry)

        this.currentLines().forEach((lines, index) => {
            let at = index * DESCRIPTION_DELAY
            entry.fromTo(lines,
                this.hiddenLineState(),
                {
                    yPercent: 0,
                    duration: LINE_ENTER_DURATION,
                    stagger: LINE_ENTER_STAGGER,
                    ease: LINE_ENTER_EASE,
                },
                at
            )
            entry.fromTo(this.textBlocks()[index],
                { filter: `blur(${BLUR_PX}px)` },
                { filter: 'blur(0px)', duration: LINE_ENTER_DURATION, ease: LINE_ENTER_EASE },
                at
            )
        })
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
        super.destroy()
        if (this.images?.length) gsap.set(this.images, { clearProps: 'transform' })
        if (this.buttons?.length) gsap.set(this.buttons, { clearProps: 'opacity,visibility' })
        if (this.visual) gsap.set(this.visual, { clearProps: 'transform,opacity,visibility' })
        if (this.heading && this.description) gsap.set(this.textBlocks(), { clearProps: 'filter' })
        this.revertSplits()
        if (this.originalTexts) {
            this.heading.innerHTML = this.originalTexts.heading
            this.description.innerHTML = this.originalTexts.description
        }
    }
}
