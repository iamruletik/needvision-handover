import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Hero "scroll to explore" hint reveal: icon fades in, text lines rise out of
//JS-injected masks (one mask per <br>-separated line). Hidden in setup,
//plays on reveal() — after the preloader / eye transition.

const ROOT_SELECTOR = '.page_hero-scroll'
const ICON_SELECTOR = '.scroll-to-icon'
const TEXT_SELECTOR = '.casepage_hero-scroll-text'

//Icon
const ICON_FADE_DURATION = 0.8
const ICON_FADE_EASE = 'power2.out'

//Text Lines
const LINE_OFFSET_PERCENT = 110
const LINE_DURATION = 0.9
const LINE_STAGGER = 0.08
const LINE_EASE = 'power3.out'
const TEXT_DELAY = 0.1 //text trails the icon slightly

//Mask bleed so descenders (p, y) aren't clipped
const MASK_BLEED = '0.15em'

const LINE_MASK_CLASS = 'page_hero-scroll-line-mask'
const LINE_CLASS = 'page_hero-scroll-line'

export class HeroScrollReveal extends Module {

    setup() {
        this.isRevealed = false
        this.hints = [...document.querySelectorAll(ROOT_SELECTOR)].map((root) => {
            let icon = root.querySelector(ICON_SELECTOR)
            let text = root.querySelector(TEXT_SELECTOR)
            let originalTextHtml = text?.innerHTML
            let lines = text ? this.splitIntoMaskedLines(text) : []

            if (icon) gsap.set(icon, { autoAlpha: 0 })
            if (lines.length) gsap.set(lines, { yPercent: LINE_OFFSET_PERCENT })

            return { icon, text, lines, originalTextHtml }
        })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.hints?.length || this.isRevealed) return
        this.isRevealed = true

        this.hints.forEach(({ icon, lines }) => {
            if (icon) {
                this.animate(gsap.to(icon, {
                    autoAlpha: 1,
                    duration: ICON_FADE_DURATION,
                    ease: ICON_FADE_EASE,
                }))
            }
            if (lines.length) {
                this.animate(gsap.to(lines, {
                    yPercent: 0,
                    duration: LINE_DURATION,
                    stagger: LINE_STAGGER,
                    ease: LINE_EASE,
                    delay: TEXT_DELAY,
                }))
            }
        })
    }

    //Helpers

    //"Scroll <br>to explore" -> one mask > line per <br>-separated chunk
    splitIntoMaskedLines(element) {
        let lineTexts = ['']
        element.childNodes.forEach((node) => {
            if (node.nodeName === 'BR') lineTexts.push('')
            else lineTexts[lineTexts.length - 1] += node.textContent
        })
        lineTexts = lineTexts.map((lineText) => lineText.trim()).filter(Boolean)

        element.textContent = ''
        return lineTexts.map((lineText) => {
            let mask = document.createElement('span')
            mask.className = LINE_MASK_CLASS
            mask.style.display = 'block'
            mask.style.overflow = 'hidden'
            mask.style.paddingBottom = MASK_BLEED
            mask.style.marginBottom = `-${MASK_BLEED}`

            let line = document.createElement('span')
            line.className = LINE_CLASS
            line.style.display = 'block'
            line.textContent = lineText

            mask.appendChild(line)
            element.appendChild(mask)
            return line
        })
    }

    //Cleanup — restore Webflow markup and inline styles

    destroy() {
        super.destroy()
        this.hints?.forEach(({ icon, text, originalTextHtml }) => {
            if (text && originalTextHtml !== undefined) text.innerHTML = originalTextHtml
            if (icon) gsap.set(icon, { clearProps: 'opacity,visibility' })
        })
        this.hints = []
    }
}
