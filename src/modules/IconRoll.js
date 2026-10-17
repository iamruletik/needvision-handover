import { Module } from '../core/Module'

//Reusable icon "drum" on hover. JS only builds the DOM: each matched element's svg goes
//into a mask > track holding the svg + a clone. Where the clone waits and which way the
//track moves is all CSS, under the given class prefix (main.css), so one class serves any
//direction. Mouse-out rolls it back.
//Usage: new IconRoll('#header-cases-link .arrow-line', 'header-arrow-roll').mount()
//  → .header-arrow-roll__mask / __track / __clone

export class IconRoll extends Module {

    constructor(selector, classPrefix) {
        super()
        this.selector = selector
        this.classPrefix = classPrefix
    }

    setup() {
        this.builds = []
        if (!this.selector || !this.classPrefix) return

        let maskClass = `${this.classPrefix}__mask`

        document.querySelectorAll(this.selector).forEach((holder) => {
            let svg = holder.querySelector('svg')
            if (!svg || holder.querySelector(`.${maskClass}`)) return

            let mask = document.createElement('span')
            mask.className = maskClass

            let track = document.createElement('span')
            track.className = `${this.classPrefix}__track`

            let clone = svg.cloneNode(true)
            clone.classList.add(`${this.classPrefix}__clone`)
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
