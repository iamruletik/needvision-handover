import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Drives the 3D scene's scroll progress from the page's own sections — each section's scroll range
//(its top at the viewport top → its bottom at the viewport top) plays one part of the scene:
//  .hero-main   city            scene 0 → SCENE_VIDEO_START
//  .hero-image  video           video 0 → VIDEO_PROGRESS_AT_MANIFESTO
//  .manifesto   end of video    → video 1, done when its bottom reaches the viewport bottom — the
//               canvas (sticky in .hero-scene-wrapper, which ends with the manifesto) leaves from there
//Retiming = section heights in Webflow (+ the one share below). Before the first range: scene 0;
//past the last: 1; a gap between ranges holds the previous range's end.
//Also exports HERO_IMAGE_REVEAL — the hero image (and its labels) reveal at IMAGE_AT_SHADER_PROGRESS
//of the shader transition that opens the video.
//Measured on refresh, mapped on scroll. Sent as SCENE_PROGRESS_EVENT on document — the scene
//(scene/ experience.ts) takes it over its own scroll listener. Re-sent when the scene reports
//ready, so a mid-page reload starts in sync.

//Must match the scene (scene/ webgl-world/constants.ts):
//SCROLL_VIDEO_START — video + shader transition start; SCROLL_TRANSITION_END — shader fully open
const SCENE_VIDEO_START = 0.6
const SCENE_TRANSITION_END = 0.75
//Share of the video played by the time the manifesto starts
const VIDEO_PROGRESS_AT_MANIFESTO = 0.8
//Where in the shader transition the hero image reveals — 0 shader starts, 1 fully open
const IMAGE_AT_SHADER_PROGRESS = 0.6

const SEGMENT_START = 'top top'
const SEGMENT_END = 'bottom top'

const SCENE_PROGRESS_EVENT = 'scene-scroll-progress'
const SCENE_READY_EVENT = 'experience-ready'

//Video share → scene progress
function videoToScene(videoProgress) {
    return SCENE_VIDEO_START + (1 - SCENE_VIDEO_START) * videoProgress
}

const SEGMENTS = [
    { selector: '.hero-main', from: 0, to: SCENE_VIDEO_START },
    { selector: '.hero-image', from: videoToScene(0), to: videoToScene(VIDEO_PROGRESS_AT_MANIFESTO) },
    { selector: '.manifesto', from: videoToScene(VIDEO_PROGRESS_AT_MANIFESTO), to: 1, end: 'bottom bottom' },
]

//Share of .hero-image's range at that point of the shader
const IMAGE_SCENE_PROGRESS = SCENE_VIDEO_START + (SCENE_TRANSITION_END - SCENE_VIDEO_START) * IMAGE_AT_SHADER_PROGRESS
const IMAGE_RANGE_SHARE = (IMAGE_SCENE_PROGRESS - SEGMENTS[1].from) / (SEGMENTS[1].to - SEGMENTS[1].from)

//ScrollTrigger trigger / start for the hero image reveal — its range is its own height (top top → bottom top)
export const HERO_IMAGE_REVEAL = {
    trigger: SEGMENTS[1].selector,
    start: (self) => `top+=${(self.trigger?.offsetHeight ?? 0) * IMAGE_RANGE_SHARE} top`,
}

export class SceneScrollTimeline extends Module {

    setup() {
        //Measure-only triggers — ScrollTrigger keeps their start / end current through refreshes
        this.segments = SEGMENTS.map((segment) => {
            let element = document.querySelector(segment.selector)
            if (!element) return null
            let trigger = this.animate(ScrollTrigger.create({ trigger: element, start: SEGMENT_START, end: segment.end ?? SEGMENT_END }))
            return { ...segment, trigger }
        }).filter(Boolean)

        if (this.segments.length !== SEGMENTS.length) {
            console.warn('SceneScrollTimeline: missing section, scene keeps its own scroll', SEGMENTS.map((segment) => segment.selector))
            return
        }

        this.scrollTrigger = this.animate(ScrollTrigger.create({
            start: 0,
            end: 'max',
            onUpdate: (self) => this.send(self.scroll()),
            onRefresh: (self) => this.send(self.scroll()),
        }))

        this.listen(document, SCENE_READY_EVENT, () => this.send(this.scrollTrigger.scroll()))
        this.send(this.scrollTrigger.scroll())
    }

    //Helpers

    sceneProgress(scroll) {
        let progress = 0
        for (let segment of this.segments) {
            let { start, end } = segment.trigger
            if (scroll < start) break
            if (scroll >= end || end <= start) {
                progress = segment.to
                continue
            }
            return segment.from + (segment.to - segment.from) * ((scroll - start) / (end - start))
        }
        return progress
    }

    send(scroll) {
        let progress = this.sceneProgress(scroll)
        document.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, { detail: { progress } }))
    }
}
