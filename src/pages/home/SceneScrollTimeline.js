import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { HERO_IMAGE_TRIGGER_SELECTOR, HERO_IMAGE_TRIGGER_START } from '../../modules/HeroImageReveal'

//Drives the 3D scene's scroll progress from the page's own sections, so the video stays glued to
//them whatever their heights. Two anchors pin the video:
//  hero image reveal (HeroImageReveal's trigger, shared)  → video at VIDEO_PROGRESS_AT_IMAGE
//  manifesto lead reveal (home.js, same start as its SplitBlurReveal) → VIDEO_PROGRESS_AT_MANIFESTO
//The video runs at the rate through both, from where that line hits 0 (video start) to 1.
//Before the video start: scene 0 → SCENE_VIDEO_START over the scroll from page top (city, spotlight).
//Sent as SCENE_PROGRESS_EVENT on document — the scene (scene/ experience.ts) takes it over its own
//scroll listener. Re-sent when the scene reports ready, so a mid-page reload starts in sync.
//Tweak: the two shares below — higher = that section shows later in the video;
//hero-image's height in Webflow for how much scroll the video gets.

//Must match the scene: SCROLL_VIDEO_START (scene/ webgl-world/constants.ts) — video + transition start
const SCENE_VIDEO_START = 0.6
//Share of the video already played when each section reveals
const VIDEO_PROGRESS_AT_IMAGE = 0.3
const VIDEO_PROGRESS_AT_MANIFESTO = 0.5

const SCENE_PROGRESS_EVENT = 'scene-scroll-progress'
const SCENE_READY_EVENT = 'experience-ready'

export class SceneScrollTimeline extends Module {

    //manifestoLead — the rendered lead element; manifestoStart — its reveal's ScrollTrigger start
    constructor({ manifestoLead = null, manifestoStart = 'top 90%' } = {}) {
        super()
        this.manifestoLead = manifestoLead
        this.manifestoStart = manifestoStart
    }

    setup() {
        let videoTrigger = document.querySelector(HERO_IMAGE_TRIGGER_SELECTOR)
        if (!videoTrigger || !this.manifestoLead) return

        //Measure-only triggers — ScrollTrigger keeps their start current through refreshes
        this.imageTrigger = this.animate(ScrollTrigger.create({ trigger: videoTrigger, start: HERO_IMAGE_TRIGGER_START }))
        this.manifestoTrigger = this.animate(ScrollTrigger.create({ trigger: this.manifestoLead, start: this.manifestoStart }))

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
        let imagePoint = this.imageTrigger.start
        let manifestoPoint = this.manifestoTrigger.start
        let anchorDistance = manifestoPoint - imagePoint
        let progressDistance = VIDEO_PROGRESS_AT_MANIFESTO - VIDEO_PROGRESS_AT_IMAGE
        //Manifesto above the image (broken layout) or shares crossed: video runs out right away
        if (anchorDistance <= 0 || progressDistance <= 0) return 1

        //Video progress per scrolled px, and the scroll where it would be 0
        let rate = progressDistance / anchorDistance
        let videoStart = Math.max(0, imagePoint - VIDEO_PROGRESS_AT_IMAGE / rate)

        if (scroll <= videoStart) {
            return videoStart > 0 ? SCENE_VIDEO_START * (scroll / videoStart) : SCENE_VIDEO_START
        }

        let videoProgress = (scroll - videoStart) * rate
        return SCENE_VIDEO_START + (1 - SCENE_VIDEO_START) * Math.min(1, videoProgress)
    }

    send(scroll) {
        let progress = this.sceneProgress(scroll)
        document.dispatchEvent(new CustomEvent(SCENE_PROGRESS_EVENT, { detail: { progress } }))
    }
}
