import React, { act } from "react"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { drawSpectrum } from "./draw-spectrum"
import { OutputSpectrum } from "./output-spectrum"

vi.mock("./draw-spectrum", () => ({ drawSpectrum: vi.fn(() => []) }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
const frame = { available: true, sample_rate: 48000, fft_size: 8192, channels: 2, bins: Array(4097).fill(-60) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  container = document.createElement("div")
  root = createRoot(container)
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(frame)))
  // Each poll must receive a fresh response body.
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(frame)))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function mount() {
  await act(async () => root.render(<OutputSpectrum labels={["Left", "Right"]} />))
}
function button(text: string) {
  return Array.from(container.querySelectorAll("button")).find((item) => item.textContent === text)!
}

it("loads master output automatically, selects channels, and cancels polling on unmount", async () => {
  await mount()
  expect(fetchMock.mock.calls[0][0]).toBe("/api/spectrum?fft_size=8192&channel=all")
  expect(drawSpectrum).toHaveBeenCalled()
  expect(container.textContent).toContain("Live · post-DSP")
  const channel = container.querySelector("select")!
  await act(async () => {
    channel.value = "1"
    channel.dispatchEvent(new Event("change", { bubbles: true }))
  })
  expect(fetchMock.mock.lastCall?.[0]).toBe("/api/spectrum?fft_size=8192&channel=1")
  const signal = fetchMock.mock.lastCall?.[1].signal as AbortSignal
  await act(async () => root.render(<div />))
  expect(signal.aborted).toBe(true)
  const calls = fetchMock.mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(fetchMock).toHaveBeenCalledTimes(calls)
})

it("freezes display updates and resumes without stopping the output stream", async () => {
  await mount()
  await act(async () => button("Freeze display").click())
  const draws = vi.mocked(drawSpectrum).mock.calls.length
  await act(async () => vi.advanceTimersByTimeAsync(200))
  expect(drawSpectrum).toHaveBeenCalledTimes(draws)
  await act(async () => button("Resume display").click())
  await act(async () => vi.advanceTimersByTimeAsync(100))
  expect(vi.mocked(drawSpectrum).mock.calls.length).toBeGreaterThan(draws)
})

it("handles older backends and clears stale data when the tap stops", async () => {
  fetchMock.mockImplementation(async () => new Response("Not found", { status: 404 }))
  await mount()
  expect(container.textContent).toContain("Update the backend")
  expect(button("Export CSV ↗").disabled).toBe(true)
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(frame)))
  await act(async () => button("Retry").click())
  expect(button("Export CSV ↗").disabled).toBe(false)
  await act(async () => button("Freeze display").click())
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ available: false, message: "Waiting for the ALSA playback tap." })),
  )
  await act(async () => vi.advanceTimersByTimeAsync(100))
  expect(container.textContent).toContain("Waiting for the ALSA playback tap.")
  expect(button("Export CSV ↗").disabled).toBe(true)
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(frame)))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(button("Freeze display").getAttribute("aria-pressed")).toBe("false")
  expect(button("Export CSV ↗").disabled).toBe(false)
})

it("rejects malformed FFT frames", async () => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ...frame, bins: ["bad"] })))
  await mount()
  expect(container.textContent).toContain("Invalid spectrum data")
  expect(drawSpectrum).not.toHaveBeenCalled()
})
