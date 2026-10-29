import { gsap } from '../../core/gsap'
import { Module } from '../../core/Module'
import { DrumNumber } from '../../modules/DrumNumber'
import { SplitBlurReveal } from '../../modules/SplitBlurReveal'

//Home bento graph card (#bento-graph) — plays once, the first time the card is on screen
//after the page reveal:
//  grid fades in, both chart lines draw together left to right (stroke-dashoffset), each end
//  dot riding the tip of its line; the numbers ($4,3M ×2, 7) roll in as drums meanwhile;
//  the metric labels' lines (each a Webflow div) rise in via SplitBlurReveal, LABEL_LINE_GAP apart.
//Chart is an inline svg in a Webflow embed: [data-chart-grid], [data-chart-line="key"],
//[data-chart-dot="key"] — a dot follows the line with the same key.

const CARD_SELECTOR = '#bento-graph'
const GRID_SELECTOR = '[data-chart-grid]'
const LINE_SELECTOR = '[data-chart-line]'
const DOT_SELECTOR = '[data-chart-dot]'
const NUMBER_SELECTORS = ['.bento_tag', '.bento_percentage-val']
const LABEL_LINE_SELECTOR = '.bento_metric-label > div'

const VISIBILITY_THRESHOLD = 0.3

//Grid
const GRID_DURATION = 0.6
const GRID_EASE = 'power2.out'

//Lines — start once the grid is half in
const LINE_DELAY = 0.3
const LINE_DURATION = 1.2
const LINE_EASE = 'power2.inOut'
const DOT_FADE_DURATION = 0.2

//Numbers roll with the lines
const NUMBER_DELAY = LINE_DELAY

//Labels — start with the grid, one line after another in DOM order
const LABEL_DELAY = 0
const LABEL_LINE_GAP = 0.08

export class BentoGraph extends Module {

    setup() {
        this.card = document.querySelector(CARD_SELECTOR)
        if (!this.card) return

        this.grid = this.card.querySelector(GRID_SELECTOR)
        this.lines = [...this.card.querySelectorAll(LINE_SELECTOR)].map((path) => this.prepareLine(path)).filter(Boolean)
        this.drums = NUMBER_SELECTORS
            .flatMap((selector) => [...this.card.querySelectorAll(selector)])
            .map((element) => new DrumNumber(element).mount())
        //One reveal per line so they cascade; parked hidden until tryPlay()
        this.labelReveals = [...this.card.querySelectorAll(LABEL_LINE_SELECTOR)]
            .map((line, index) => new SplitBlurReveal(line, {
                trigger: 'manual',
                delay: LABEL_DELAY + index * LABEL_LINE_GAP,
            }).mount())

        this.isRevealed = false
        this.isOnScreen = false
        this.hasPlayed = false

        if (this.grid) gsap.set(this.grid, { opacity: 0 })

        this.observe(new IntersectionObserver(([entry]) => {
            this.isOnScreen = entry.isIntersecting
            this.tryPlay()
        }, { threshold: VISIBILITY_THRESHOLD })).observe(this.card)
    }

    //Called once the screen is visible
    reveal() {
        if (!this.card || this.isRevealed) return
        this.isRevealed = true
        this.tryPlay()
    }

    //Helpers

    //Line hidden behind a full-length dash; its dot parked at the line's start, invisible
    prepareLine(path) {
        let length
        try {
            length = path.getTotalLength()
        } catch (error) {
            console.warn('BentoGraph: chart line not measurable, skipped', error)
            return null
        }
        if (!length) return null

        let key = path.dataset.chartLine
        let dot = this.card.querySelector(`${DOT_SELECTOR}[data-chart-dot="${CSS.escape(key)}"]`)
        let line = {
            path,
            length,
            dot,
            dotHome: dot ? { cx: dot.getAttribute('cx'), cy: dot.getAttribute('cy') } : null,
        }

        gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
        if (dot) {
            this.moveDotTo(line, 0)
            gsap.set(dot, { opacity: 0 })
        }
        return line
    }

    moveDotTo(line, distance) {
        let point = line.path.getPointAtLength(distance)
        line.dot.setAttribute('cx', point.x)
        line.dot.setAttribute('cy', point.y)
    }

    //Animations

    tryPlay() {
        if (!this.isRevealed || !this.isOnScreen || this.hasPlayed) return
        this.hasPlayed = true

        if (this.grid) this.animate(gsap.to(this.grid, { opacity: 1, duration: GRID_DURATION, ease: GRID_EASE }))
        this.lines.forEach((line) => this.drawLine(line))
        this.drums.forEach((drum) => drum.play(NUMBER_DELAY))
        this.labelReveals.forEach((reveal) => reveal.playIn())
    }

    drawLine(line) {
        let progress = { value: 0 }
        if (line.dot) this.animate(gsap.to(line.dot, { opacity: 1, duration: DOT_FADE_DURATION, delay: LINE_DELAY }))

        this.animate(gsap.to(progress, {
            value: 1,
            duration: LINE_DURATION,
            delay: LINE_DELAY,
            ease: LINE_EASE,
            onUpdate: () => {
                let drawn = line.length * progress.value
                line.path.style.strokeDashoffset = line.length - drawn
                if (line.dot) this.moveDotTo(line, drawn)
            },
            //Dot back on the exact spot the design put it; dash cleared so the line is plain again
            onComplete: () => {
                this.restoreLine(line)
                if (line.dot) gsap.set(line.dot, { clearProps: 'opacity' })
            },
        }))
    }

    restoreLine(line) {
        gsap.set(line.path, { clearProps: 'strokeDasharray,strokeDashoffset' })
        line.path.style.removeProperty('stroke-dashoffset')
        if (line.dot && line.dotHome) {
            line.dot.setAttribute('cx', line.dotHome.cx)
            line.dot.setAttribute('cy', line.dotHome.cy)
        }
    }

    //Cleanup — chart and numbers back to how Webflow has them

    destroy() {
        super.destroy()
        this.lines?.forEach((line) => {
            this.restoreLine(line)
            if (line.dot) gsap.set(line.dot, { clearProps: 'opacity' })
        })
        this.lines = []
        if (this.grid) gsap.set(this.grid, { clearProps: 'opacity' })
        this.drums?.forEach((drum) => drum.destroy())
        this.drums = []
        this.labelReveals?.forEach((reveal) => reveal.destroy())
        this.labelReveals = []
    }
}
