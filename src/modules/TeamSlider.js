import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { SplitBlurReveal } from './SplitBlurReveal'
import { SignatureDraw } from './SignatureDraw'

//Home team section — the photos are the shared infinite gallery (GallerySlider, the
//"infinite-slider" component inside .team_slider-sync); this module drives what's around it,
//talking to the gallery through events on its stage.
//
//Intro — once, as soon as the slider comes into view after the page reveal: the gallery
//glides INTRO_LANES photos on its own ("it drags"), and when it lands the info panel writes
//itself in for that person — every .label-text and the texts rise in (SplitBlurReveal, DOM order),
//the signature draws. Until then texts and signature stay hidden.
//
//After the intro, gallery:settle swaps the panel to the centered person: name, role, quote,
//description and number play out, take the new text, play in; the signature redraws
//(SignatureDraw — inline SVG embed in .team-sign_wrapper; a plain <img> there falls back to
//a blur swap). Next button → gallery:step, dots → gallery:go (dots follow the person count).
//The name lives in .team_nav-spacer, under the central photo — placed by Webflow, not here.
//Each person's content lives on their pool image (.casepage_gallery-images):
//  data-name ("|" = line break), data-role, data-quote, data-description, data-sign (SVG URL)

const SYNC_SELECTOR = '.team_slider-sync'
const STAGE_SELECTOR = '[data-gallery="root"]'
const LABEL_SELECTOR = '.label-text'
const SETTLE_EVENT = 'gallery:settle'
const STEP_EVENT = 'gallery:step'
const GO_EVENT = 'gallery:go'
const GLIDE_EVENT = 'gallery:glide'
const LINE_SEPARATOR = '|'

//Intro — timed glide, then reveal
const INTRO_START = 'top bottom' //slider's top edge enters the viewport
const INTRO_LANES = 2 //negative = backwards
const INTRO_GLIDE_DURATION = 2
const INTRO_FALLBACK_MARGIN = 0.4 //glide refused (user mid-drag)? intro plays anyway after this
const INTRO_GAP = 0.06 //between consecutive revealed elements

//Swap — SplitBlurReveal, consecutive texts this far apart
const TEXT_GAP = 0.05

//<img> signature fallback — blur swap
const BLUR_EXIT_DURATION = 0.4
const BLUR_ENTRY_DURATION = 0.6
const BLUR_PX = 6
const BLUR_SHIFT = '0.69vw'
const DOT_DURATION = 0.3

//Swapped texts, in cascade order. number: the person's position, not a data attribute
const TEXT_FIELDS = [
    { key: 'name', selector: '.team_nav-spacer .team_data-name' },
    { key: 'role', selector: '.team_role-text' },
    { key: 'quote', selector: '.team_quote-text' },
    { key: 'description', selector: '.team_desc-text' },
    { key: 'number', selector: null },
]

export class TeamSlider extends Module {

    setup() {
        this.sync = document.querySelector(SYNC_SELECTOR)
        this.stage = this.sync?.querySelector(STAGE_SELECTOR)
        if (!this.stage) return

        //Person number lives in the second .label-wrapper inside .team_info-meta
        let metaLabels = this.sync.querySelectorAll('.team_info-meta .label-wrapper')
        let numberElement = metaLabels.length > 1
            ? metaLabels[1].querySelectorAll(LABEL_SELECTOR)[1] ?? null
            : null

        this.texts = TEXT_FIELDS
            .map(({ key, selector }) => {
                let element = key === 'number' ? numberElement : this.sync.querySelector(selector)
                if (!element) return null
                return { key, element, reveal: this.createReveal(element) }
            })
            .filter(Boolean)

        //Static labels ("Должность", "№ •", "пара слов") — intro only
        let textElements = this.texts.map((text) => text.element)
        this.labels = [...this.sync.querySelectorAll(LABEL_SELECTOR)]
            .filter((label) => !textElements.includes(label))
            .map((element) => ({ element, reveal: this.createReveal(element) }))

        //Inline SVG embed → draw; still the old <img> → blur swap
        let signatureContainer = this.sync.querySelector('.team-sign_wrapper')
        this.signatureDraw = signatureContainer?.querySelector('svg') ? new SignatureDraw(signatureContainer) : null
        this.signature = this.signatureDraw ? null : this.sync.querySelector('img.team-sign')
        this.signatureDraw?.hide()
        if (this.signature) gsap.set(this.signature, { opacity: 0 })

        this.nextButton = this.sync.querySelector('.team_nav-btn')
        this.dotsContainer = this.sync.querySelector('.team_pagination')
        this.dots = []
        this.activeIndex = -1
        this.lastDetail = null
        this.swapId = 0
        this.isRevealed = false
        this.isInView = false
        this.isIntroPending = false
        this.hasIntroPlayed = false

        this.listen(this.stage, SETTLE_EVENT, (event) => this.onSettle(event.detail))
        if (this.nextButton) {
            this.listen(this.nextButton, 'click', (event) => {
                event.preventDefault()
                this.stage.dispatchEvent(new CustomEvent(STEP_EVENT, { detail: { direction: 1 } }))
            })
        }

        this.animate(ScrollTrigger.create({
            trigger: this.stage,
            start: INTRO_START,
            once: true,
            onEnter: () => {
                this.isInView = true
                this.startIntro()
            },
        }))

        //Gallery mounted first — pick up where it already is
        if (this.stage.galleryState) this.onSettle({ ...this.stage.galleryState, isInitial: true })
    }

    //Called once the screen is visible
    reveal() {
        if (!this.stage || this.isRevealed) return
        this.isRevealed = true
        this.startIntro()
    }

    //Helpers

    createReveal(element) {
        return new SplitBlurReveal(element, { trigger: 'manual' }).mount()
    }

    onSettle(detail) {
        if (!detail) return
        //An intro glide can land on the same person (e.g. a full loop) and still has to play
        if (detail.index === this.activeIndex && !this.isIntroPending) return
        if (this.dots.length !== detail.count) this.syncDots(detail.count)

        let isFirst = this.activeIndex === -1
        this.activeIndex = detail.index
        this.lastDetail = detail
        this.setActiveDot(detail.index, isFirst)
        //The embed already holds the first person's signature — no fetch for that URL
        if (isFirst && this.signatureDraw) this.signatureDraw.currentUrl = detail.data?.sign ?? ''

        if (this.isIntroPending) {
            this.playIntro(detail)
            return
        }
        //Before the intro: text just follows, parked hidden for the intro to bring in
        if (!this.hasIntroPlayed) {
            this.applyTexts(detail)
            return
        }
        this.swapContent(detail)
    }

    //Webflow has a static dot count — trim extras, clone missing from the first
    syncDots(count) {
        if (!this.dotsContainer) return
        let existing = [...this.dotsContainer.querySelectorAll('.team_dot')]
        while (existing.length > count) existing.pop().remove()

        let template = existing[0]
        while (template && existing.length < count) {
            let clone = template.cloneNode(true)
            this.dotsContainer.appendChild(clone)
            existing.push(clone)
        }

        this.dots = existing
        this.dotFills = existing.map((dot) => dot.querySelector('.team_dot-full'))
        this.dots.forEach((dot, index) => {
            this.listen(dot, 'click', () => {
                if (index === this.activeIndex) return
                this.stage.dispatchEvent(new CustomEvent(GO_EVENT, { detail: { index } }))
            })
        })
    }

    setActiveDot(index, isInstant = false) {
        this.dotFills?.forEach((fill, dotIndex) => {
            if (!fill) return
            let opacity = dotIndex === index ? 1 : 0
            if (isInstant) gsap.set(fill, { opacity })
            else gsap.to(fill, { opacity, duration: DOT_DURATION, overwrite: 'auto' })
        })
    }

    textValue(key, { index, data = {} }, element) {
        if (key === 'number') return String(index + 1)
        return data[key] ?? element.textContent
    }

    //New text into every reveal, parked hidden — a field the person has no data for keeps its text
    applyTexts(detail) {
        this.texts?.forEach(({ key, element, reveal }) => {
            let value = this.textValue(key, detail, element)
            reveal.setText(value.split(LINE_SEPARATOR).map((line) => line.trim()).join('\n'))
        })
    }

    applyImageSignature({ data = {} }) {
        if (!this.signature || !data.sign) return
        this.signature.src = data.sign
        this.signature.removeAttribute('srcset')
    }

    //Animations

    //Slider in view + page revealed: the gallery glides, its settle plays the intro.
    //A refused glide (user already dragging) still gets the intro, on the current person
    startIntro() {
        if (!this.isRevealed || !this.isInView || this.hasIntroPlayed || this.isIntroPending) return
        this.isIntroPending = true
        this.stage.dispatchEvent(new CustomEvent(GLIDE_EVENT, {
            detail: { lanes: INTRO_LANES, duration: INTRO_GLIDE_DURATION },
        }))
        this.introFallback = gsap.delayedCall(INTRO_GLIDE_DURATION + INTRO_FALLBACK_MARGIN, () => {
            if (this.isIntroPending && this.lastDetail) this.playIntro(this.lastDetail)
        })
    }

    //Labels + texts rise in together, cascading in DOM order; the signature draws
    playIntro(detail) {
        this.isIntroPending = false
        this.hasIntroPlayed = true
        this.introFallback?.kill()

        this.applyTexts(detail)
        let reveals = [...this.labels, ...(this.texts ?? [])]
            .sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
        reveals.forEach(({ reveal }, index) => reveal.playIn(index * INTRO_GAP))

        if (this.signatureDraw) this.signatureDraw.swap(detail.data?.sign)
        else if (this.signature) {
            this.applyImageSignature(detail)
            gsap.to(this.signature, { opacity: 1, duration: BLUR_ENTRY_DURATION, ease: 'power2.out' })
        }
    }

    //Texts out, new person's texts in; a newer settle cuts this one off (newest wins).
    //The signature redraws alongside
    async swapContent(detail) {
        let swapId = ++this.swapId
        if (this.signatureDraw) this.signatureDraw.swap(detail.data?.sign)
        else this.swapImageSignature(detail)

        await Promise.all(this.texts.map((text, index) => text.reveal.playOut(index * TEXT_GAP)))
        if (swapId !== this.swapId || !this.texts) return

        this.applyTexts(detail)
        this.texts.forEach((text, index) => text.reveal.playIn(index * TEXT_GAP))
    }

    swapImageSignature(detail) {
        if (!this.signature) return

        //Blur renders as squares on retina without these
        this.signature.style.willChange = 'filter, transform, opacity'
        this.signature.style.backfaceVisibility = 'hidden'

        this.blurTimeline?.kill()
        this.blurTimeline = gsap.timeline({
            onComplete: () => { this.signature.style.willChange = 'auto' },
        })
            .to(this.signature, {
                y: `-${BLUR_SHIFT}`,
                opacity: 0,
                filter: `blur(${BLUR_PX}px)`,
                duration: BLUR_EXIT_DURATION,
                ease: 'power2.in',
            })
            .call(() => this.applyImageSignature(detail))
            .fromTo(this.signature,
                { y: BLUR_SHIFT, opacity: 0, filter: `blur(${BLUR_PX}px)` },
                { y: 0, opacity: 1, filter: 'blur(0px)', duration: BLUR_ENTRY_DURATION, ease: 'power2.out' }
            )
    }

    //Cleanup

    destroy() {
        this.swapId++
        this.introFallback?.kill()
        this.blurTimeline?.kill()
        this.signatureDraw?.destroy()
        this.signatureDraw = null
        if (this.signature) gsap.set(this.signature, { clearProps: 'transform,opacity,filter,willChange' })
        this.texts?.forEach((text) => text.reveal.destroy())
        this.texts = null
        this.labels?.forEach((label) => label.reveal.destroy())
        this.labels = []
        this.dotFills?.forEach((fill) => fill && gsap.killTweensOf(fill))
        super.destroy()
    }
}
