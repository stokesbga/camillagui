/** Reduce FFT bins into logarithmic bands without averaging decibels. */
export function spectrumBands(bins: Float32Array, sampleRate: number, fftSize: number, count = 160) {
  const min = 20
  const max = Math.min(20000, sampleRate / 2)
  const resolution = sampleRate / fftSize
  return Array.from({ length: count }, (_, index) => {
    const low = min * (max / min) ** (index / count)
    const high = min * (max / min) ** ((index + 1) / count)
    const start = Math.max(1, Math.min(bins.length - 1, Math.floor(low / resolution)))
    const end = Math.min(bins.length, Math.max(start + 1, Math.ceil(high / resolution)))
    let db = -120
    for (let bin = start; bin < end; bin++) if (Number.isFinite(bins[bin])) db = Math.max(db, bins[bin])
    return { frequency: Math.sqrt(low * high), db: Math.min(0, db) }
  })
}

export function spectrumCsv(bins: Float32Array, sampleRate: number, fftSize: number) {
  return (
    "frequency_hz,level_dbfs\n" +
    Array.from(bins, (db, index) => `${(index * sampleRate) / fftSize},${Number.isFinite(db) ? db : -120}`).join("\n")
  )
}
