// Tiny shared state + event bus for the experience.
export const state = {
  phase: 'loading', // loading | intro | map | focused
  active: null, // active destination id
  timeOfDay: 0, // 0 day -> 1 dusk
  audio: false,
}

const subs = {}
export function on(evt, fn) {
  ;(subs[evt] ||= []).push(fn)
  return () => {
    subs[evt] = subs[evt].filter((f) => f !== fn)
  }
}
export function emit(evt, payload) {
  ;(subs[evt] || []).forEach((f) => f(payload))
}
