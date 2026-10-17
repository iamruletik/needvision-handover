import { Module } from '../core/Module'

//Static city label + live local time in .timer-place / .timer-time (footer, "4:45 pm")
//and .header-content-time-text (header, "4:45 PM")
const CITY = 'BATUMI'
const TIMEZONE = 'Asia/Tbilisi'
const UPDATE_INTERVAL_MS = 60000

export class Clock extends Module {

    setup() {
        this.placeElements = [...document.querySelectorAll('.timer-place')]
        this.timeElements = [...document.querySelectorAll('.timer-time')]
        this.headerTimeElements = [...document.querySelectorAll('.header-content-time-text')]
        if (this.placeElements.length === 0 && this.timeElements.length === 0 && this.headerTimeElements.length === 0) return

        this.placeElements.forEach((element) => { element.textContent = CITY })
        if (this.timeElements.length === 0 && this.headerTimeElements.length === 0) return

        //Intl formatter is expensive — build once
        this.formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        })

        //First refresh on the next whole minute, then every minute — flips with the real clock
        this.updateTime()
        this.later(() => {
            this.updateTime()
            this.every(() => this.updateTime(), UPDATE_INTERVAL_MS)
        }, UPDATE_INTERVAL_MS - (Date.now() % UPDATE_INTERVAL_MS))
    }

    updateTime() {
        //Intl gives "4:45 PM" — header uses it as is, footer design wants lowercase meridiem
        let formatted = this.formatter.format(new Date())
        let footerFormatted = formatted.replace(/(AM|PM)$/i, (meridiem) => meridiem.toLowerCase())
        this.headerTimeElements.forEach((element) => { element.textContent = formatted })
        this.timeElements.forEach((element) => { element.textContent = footerFormatted })
    }
}
