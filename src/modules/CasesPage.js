import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Cases page (/cases). One .case-row is active at a time (fill animation lives in CSS);
//hover activates a row and swaps the sidebar preview through a clip-path hide -> reveal.
//Rows get numbered 01, 02, ... into .case-row_num (skipped silently until the
//element is added in Webflow).

const HIDE_DURATION = 0.3
const REVEAL_DURATION = 0.5

export class CasesPage extends Module {

    setup() {
        this.rows = [...document.querySelectorAll('.case-row')]
        this.display = document.querySelector('.cases-sidebar_display')
        if (this.rows.length === 0 || !this.display) return

        //Cache preview sources — no querySelector on every hover
        this.rowSources = this.rows.map((row) => row.querySelector('.case-row_preview-img')?.getAttribute('src') || '')

        this.numberRows()
        this.preview = this.ensurePreviewElement()
        this.currentSource = null
        this.activeIndex = -1
        this.switchTimeline = null

        this.setActive(0)

        this.rows.forEach((row, index) => {
            this.listen(row, 'mouseenter', () => this.setActive(index))
        })
        //No mouseleave — active row stays until another is hovered
    }

    //Numbering — pads to 2 digits, wider when 100+ cases show up someday
    numberRows() {
        let padLength = Math.max(2, String(this.rows.length).length)
        this.rows.forEach((row, index) => {
            let numberElement = row.querySelector('.case-row_num')
            if (numberElement) numberElement.textContent = String(index + 1).padStart(padLength, '0')
        })
    }

    //Preview img is a JS artifact (src always set at runtime) — created here, reused after
    ensurePreviewElement() {
        let preview = this.display.querySelector('.cases-sidebar_preview')
        if (preview) return preview

        preview = document.createElement('img')
        preview.className = 'cases-sidebar_preview'
        preview.alt = ''
        this.display.appendChild(preview)
        return preview
    }

    setActive(index) {
        if (index === this.activeIndex) return
        this.activeIndex = index

        this.rows.forEach((row, rowIndex) => {
            row.classList.toggle('is-active', rowIndex === index)
        })

        let source = this.rowSources[index]
        if (source) this.showPreview(source)
    }

    //hide -> swap -> reveal; first render skips the hide (CSS starts at full inset)
    showPreview(source) {
        if (source === this.currentSource) return
        if (this.switchTimeline) this.switchTimeline.kill()

        this.switchTimeline = this.animate(gsap.timeline())

        if (this.currentSource === null) {
            this.preview.src = source
            this.currentSource = source
            this.switchTimeline.to(this.preview, {
                clipPath: 'inset(0% 0 0 0)',
                duration: REVEAL_DURATION,
                ease: 'power2.out',
            })
            return
        }

        this.switchTimeline.to(this.preview, {
            clipPath: 'inset(100% 0 0 0)',
            duration: HIDE_DURATION,
            ease: 'power2.in',
        })
        this.switchTimeline.call(() => {
            this.preview.src = source
            this.currentSource = source
        })
        this.switchTimeline.to(this.preview, {
            clipPath: 'inset(0% 0 0 0)',
            duration: REVEAL_DURATION,
            ease: 'power2.out',
        })
    }
}
