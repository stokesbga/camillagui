import { spectrumBands } from "./spectrum-math"
import { rainbowGradient } from "../utilities/rainbow"

export function drawSpectrum(
  element: HTMLCanvasElement | null,
  bins: Float32Array,
  sampleRate: number,
  fftSize: number,
  previousPeaks: number[],
  hold: boolean,
): number[] {
  let peaks = previousPeaks
  const bands = spectrumBands(bins, sampleRate, fftSize)
  peaks = bands.map((band, i) => Math.max(band.db, peaks[i] ?? -120))
  const ctx = element?.getContext("2d")
  if (!element || !ctx) return peaks
  const width = element.clientWidth
  const height = element.clientHeight
  const ratio = window.devicePixelRatio || 1
  if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
    element.width = Math.round(width * ratio)
    element.height = Math.round(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const left = 42,
    right = width - 18,
    top = 20,
    bottom = height - 35
  const maxFrequency = Math.min(20000, sampleRate / 2)
  const x = (frequency: number) => left + (Math.log(frequency / 20) / Math.log(maxFrequency / 20)) * (right - left)
  const y = (db: number) => top + ((0 - Math.max(-120, Math.min(0, db))) / 120) * (bottom - top)
  ctx.font = "11px ui-monospace, monospace"
  ctx.lineWidth = 1
  for (let db = 0; db >= -120; db -= 20) {
    ctx.fillStyle = "#999999"
    ctx.fillText(String(db), 8, y(db) + 4)
    ctx.strokeStyle = "#303030"
    ctx.beginPath()
    ctx.moveTo(left, y(db))
    ctx.lineTo(right, y(db))
    ctx.stroke()
  }
  for (const hz of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((hz) => hz <= maxFrequency)) {
    if (width < 500 && [50, 200, 2000, 10000].includes(hz)) continue
    ctx.fillStyle = "#999999"
    ctx.textAlign = "center"
    ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x(hz), height - 12)
    ctx.strokeStyle = "#252525"
    ctx.beginPath()
    ctx.moveTo(x(hz), top)
    ctx.lineTo(x(hz), bottom)
    ctx.stroke()
  }
  ctx.textAlign = "left"
  const trace = (values: number[]) => {
    ctx.beginPath()
    bands.forEach((band, i) => {
      if (i === 0) ctx.moveTo(x(band.frequency), y(values[i]))
      else ctx.lineTo(x(band.frequency), y(values[i]))
    })
  }
  trace(bands.map((band) => band.db))
  ctx.strokeStyle = rainbowGradient(ctx, left, right)
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.lineTo(x(bands[bands.length - 1].frequency), bottom)
  ctx.lineTo(x(bands[0].frequency), bottom)
  ctx.closePath()
  ctx.fillStyle = rainbowGradient(ctx, left, right, "20")
  ctx.fill()
  if (hold) {
    trace(peaks)
    ctx.strokeStyle = "#c0c0c0"
    ctx.setLineDash([3, 4])
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])
  }
  return peaks
}
