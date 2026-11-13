import { gsap, ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { SplitBlurReveal } from './SplitBlurReveal'

//Stages section — one card (.stages_card), its text swapped per stage as the section scrolls.
//Stage content lives on the pagination dots, one dot per stage:
//  data-stage-label     "этап 2"
//  data-stage-title     "go on|the board"            — "|" = line break, one element per line
//  data-stage-subtitle  "Даем весь|расклад"
//  data-stage-text      "Собрав всю информацию…"     — paragraph, wraps on its own
//A missing attribute falls back to what the card shows in Webflow (stage 1 needs none).
//Every text element is a manual SplitBlurReveal, cascading top to bottom. A swap is one motion:
//each shown line leaves as a ghost (a frozen copy laid over it, played out, then removed) while
//the real element already has the next stage's text and follows it in FOLLOW_GAP behind —
//following the scroll: down, lines travel up; up, they travel down. Title / subtitle always keep
//as many line elements as their longest stage (cloned from the first line); a stage with fewer
//fills the rest with an invisible line — the card's layout never changes, nothing below jumps.
//The filled dot fades to the active stage.
//The first stage reveals when the section scrolls in. Also: per-image reveal/parallax scrubs.

//Scroll share per stage — index 2 gets 30% of the range, others split the rest.
//Falls back to equal shares when the stage count differs.
const STAGE_WEIGHTS = [1, 1, 1.3, 1]

//Text slots, in cascade order. multiLine: "|" splits the attribute into one element per line
const SLOTS = [
    { key: 'label', selector: '.stages_step-label', attribute: 'data-stage-label', multiLine: false },
    { key: 'title', selector: '.stages_title', attribute: 'data-stage-title', multiLine: true },
    { key: 'subtitle', selector: '.stages_subtitle', attribute: 'data-stage-subtitle', multiLine: true },
    { key: 'text', selector: '.stages_p-text', attribute: 'data-stage-text', multiLine: false },
]
const LINE_SEPARATOR = '|'
const TEXT_GAP = 0.05 //between consecutive text elements
//New text starts this long after the old starts leaving — with the out (0.4s power3.in) against
//the in (1.1s power3.out) the two never meet inside a mask, even at 0
const FOLLOW_GAP = 0.1
const RESERVED_LINE_TEXT = ' ' //keeps an unused line's height, shows nothing
const RESIZE_DEBOUNCE = 0.15 //seconds — reserved heights re-measured after the resize settles
const GHOST_ATTRIBUTE = 'data-stages-ghost'
const GHOST_UNIT_ATTRIBUTE = 'data-stages-ghost-unit'

//Pagination
const DOT_SELECTOR = '.stages_dot'
const DOT_FULL_SELECTOR = '.stages_dot-full'
const DOT_DURATION = 0.3

//First stage — plays once the card comes into view after the page reveal
const INTRO_TRIGGER_SELECTOR = '.stages_cards'
const INTRO_START = 'top 80%'

const DIRECTION_DOWN = 'up' //scrolling down: lines travel up
const DIRECTION_UP = 'down'

//Background shift
const BACKGROUND_COLOR = '#FFFBF2'

//Image reveals
const IMAGE_RISE = '8.33vw'
const IMAGE_BLUR_PX = 12
const IMAGE_PARALLAX_PERCENT = 6
const RIGHT_GALLERY_SELECTOR = '.stages_gallery-right'
const RIGHT_IMAGE_PARALLAX_PERCENT = 3 //right gallery drifts slower

export class Stages extends Module {

    setup() {
        //Desktop section only — .stages.is-mobile has its own reveals (home.js), and ≤991 this one is display: none
        this.section = document.querySelector('.stages:not(.is-mobile)')
        if (!this.section || this.section.getClientRects().length === 0) return

        // this.buildBackgroundShift() //disabled — wrapper keeps its Webflow background
        this.buildImageReveals()

        this.card = this.section.querySelector('.stages_card')
        this.dots = [...(this.card?.querySelectorAll(DOT_SELECTOR) ?? [])]
        if (!this.card || this.dots.length === 0) return

        this.direction = DIRECTION_DOWN
        this.ghosts = []
        this.slots = SLOTS.map((slot) => this.createSlot(slot)).filter(Boolean)
        this.stages = this.dots.map((dot) => this.readStage(dot))
        this.reserveLines()
        this.reserveHeights()
        this.listen(window, 'resize', () => {
            this.resizeCall?.kill()
            this.resizeCall = gsap.delayedCall(RESIZE_DEBOUNCE, () => this.reserveHeights())
        })
        this.currentStep = 0
        this.isRevealed = false
        this.isInView = false
        this.hasIntroPlayed = false

        this.setupPagination()
        this.applyStageText(0)
        this.bindIntro()
        if (this.stages.length > 1) this.bindScrollProgress()
    }

    //Called once the screen is visible
    reveal() {
        if (!this.slots?.length || this.isRevealed) return
        this.isRevealed = true
        this.tryPlayIntro()
    }

    //Background — spotlight fades out, wrapper goes cream as the section arrives

    buildBackgroundShift() {
        const backgroundTimeline = this.animate(gsap.timeline({
            scrollTrigger: {
                trigger: this.section,
                start: 'top 85%',
                end: 'top 25%',
                scrub: true,
            },
        }))

        backgroundTimeline.to('.spotlight-overlay', { opacity: 0, duration: 0.3 }, 0)
        backgroundTimeline.to('.about-wrapper', { backgroundColor: BACKGROUND_COLOR, duration: 0.7 }, 0.3)
    }

    //Images — blur reveal on approach + slight alternating parallax

    buildImageReveals() {
        let images = [...this.section.querySelectorAll('.stages_img')]

        images.forEach((image, index) => {
            image.style.backfaceVisibility = 'hidden' //blur renders as squares on retina without this

            this.animate(gsap.fromTo(image,
                { y: IMAGE_RISE, opacity: 0, scale: 1.08, filter: `blur(${IMAGE_BLUR_PX}px)` },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    filter: 'blur(0px)',
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: image,
                        start: 'top 92%',
                        end: 'top 40%',
                        scrub: 2.5,
                    },
                }
            ))

            let parallaxPercent = image.closest(RIGHT_GALLERY_SELECTOR) ? RIGHT_IMAGE_PARALLAX_PERCENT : IMAGE_PARALLAX_PERCENT
            let parallaxShift = index % 2 === 0 ? -parallaxPercent : parallaxPercent
            this.animate(gsap.to(image, {
                yPercent: parallaxShift,
                ease: 'none',
                scrollTrigger: {
                    trigger: image,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 1.5,
                },
            }))
        })
    }

    //Setup Helpers

    //lines: Webflow's own elements first, reserveLines() clones after — all always shown
    createSlot(slot) {
        let elements = [...this.card.querySelectorAll(slot.selector)]
        if (elements.length === 0) return null

        let lines = elements.map((element) => ({
            element,
            originalHtml: element.innerHTML,
            isClone: false,
            reveal: this.createReveal(element),
        }))
        let layoutText = elements.map((element) => element.textContent.trim())
        return { ...slot, lines, activeCount: lines.length, layoutText }
    }

    createReveal(element) {
        return new SplitBlurReveal(element, {
            trigger: 'manual',
            direction: this.direction,
            out: { direction: this.direction },
        }).mount()
    }

    //{ label: ['…'], title: ['…', '…'], subtitle: [...], text: ['…'] } — layout text where a dot has no attribute
    readStage(dot) {
        let stage = {}
        this.slots.forEach((slot) => {
            let value = dot.getAttribute(slot.attribute)?.trim()
            if (!value) {
                stage[slot.key] = slot.multiLine ? slot.layoutText : [slot.layoutText.join(' ')]
                return
            }
            stage[slot.key] = slot.multiLine
                ? value.split(LINE_SEPARATOR).map((line) => line.trim()).filter(Boolean)
                : [value]
        })
        return stage
    }

    //Every dot gets a filled image — Webflow has it on the first one only; clones carry a flag for destroy
    setupPagination() {
        let template = this.card.querySelector(DOT_FULL_SELECTOR)
        this.dotFulls = this.dots.map((dot) => {
            let full = dot.querySelector(DOT_FULL_SELECTOR)
            if (full || !template) return full
            let clone = template.cloneNode(true)
            clone.dataset.stagesClone = ''
            dot.appendChild(clone)
            return clone
        })
        this.setActiveDot(0, true)
    }

    bindIntro() {
        let introTrigger = this.section.querySelector(INTRO_TRIGGER_SELECTOR) ?? this.section
        this.animate(ScrollTrigger.create({
            trigger: introTrigger,
            start: INTRO_START,
            once: true,
            onEnter: () => {
                this.isInView = true
                this.tryPlayIntro()
            },
        }))
    }

    bindScrollProgress() {
        let weights = STAGE_WEIGHTS.length === this.stages.length
            ? STAGE_WEIGHTS
            : this.stages.map(() => 1)

        let totalWeight = weights.reduce((sum, weight) => sum + weight, 0)

        //thresholds[i] = scroll progress where stage i becomes active
        this.thresholds = [0]
        for (let i = 0; i < weights.length - 1; i++) {
            this.thresholds.push(this.thresholds[i] + weights[i] / totalWeight)
        }

        this.animate(ScrollTrigger.create({
            trigger: this.section,
            start: 'top top',
            end: 'bottom bottom',
            onUpdate: (self) => {
                let index = 0
                for (let i = this.thresholds.length - 1; i >= 0; i--) {
                    if (self.progress >= this.thresholds[i]) {
                        index = i
                        break
                    }
                }
                this.transitionTo(index)
            },
        }))
    }

    //Text Helpers

    activeReveals() {
        return this.slots.flatMap((slot) => slot.lines.slice(0, slot.activeCount).map((line) => line.reveal))
    }

    setDirection(direction) {
        this.direction = direction
        this.slots.forEach((slot) => slot.lines.forEach((line) => line.reveal.setDirection(direction)))
    }

    //Writes a stage's text into the card, parked hidden on the entry side (setText) — follow with playIn
    //Every slot shows all its reserved lines — lines this stage doesn't use get RESERVED_LINE_TEXT
    applyStageText(index) {
        let stage = this.stages[index]
        if (!stage) return

        this.slots.forEach((slot) => {
            let texts = stage[slot.key] ?? []
            slot.activeCount = slot.lines.length
            slot.lines.forEach((line, lineIndex) => {
                line.reveal.setText(texts[lineIndex] || RESERVED_LINE_TEXT)
            })
        })
    }

    //Every line element's min-height = its tallest text across all stages (the paragraph wraps
    //differently per stage). The card never changes size on a swap — its sticky .stages_text-wrapper
    //can't shift. Measured on an invisible copy beside it, same width, so the real one isn't touched
    reserveHeights() {
        this.slots?.forEach((slot) => slot.lines.forEach((line, lineIndex) => {
            let probe = line.element.cloneNode(false)
            probe.removeAttribute('data-stages-clone')
            Object.assign(probe.style, {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: `${line.element.clientWidth}px`,
                minHeight: '0px',
                visibility: 'hidden',
                pointerEvents: 'none',
            })
            line.element.after(probe)

            let tallest = 0
            this.stages.forEach((stage) => {
                probe.textContent = stage[slot.key]?.[lineIndex] || RESERVED_LINE_TEXT
                tallest = Math.max(tallest, probe.offsetHeight)
            })
            probe.remove()
            line.element.style.minHeight = `${tallest}px`
        }))
    }

    //Line elements up to the longest stage, per slot — once, before any text goes in
    reserveLines() {
        this.slots.forEach((slot) => {
            let count = Math.max(1, ...this.stages.map((stage) => stage[slot.key]?.length ?? 0))
            while (slot.lines.length < count) this.addCloneLine(slot)
            slot.activeCount = slot.lines.length
        })
    }

    //Ghosts — frozen copies of every shown line, laid exactly over it as its sibling (same parent,
    //so inherited type — .stages_meta-row's uppercase — carries over), absolute against their own
    //containing block. Copied mid-animation too: a line's yPercent and its element's blur carry
    //over, so the ghost leaves from exactly where the line was
    createGhosts() {
        return this.slots.flatMap((slot) => slot.lines.slice(0, slot.activeCount)).map((line, index) => {
            let item = line.reveal.items?.[0]
            if (!item?.units?.length) return null

            //Tag the moving units so the copy can find its own
            let yPercents = item.units.map((unit) => Number(gsap.getProperty(unit, 'yPercent')) || 0)
            item.units.forEach((unit) => unit.setAttribute(GHOST_UNIT_ATTRIBUTE, ''))
            let ghost = line.element.cloneNode(true)
            item.units.forEach((unit) => unit.removeAttribute(GHOST_UNIT_ATTRIBUTE))

            let rect = line.element.getBoundingClientRect()
            ghost.setAttribute(GHOST_ATTRIBUTE, '')
            ghost.setAttribute('aria-hidden', 'true')
            ghost.removeAttribute('data-stages-clone')
            Object.assign(ghost.style, {
                position: 'absolute',
                left: '0px',
                top: '0px',
                width: `${rect.width}px`,
                margin: '0',
                pointerEvents: 'none',
                display: '',
            })
            line.element.after(ghost)

            //Now it has a containing block — place it on the line's current on-screen box
            let ghostRect = ghost.getBoundingClientRect()
            ghost.style.left = `${rect.left - ghostRect.left}px`
            ghost.style.top = `${rect.top - ghostRect.top}px`

            let units = [...ghost.querySelectorAll(`[${GHOST_UNIT_ATTRIBUTE}]`)]
            //Clone carries the transform as a matrix — GSAP would read it as px; hand it the yPercent instead
            units.forEach((unit, unitIndex) => gsap.set(unit, { y: 0, yPercent: yPercents[unitIndex] }))
            return { element: ghost, units, reveal: line.reveal, index }
        }).filter(Boolean)
    }

    //New line after the slot's last one, same classes as its first
    addCloneLine(slot) {
        let template = slot.lines[0].element
        let clone = template.cloneNode(false)
        clone.dataset.stagesClone = ''
        slot.lines[slot.lines.length - 1].element.after(clone)
        slot.lines.push({ element: clone, originalHtml: '', isClone: true, reveal: this.createReveal(clone) })
    }

    //Animations

    setActiveDot(index, isInstant = false) {
        this.dotFulls.forEach((full, dotIndex) => {
            if (!full) return
            let opacity = dotIndex === index ? 1 : 0
            if (isInstant) gsap.set(full, { opacity })
            else gsap.to(full, { opacity, duration: DOT_DURATION, ease: 'power2.out', overwrite: 'auto' })
        })
    }

    //Whatever stage is current when the intro is allowed plays in (usually the first)
    tryPlayIntro() {
        if (!this.isRevealed || !this.isInView || this.hasIntroPlayed) return
        this.hasIntroPlayed = true
        this.setDirection(DIRECTION_DOWN)
        this.activeReveals().forEach((reveal, index) => reveal.playIn(index * TEXT_GAP))
    }

    //Old lines leave as ghosts, the new text follows FOLLOW_GAP behind — one motion, no empty beat.
    //A newer swap mid-way ghosts whatever is showing then (entering lines included), from where it is
    transitionTo(target) {
        if (target === this.currentStep) return
        if (target < 0 || target >= this.stages.length) return

        let direction = target > this.currentStep ? DIRECTION_DOWN : DIRECTION_UP
        this.currentStep = target
        this.setActiveDot(target)

        //Before the intro: text just switches, parked hidden for the intro to bring in
        if (!this.hasIntroPlayed) {
            this.applyStageText(target)
            return
        }

        this.setDirection(direction)
        let ghosts = this.createGhosts()
        this.applyStageText(target)
        ghosts.forEach((ghost) => this.playGhostOut(ghost, ghost.index * TEXT_GAP))
        this.activeReveals().forEach((reveal, index) => reveal.playIn(index * TEXT_GAP + FOLLOW_GAP))
    }

    //Same motion as the reveal's own out (its options), then the copy is gone
    playGhostOut(ghost, delay) {
        let { blur } = ghost.reveal.options
        let { direction, offset, duration, stagger, ease } = ghost.reveal.options.out
        let timeline = gsap.timeline({
            delay,
            onComplete: () => this.removeGhost(ghost),
        })
        timeline.to(ghost.units, { yPercent: direction === 'down' ? offset : -offset, duration, stagger, ease }, 0)
        if (blur > 0) timeline.to(ghost.element, { filter: `blur(${blur}px)`, duration, ease }, 0)
        ghost.timeline = timeline
        this.ghosts.push(ghost)
    }

    removeGhost(ghost) {
        ghost.timeline?.kill()
        ghost.element.remove()
        this.ghosts = this.ghosts.filter((other) => other !== ghost)
    }

    //Cleanup — card back to its Webflow markup: clones gone, originals shown with their own text

    destroy() {
        ;[...(this.ghosts ?? [])].forEach((ghost) => this.removeGhost(ghost))
        this.ghosts = []
        this.resizeCall?.kill()
        this.slots?.forEach((slot) => slot.lines.forEach((line) => {
            line.element.style.removeProperty('min-height')
            line.reveal.destroy()
            if (line.isClone) {
                line.element.remove()
                return
            }
            line.element.innerHTML = line.originalHtml
        }))
        this.slots = null
        this.dotFulls?.forEach((full) => {
            if (!full) return
            gsap.killTweensOf(full)
            if (full.hasAttribute('data-stages-clone')) full.remove()
            else gsap.set(full, { clearProps: 'opacity' })
        })
        this.dotFulls = []
        super.destroy()
    }
}
