import { Module } from '../core/Module'

//Static city label + live local time in .timer-place / .timer-time
const CITY = 'BATUMI'
const TIMEZONE = 'Asia/Tbilisi'
const UPDATE_INTERVAL_MS = 60000

export class Clock extends Module {

    setup() {
        this.placeElements = [...document.querySelectorAll('.timer-place')]
        this.timeElements = [...document.querySelectorAll('.timer-time')]
        if (this.placeElements.length === 0 && this.timeElements.length === 0) return

        this.placeElements.forEach((element) => { element.textContent = CITY })
        if (this.timeElements.length === 0) return

        //Intl formatter is expensive — build once
        this.formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        })

        this.updateTime()
        this.every(() => this.updateTime(), UPDATE_INTERVAL_MS)
    }

    updateTime() {
        //Intl gives "4:45 PM" — design wants lowercase meridiem
        let formatted = this.formatter.format(new Date()).replace(/(AM|PM)$/i, (meridiem) => meridiem.toLowerCase())
        this.timeElements.forEach((element) => { element.textContent = formatted })
    }
}
