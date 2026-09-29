import { describe, expect, it } from "vitest"
import { spectrumBands, spectrumCsv } from "./spectrum-math"

describe("FFT spectrum presentation", () => {
  it("preserves a narrow tone near 1 kHz in logarithmic bands", () => {
    const bins = new Float32Array(4096).fill(-110)
    bins[171] = -12
    const bands = spectrumBands(bins, 48000, 8192)
    const peak = bands.reduce((a, b) => (a.db > b.db ? a : b))
    expect(peak.db).toBe(-12)
    expect(peak.frequency).toBeGreaterThan(950)
    expect(peak.frequency).toBeLessThan(1100)
    expect(bands.every((band, i) => i === 0 || band.frequency > bands[i - 1].frequency)).toBe(true)
  })
  it("handles silence and respects Nyquist at lower sample rates", () => {
    const bands = spectrumBands(new Float32Array(1024).fill(-Infinity), 16000, 2048)
    expect(bands.every((band) => band.db === -120 && Number.isFinite(band.frequency))).toBe(true)
    expect(bands.at(-1)!.frequency).toBeLessThan(8000)
  })
  it("exports actual FFT bin frequencies and finite silence values", () => {
    expect(spectrumCsv(new Float32Array([-Infinity, -32, -6]), 48000, 2048)).toBe(
      "frequency_hz,level_dbfs\n0,-120\n23.4375,-32\n46.875,-6",
    )
  })
})
