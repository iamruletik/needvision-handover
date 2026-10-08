import { Module } from '../core/Module'

//Download icon button hover. JS only builds the DOM: svg wrapped in a mask with a
//track holding the svg + a clone one height (plus gap) above it. CSS does the motion
//(main.css "Arrow Download Icon"): button scales up, track drops — arrow rolls out
//the bottom, its clone rolls in from the top. Mouse-out rolls it back.

const BUTTON_SELECTOR = '.arrow-download-icon'
const MASK_CLASS = 'arrow-download-icon__mask'
const TRACK_CLASS = 'arrow-download-icon__track'
const CLONE_CLASS = 'arrow-download-icon__clone'

export class ArrowDownloadIcon extends Module {

    setup() {
        this.builds = []

        document.querySelectorAll(BUTTON_SELECTOR).forEach((button) => {
            let svg = button.querySelector('svg')
            if (!svg || button.querySelector(`.${MASK_CLASS}`)) return

            let mask = document.createElement('span')
            mask.className = MASK_CLASS

            let track = document.createElement('span')
            track.className = TRACK_CLASS

            let clone = svg.cloneNode(true)
            clone.classList.add(CLONE_CLASS)
            clone.removeAttribute('id')
            clone.setAttribute('aria-hidden', 'true')

            svg.parentNode.insertBefore(mask, svg)
            track.append(svg, clone)
            mask.appendChild(track)
            this.builds.push({ mask, svg, clone })
        })
    }

    //Cleanup — put the original svg back, drop mask + track

    destroy() {
        this.builds?.forEach(({ mask, svg, clone }) => {
            clone.remove()
            mask.parentNode?.insertBefore(svg, mask)
            mask.remove()
        })
        this.builds = []
        super.destroy()
    }
}
