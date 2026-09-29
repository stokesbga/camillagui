import React, { act } from "react"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Spectrum } from "./spectrum"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe("spectrum input lifecycle", () => {
  let container: HTMLDivElement
  let root: Root
  let stopTrack: ReturnType<typeof vi.fn>
  let close: ReturnType<typeof vi.fn>
  let getUserMedia: ReturnType<typeof vi.fn>
  let stream: MediaStream
  beforeEach(async () => {
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
    stopTrack = vi.fn()
    close = vi.fn().mockResolvedValue(undefined)
    stream = { getTracks: () => [{ stop: stopTrack, onended: null }] } as unknown as MediaStream
    getUserMedia = vi.fn().mockResolvedValue(stream)
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } })
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running"
        sampleRate = 48000
        close = close
        resume = vi.fn().mockResolvedValue(undefined)
        createAnalyser = () => ({ frequencyBinCount: 4096, fftSize: 8192 })
        createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() })
      },
    )
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    await act(async () => root.render(<Spectrum />))
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
  async function click(text: string) {
    const button = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes(text),
    )!
    await act(async () => button.click())
  }
  it("requests no audio on mount and releases all input resources on stop", async () => {
    expect(getUserMedia).not.toHaveBeenCalled()
    await click("Start input")
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    expect(container.textContent).toContain("Listening")
    await click("Stop input")
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(container.textContent).toContain("Input stopped")
  })
  it("releases an input that arrives after permission was cancelled", async () => {
    let resolve!: (value: MediaStream) => void
    getUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((done) => {
          resolve = done
        }),
    )
    await click("Start input")
    await click("Cancel")
    await act(async () => resolve(stream))
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(container.textContent).not.toContain("Listening")
  })
  it("releases the microphone when leaving the view", async () => {
    await click("Start input")
    await act(async () => root.render(<div />))
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
  it("shows permission errors without leaving an audio context open", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"))
    await click("Start input")
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Permission denied")
    expect(close).toHaveBeenCalledOnce()
  })
})
