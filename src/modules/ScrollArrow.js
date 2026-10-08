import { Module } from '../core/Module'

//Hero "scroll to explore" arrow drops through its mask forever — falls out the bottom,
//its clone enters from the top. JS only builds the track (svg + clone above it);
//the loop itself is a CSS keyframe in main.css (.arrow-scroll-track).

const MASK_SELECTOR = '.arrow-scroll-icon-mask'
const TRACK_CLASS = 'arrow-scroll-track'
const CLONE_CLASS = 'arrow-scroll-clone'

export class ScrollArrow extends Module {

    setup() {
        this.tracks = []

        document.querySelectorAll(MASK_SELECTOR).forEach((mask) => {
            let svg = mask.querySelector('svg')
            if (!svg || mask.querySelector(`.${TRACK_CLASS}`)) return

            let track = document.createElement('div')
            track.className = TRACK_CLASS

            let clone = svg.cloneNode(true)
            clone.classList.add(CLONE_CLASS)
            clone.removeAttribute('id')
            clone.setAttribute('aria-hidden', 'true')

            mask.insertBefore(track, svg)
            track.append(svg, clone)
            this.tracks.push({ mask, track, svg, clone })
        })
    }

    //Cleanup — put the original svg back, drop the track

    destroy() {
        this.tracks?.forEach(({ mask, track, svg, clone }) => {
            clone.remove()
            mask.insertBefore(svg, track)
            track.remove()
        })
        this.tracks = []
        super.destroy()
    }
}
