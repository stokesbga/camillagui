import React, { useEffect, useRef, useState } from "react"
import { drawSpectrum } from "./draw-spectrum"
import { download } from "./spectrum"
import { spectrumCsv } from "./spectrum-math"

interface SpectrumFrame {
  available: true
  sample_rate: number
  fft_size: number
  channels: number
  bins: number[]
}

function isSpectrumFrame(value: SpectrumFrame): boolean {
  return (
    value.available === true &&
    Number.isFinite(value.sample_rate) &&
    value.sample_rate >= 8000 &&
    [2048, 8192, 32768].includes(value.fft_size) &&
    Number.isInteger(value.channels) &&
    value.channels > 0 &&
    value.channels <= 64 &&
    Array.isArray(value.bins) &&
    value.bins.length === value.fft_size / 2 + 1 &&
    value.bins.every(Number.isFinite)
  )
}

export function OutputSpectrum({ labels }: { labels: (string | null)[] | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [fftSize, setFftSize] = useState(8192)
  const [channel, setChannel] = useState("all")
  const [smoothing, setSmoothing] = useState(0.8)
  const [hold, setHold] = useState(true)
  const [frozen, setFrozen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState("Connecting to output stream…")
  const [available, setAvailable] = useState(false)
  const [info, setInfo] = useState<{ sampleRate: number; channels: number }>()
  const peaks = useRef<number[]>([])
  const snapshot = useRef<{ bins: Float32Array; sampleRate: number; fftSize: number }>()
  const options = useRef({ smoothing, hold, frozen })
  useEffect(() => {
    options.current = { smoothing, hold, frozen }
  }, [smoothing, hold, frozen])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    let previous: Float32Array | undefined
    let previousRate: number | undefined
    peaks.current = []
    snapshot.current = undefined
    setAvailable(false)
    setFrozen(false)
    options.current.frozen = false
    setMessage("Connecting to output stream…")
    const poll = async () => {
      let delay = 100
      try {
        const response = await fetch(`/api/spectrum?fft_size=${fftSize}&channel=${channel}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          if (response.status === 400 && channel !== "all") {
            setChannel("all")
            return
          }
          throw new Error(
            response.status === 404
              ? "Update the backend to enable output spectrum."
              : "Output stream unavailable. Check the backend.",
          )
        }
        const data = await response.json()
        if (controller.signal.aborted) return
        if (!data || typeof data !== "object") throw new Error("Invalid spectrum data from backend.")
        if (data.available === false) {
          setAvailable(false)
          setFrozen(false)
          options.current.frozen = false
          snapshot.current = undefined
          peaks.current = []
          previous = undefined
          setMessage(typeof data.message === "string" ? data.message : "Waiting for output audio…")
          delay = 1000
        } else if (isSpectrumFrame(data) && data.fft_size === fftSize) {
          if (previousRate !== data.sample_rate) {
            previous = undefined
            peaks.current = []
          }
          previousRate = data.sample_rate
          setInfo((old) =>
            old?.sampleRate === data.sample_rate && old?.channels === data.channels
              ? old
              : { sampleRate: data.sample_rate, channels: data.channels },
          )
          if (!options.current.frozen) {
            const bins = new Float32Array(data.bins)
            if (previous && previous.length === bins.length) {
              for (let index = 0; index < bins.length; index++) {
                const power =
                  (1 - options.current.smoothing) * 10 ** (bins[index] / 10) +
                  options.current.smoothing * 10 ** (previous[index] / 10)
                bins[index] = 10 * Math.log10(Math.max(1e-12, power))
              }
            }
            previous = bins
            snapshot.current = { bins, sampleRate: data.sample_rate, fftSize: data.fft_size }
            peaks.current = drawSpectrum(
              canvas.current,
              bins,
              data.sample_rate,
              data.fft_size,
              peaks.current,
              options.current.hold,
            )
          }
          setAvailable(true)
          setMessage("")
        } else throw new Error("Invalid spectrum data from backend.")
      } catch (error) {
        if (controller.signal.aborted) return
        setAvailable(false)
        setFrozen(false)
        options.current.frozen = false
        snapshot.current = undefined
        previous = undefined
        peaks.current = []
        setMessage(error instanceof Error ? error.message : "Output stream unavailable.")
        delay = 2000
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, delay)
    }
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [fftSize, channel, revision])

  return (
    <div className="output-spectrum">
      <div className="analysis-toolbar">
        <label>
          Channel
          <select value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="all">All outputs · power average</option>
            {Array.from({ length: info?.channels ?? 0 }, (_, index) => (
              <option key={index} value={index}>
                {index}
                {labels?.[index] ? ` · ${labels[index]}` : ""}
              </option>
            ))}
          </select>
        </label>
        <span className={`connection-badge ${available ? "is-online" : ""}`}>
          <span className="status-dot" />
          {available ? (frozen ? "Frozen" : "Live · post-DSP") : "No stream"}
        </span>
      </div>
      <div className="spectrum-plot">
        <canvas ref={canvas} aria-label="Master output spectrum: frequency in hertz and level in dBFS" role="img" />
        {!available && (
          <div className="spectrum-placeholder" role="status">
            <span>{message}</span>
            <button className="secondary-action" onClick={() => setRevision((value) => value + 1)}>
              Retry
            </button>
          </div>
        )}
      </div>
      <div className="plot-caption">
        <span>
          <i className="legend-dot" />
          Level (dBFS)
          {hold && (
            <>
              <i className="legend-dot peak" />
              Peak hold
            </>
          )}
        </span>
        <span>Frequency (Hz)</span>
      </div>
      <div className="spectrum-settings">
        <label>
          FFT size
          <select value={fftSize} onChange={(event) => setFftSize(Number(event.target.value))}>
            <option value={2048}>2,048</option>
            <option value={8192}>8,192</option>
            <option value={32768}>32,768</option>
          </select>
        </label>
        <label>
          Smoothing
          <select value={smoothing} onChange={(event) => setSmoothing(Number(event.target.value))}>
            <option value={0}>Off</option>
            <option value={0.5}>Light</option>
            <option value={0.8}>Medium</option>
            <option value={0.95}>Heavy</option>
          </select>
        </label>
        <label className="check-label">
          <input type="checkbox" checked={hold} onChange={(event) => setHold(event.target.checked)} />
          Peak hold
        </label>
        <button
          className="secondary-action"
          disabled={!available}
          onClick={() => {
            peaks.current = []
          }}
        >
          Reset peaks
        </button>
        <button
          className="secondary-action"
          disabled={!available}
          aria-pressed={frozen}
          onClick={() => setFrozen(!frozen)}
        >
          {frozen ? "Resume display" : "Freeze display"}
        </button>
      </div>
      <div className="analysis-toolbar export-toolbar">
        <span className="muted">
          {available && info
            ? `${info.sampleRate / 1000} kHz · ${(info.sampleRate / fftSize).toFixed(2)} Hz/bin`
            : "— Hz/bin"}
        </span>
        <button
          className="text-action"
          disabled={!available}
          onClick={() => {
            const data = snapshot.current
            if (data)
              download(
                new Blob([spectrumCsv(data.bins, data.sampleRate, data.fftSize)], { type: "text/csv" }),
                "camilla-output-spectrum.csv",
              )
          }}
        >
          Export CSV ↗
        </button>
        <button
          className="text-action"
          disabled={!available}
          onClick={() =>
            canvas.current?.toBlob((blob) => {
              if (blob) download(blob, "camilla-output-spectrum.png")
            })
          }
        >
          Save image ↗
        </button>
      </div>
    </div>
  )
}
