import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Cases page (/cases). One .case-row is active at a time (fill: pages/cases/CaseRowFill.js);
//hover activates a row and wipes its preview into the sidebar. Each preview is its own <img>
//layer stacked on top of the last, revealed top to bottom through clip-path once decoded (no
//src swap mid-animation — that was the jitter); layers under a finished one are removed.
//Rows get numbered 01, 02, ... into .case-row_num (skipped silently until the
//element is added in Webflow).
//Only where CASE_ROW_HOVER_MEDIA matches (desktop with a real hover): elsewhere no row is active
//(taps fire mouseenter too). Crossing it live switches the active row on / off.

//Shared with CaseRowFill — the fill follows the same rule
export const CASE_ROW_HOVER_MEDIA = '(hover: hover) and (min-width: 992px)'

const PREVIEW_CLASS = 'cases-sidebar_preview'
const REVEAL_DURATION = 0.5
const REVEAL_EASE = 'power2.out'
const CLIP_HIDDEN = 'inset(0% 0% 100% 0%)' //collapsed onto the top edge
const CLIP_SHOWN = 'inset(0% 0% 0% 0%)'

export class CasesPage extends Module {

    setup() {
        this.rows = [...document.querySelectorAll('.case-row')]
        this.display = document.querySelector('.cases-sidebar_display')
        if (this.rows.length === 0 || !this.display) return

        //Cache preview sources — no querySelector on every hover
        this.rowSources = this.rows.map((row) => row.querySelector('.case-row_preview-img')?.getAttribute('src') || '')

        this.numberRows()
        this.preloadSources()
        this.currentSource = null
        this.previewRequest = 0
        this.activeIndex = -1
        this.hoverMedia = window.matchMedia(CASE_ROW_HOVER_MEDIA)

        if (this.hoverMedia.matches) this.setActive(0)

        this.rows.forEach((row, index) => {
            this.listen(row, 'mouseenter', () => {
                if (this.hoverMedia.matches) this.setActive(index)
            })
        })
        //No mouseleave — active row stays until another is hovered
        this.listen(this.hoverMedia, 'change', () => {
            if (this.hoverMedia.matches) this.setActive(0)
            else this.clearActive()
        })
    }

    //No active row — the preview in the (hidden) sidebar is left as is
    clearActive() {
        this.activeIndex = -1
        this.currentSource = null
        this.previewRequest++ //a preview still decoding is dropped
        this.rows.forEach((row) => row.classList.remove('is-active'))
    }

    //Numbering — pads to 2 digits, wider when 100+ cases show up someday
    numberRows() {
        let padLength = Math.max(2, String(this.rows.length).length)
        this.rows.forEach((row, index) => {
            let numberElement = row.querySelector('.case-row_num')
            if (numberElement) numberElement.textContent = String(index + 1).padStart(padLength, '0')
        })
    }

    //Warm the cache — first hover on each row shouldn't wait on the network
    preloadSources() {
        new Set(this.rowSources.filter(Boolean)).forEach((source) => {
            let image = new Image()
            image.src = source
        })
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

    //New layer on top, revealed once its image is decoded. A newer hover arriving while this
    //one decodes wins — the stale layer is dropped unshown
    async showPreview(source) {
        if (source === this.currentSource) return
        this.currentSource = source
        let request = ++this.previewRequest

        let layer = document.createElement('img')
        layer.className = PREVIEW_CLASS
        layer.alt = ''
        layer.src = source
        try {
            await layer.decode()
        } catch (error) {
            //Broken / undecodable — show it anyway rather than freeze the sidebar
        }
        if (request !== this.previewRequest || !this.display?.isConnected) return

        this.display.appendChild(layer)
        this.animate(gsap.fromTo(layer,
            { clipPath: CLIP_HIDDEN },
            {
                clipPath: CLIP_SHOWN,
                duration: REVEAL_DURATION,
                ease: REVEAL_EASE,
                onComplete: () => this.removeLayersBelow(layer),
            }
        ))
    }

    //Fully covered by the layer above — gone, so the stack stays one or two deep
    removeLayersBelow(layer) {
        let layers = [...this.display.querySelectorAll(`:scope > .${PREVIEW_CLASS}`)]
        layers.slice(0, layers.indexOf(layer)).forEach((below) => {
            gsap.killTweensOf(below)
            below.remove()
        })
    }
}
