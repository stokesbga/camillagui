import React, { useCallback, useEffect, useRef, useState } from "react"
import { mdiMicrophoneOutline, mdiPlay, mdiStop } from "@mdi/js"
import Icon from "@mdi/react"
import { drawSpectrum } from "./draw-spectrum"
import { spectrumCsv } from "./spectrum-math"

export function download(content: Blob, name: string) {
  const url = URL.createObjectURL(content)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Spectrum() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const session = useRef<{
    context: AudioContext
    stream?: MediaStream
    source?: MediaStreamAudioSourceNode
    analyser?: AnalyserNode
  }>(undefined)
  const generation = useRef(0)
  const frame = useRef(0)
  const snapshot = useRef<{ bins: Float32Array; sampleRate: number; fftSize: number }>()
  const peaks = useRef<number[]>([])
  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [device, setDevice] = useState("")
  const [fftSize, setFftSize] = useState(8192)
  const [smoothing, setSmoothing] = useState(0.8)
  const [hold, setHold] = useState(true)
  const [frozen, setFrozen] = useState(false)
  const [sampleRate, setSampleRate] = useState<number>()
  const [hasData, setHasData] = useState(false)
  const options = useRef({ hold, frozen })
  useEffect(() => {
    options.current = { hold, frozen }
  }, [hold, frozen])

  const release = useCallback(() => {
    generation.current++
    cancelAnimationFrame(frame.current)
    const current = session.current
    session.current = undefined
    current?.stream?.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
    current?.source?.disconnect()
    if (current && current.context.state !== "closed") void current.context.close().catch(() => {})
  }, [])
  useEffect(() => release, [release])
  useEffect(() => {
    if (session.current?.analyser) {
      session.current.analyser.fftSize = fftSize
      session.current.analyser.smoothingTimeConstant = smoothing
      peaks.current = []
    }
  }, [fftSize, smoothing])

  const stop = () => {
    release()
    setRunning(false)
    setStarting(false)
    setFrozen(false)
  }
  const start = async () => {
    release()
    const attempt = generation.current
    setError("")
    setStarting(true)
    setFrozen(false)
    setHasData(false)
    options.current.frozen = false
    peaks.current = []
    snapshot.current = undefined
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext)
        throw new Error("Audio input requires a supported browser on HTTPS or localhost.")
      const context = new AudioContext()
      session.current = { context }
      await context.resume()
      if (attempt !== generation.current) return
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(device ? { deviceId: { exact: device } } : {}),
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      if (attempt !== generation.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      session.current!.stream = stream
      const analyser = context.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = smoothing
      analyser.minDecibels = -120
      analyser.maxDecibels = 0
      const source = context.createMediaStreamSource(stream)
      source.connect(analyser) // Never connect to the speakers: this is analysis only.
      session.current = { context, stream, analyser, source }
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          stop()
          setError("The audio input disconnected. Choose an available input and start again.")
        }
      })
      setSampleRate(context.sampleRate)
      setRunning(true)
      setStarting(false)
      void navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          if (attempt === generation.current) setDevices(list.filter((item) => item.kind === "audioinput"))
        })
        .catch(() => {})
      let bins = new Float32Array(analyser.frequencyBinCount)
      let receivedData = false
      let lastTime = 0
      const draw = (time: number) => {
        if (attempt !== generation.current) return
        frame.current = requestAnimationFrame(draw)
        if (time - lastTime < 40 || options.current.frozen) return
        lastTime = time
        if (bins.length !== analyser.frequencyBinCount) bins = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(bins)
        snapshot.current = { bins: bins.slice(), sampleRate: context.sampleRate, fftSize: analyser.fftSize }
        if (!receivedData) {
          receivedData = true
          setHasData(true)
        }
        peaks.current = drawSpectrum(
          canvas.current,
          bins,
          context.sampleRate,
          analyser.fftSize,
          peaks.current,
          options.current.hold,
        )
      }
      frame.current = requestAnimationFrame(draw)
    } catch (err) {
      if (attempt !== generation.current) return
      release()
      setStarting(false)
      setRunning(false)
      setError(err instanceof Error ? err.message : "Could not open the audio input.")
    }
  }

  return (
    <>
      <section className="surface-card spectrum-card">
        <div className="section-heading">
          <span className="subtle-badge" title="Local browser input, not the remote DSP stream">
            Browser input · dBFS
          </span>
          <span className={`connection-badge ${running ? "is-online" : ""}`}>
            <span className="status-dot" />
            {running ? (frozen ? "Frozen · input active" : "Listening") : "Input stopped"}
          </span>
        </div>
        <div className="analysis-toolbar">
          <label>
            Audio input
            <select value={device} onChange={(event) => setDevice(event.target.value)} disabled={running || starting}>
              <option value="">System default input</option>
              {devices.map((input) => (
                <option key={input.deviceId} value={input.deviceId}>
                  {input.label || "Audio input"}
                </option>
              ))}
            </select>
          </label>
          <button
            className={running || starting ? "secondary-action" : "primary-action"}
            onClick={running || starting ? stop : start}
          >
            <Icon path={running || starting ? mdiStop : mdiPlay} size={0.8} />
            {running ? "Stop input" : starting ? "Cancel" : "Start input"}
          </button>
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="spectrum-plot">
          <canvas ref={canvas} aria-label="Live audio spectrum: frequency in hertz and level in dBFS" role="img" />
          {!hasData && (
            <div className="spectrum-placeholder">
              <Icon path={mdiMicrophoneOutline} size={1.8} />
              <span>{starting ? "Waiting for permission…" : "Input stopped"}</span>
            </div>
          )}
        </div>
        <div className="plot-caption">
          <span>
            <i className="legend-dot" /> Level (dBFS){" "}
            {hold && (
              <>
                <i className="legend-dot peak" /> Peak hold
              </>
            )}
          </span>
          <span>Frequency (Hz)</span>
        </div>
        <div className="spectrum-settings">
          <label>
            FFT size
            <select value={fftSize} onChange={(event) => setFftSize(Number(event.target.value))} disabled={starting}>
              <option value={2048}>2,048</option>
              <option value={8192}>8,192</option>
              <option value={32768}>32,768</option>
            </select>
          </label>
          <label>
            Smoothing
            <select
              value={smoothing}
              onChange={(event) => setSmoothing(Number(event.target.value))}
              disabled={starting}
            >
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
            onClick={() => {
              peaks.current = []
            }}
            disabled={!running}
          >
            Reset peaks
          </button>
          <button
            className="secondary-action"
            aria-pressed={frozen}
            onClick={() => setFrozen((value) => !value)}
            disabled={!running}
          >
            {frozen ? "Resume display" : "Freeze display"}
          </button>
        </div>
        <div className="analysis-toolbar export-toolbar">
          <span className="muted">
            {sampleRate
              ? `${(sampleRate / 1000).toLocaleString()} kHz input · ${(sampleRate / fftSize).toFixed(2)} Hz/bin`
              : "— Hz/bin"}
          </span>
          <button
            className="text-action"
            disabled={!hasData}
            onClick={() => {
              const current = snapshot.current
              if (current)
                download(
                  new Blob([spectrumCsv(current.bins, current.sampleRate, current.fftSize)], { type: "text/csv" }),
                  "camilla-spectrum.csv",
                )
            }}
          >
            Export CSV ↗
          </button>
          <button
            className="text-action"
            disabled={!hasData}
            onClick={() =>
              canvas.current?.toBlob((blob) => {
                if (blob) download(blob, "camilla-spectrum.png")
              })
            }
          >
            Save image ↗
          </button>
        </div>
      </section>
    </>
  )
}
