import { Module } from '../core/Module'

//Progressive blur — fills every .progressive-blur-container with LAYER_COUNT empty layers.
//All the look lives in main.css "Progressive Blur" (one blur radius + mask band per layer,
//by :nth-child), so retuning the ramp never touches this file.
//Layers go in first, before any existing children, so :nth-child counts them 1..LAYER_COUNT.

const CONTAINER_SELECTOR = '.progressive-blur-container'
const LAYER_CLASS = 'progressive-blur-layer'
const LAYER_COUNT = 6 //must match the :nth-child rules in main.css

export class ProgressiveBlur extends Module {

    setup() {
        this.layers = []

        document.querySelectorAll(CONTAINER_SELECTOR).forEach((container) => {
            if (container.querySelector(`:scope > .${LAYER_CLASS}`)) return

            let fragment = document.createDocumentFragment()
            for (let index = 0; index < LAYER_COUNT; index++) {
                let layer = document.createElement('div')
                layer.className = LAYER_CLASS
                layer.setAttribute('aria-hidden', 'true')
                fragment.appendChild(layer)
                this.layers.push(layer)
            }
            container.prepend(fragment)
        })
    }

    destroy() {
        this.layers?.forEach((layer) => layer.remove())
        this.layers = []
        super.destroy()
    }
}
