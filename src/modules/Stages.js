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
//Every text element is a manual SplitBlurReveal, cascading top to bottom. A swap plays the
//current text out, sets the next stage's text, plays it in — following the scroll: down, lines
//travel up; up, they travel down. Title / subtitle lines are cloned from the first line when a
//stage has more, hidden when it has fewer. The filled dot fades to the active stage.
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

export class Stages extends Module {

    setup() {
        this.section = document.querySelector('.stages')
        if (!this.section) return

        // this.buildBackgroundShift() //disabled — wrapper keeps its Webflow background
        this.buildImageReveals()

        this.card = this.section.querySelector('.stages_card')
        this.dots = [...(this.card?.querySelectorAll(DOT_SELECTOR) ?? [])]
        if (!this.card || this.dots.length === 0) return

        this.direction = DIRECTION_DOWN
        this.slots = SLOTS.map((slot) => this.createSlot(slot)).filter(Boolean)
        this.stages = this.dots.map((dot) => this.readStage(dot))
        this.currentStep = 0
        this.swapId = 0
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

            let parallaxShift = index % 2 === 0 ? -IMAGE_PARALLAX_PERCENT : IMAGE_PARALLAX_PERCENT
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

    //lines: every element the slot has ever used — Webflow's own first, clones after.
    //Only the first activeCount are shown; the rest sit hidden until a stage needs them
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
    applyStageText(index) {
        let stage = this.stages[index]
        if (!stage) return

        this.slots.forEach((slot) => {
            let texts = stage[slot.key] ?? []
            let count = Math.max(1, texts.length)
            while (slot.lines.length < count) this.addCloneLine(slot)

            slot.activeCount = count
            slot.lines.forEach((line, lineIndex) => {
                let isActive = lineIndex < count
                line.element.style.display = isActive ? '' : 'none'
                if (isActive) line.reveal.setText(texts[lineIndex] ?? '')
                else line.reveal.reset()
            })
        })
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

    async transitionTo(target) {
        if (target === this.currentStep) return
        if (target < 0 || target >= this.stages.length) return

        let direction = target > this.currentStep ? DIRECTION_DOWN : DIRECTION_UP
        this.currentStep = target
        let swapId = ++this.swapId
        this.setActiveDot(target)

        //Before the intro: text just switches, parked hidden for the intro to bring in
        if (!this.hasIntroPlayed) {
            this.applyStageText(target)
            return
        }

        //A newer swap cuts this one off — its playOut interrupts these tweens, the check drops the rest
        this.setDirection(direction)
        await Promise.all(this.activeReveals().map((reveal, index) => reveal.playOut(index * TEXT_GAP)))
        if (swapId !== this.swapId || !this.slots) return

        this.applyStageText(target)
        this.activeReveals().forEach((reveal, index) => reveal.playIn(index * TEXT_GAP))
    }

    //Cleanup — card back to its Webflow markup: clones gone, originals shown with their own text

    destroy() {
        this.swapId++
        this.slots?.forEach((slot) => slot.lines.forEach((line) => {
            line.reveal.destroy()
            if (line.isClone) {
                line.element.remove()
                return
            }
            line.element.innerHTML = line.originalHtml
            line.element.style.removeProperty('display')
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
