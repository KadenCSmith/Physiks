import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export interface PlaybackOptions {
  loop: boolean
  temporarilyPaused?: boolean
  disabled?: boolean
  defaultSpeed: number
}

function usableDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0
}

function usableSpeed(speed: number, fallback = 1): number {
  return Number.isFinite(speed) && speed > 0 ? speed : fallback
}

/** Shared by seeking and duration changes; invalid times select the initial state. */
export function clampPlaybackTime(time: number, duration: number): number {
  const end = usableDuration(duration)
  return Number.isFinite(time) ? Math.min(end, Math.max(0, time)) : 0
}

/** Advance a time coordinate, without changing a model or the user's Play/Pause intent. */
export function advancePlayback(time: number, delta: number, speed: number, duration: number, loop: boolean): number {
  const end = usableDuration(duration)
  if (end === 0) return 0
  const current = clampPlaybackTime(time, end)
  const elapsed = Number.isFinite(delta) && delta > 0 ? delta : 0
  const rate = usableSpeed(speed)
  const increment = elapsed * rate
  // An unrepresentable step cannot supply a reliable periodic phase.
  if (!Number.isFinite(increment)) return loop ? current % end : end
  if (!loop) return increment >= end - current ? end : current + increment
  const phase = current % end
  const remainder = increment % end
  // Adding two huge finite phases directly could overflow before the modulus.
  return remainder >= end - phase ? remainder - (end - phase) : phase + remainder
}

/** Playback state is independent from physical parameters; reset and seek preserve pause intent. */
export function usePlayback(duration: number, {
  loop, temporarilyPaused = false, disabled = false, defaultSpeed,
}: PlaybackOptions) {
  const end = usableDuration(duration)
  const fallbackSpeed = usableSpeed(defaultSpeed)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeedState] = useState(fallbackSpeed)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const timeRef = useRef(0)
  const boundedTime = clampPlaybackTime(time, end)
  const ended = !loop && end > 0 && boundedTime >= end
  const setSpeed: Dispatch<SetStateAction<number>> = useCallback((next) => {
    setSpeedState((previous) => usableSpeed(typeof next === 'function' ? next(previous) : next, fallbackSpeed))
  }, [fallbackSpeed])
  const seek = useCallback((next: number) => {
    const value = clampPlaybackTime(next, end)
    timeRef.current = value
    setTime(value)
  }, [end])
  const reset = useCallback(() => {
    timeRef.current = 0
    setTime(0)
  }, [])

  useEffect(() => {
    timeRef.current = clampPlaybackTime(timeRef.current, end)
    setTime((previous) => clampPlaybackTime(previous, end))
  }, [end])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const visibility = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])

  useEffect(() => {
    if (!playing || temporarilyPaused || disabled || end === 0 || !visible || ended
      || typeof requestAnimationFrame === 'undefined' || typeof cancelAnimationFrame === 'undefined') return
    let handle = 0
    let previous = performance.now()
    let lastPaint = previous
    const frame = (now: number) => {
      const delta = (now - previous) / 1000
      previous = now
      timeRef.current = advancePlayback(timeRef.current, delta, speed, end, loop)
      if (!loop && timeRef.current >= end) {
        setTime(end)
        return
      }
      if (now - lastPaint >= 1000 / 30) {
        setTime(timeRef.current)
        lastPaint = now
      }
      handle = requestAnimationFrame(frame)
    }
    handle = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(handle)
  }, [playing, speed, end, loop, temporarilyPaused, disabled, visible, ended])

  return { time: boundedTime, playing, speed, ended, setPlaying, setSpeed, seek, reset }
}
