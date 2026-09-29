import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchResponse, responseTargets } from "./response"
import { defaultConfig, defaultFilter } from "../camilladsp/config"

// These tests assert compatibility with the existing Python backend contract.
describe("frequency response", () => {
  afterEach(() => vi.unstubAllGlobals())
  const chart = { name: "Test", f: [20, 1000, 20000], magnitude: [0, 0, 0], time: [], options: [] }
  it("keeps actual pipeline indices, including bypassed filter steps", () => {
    const config = defaultConfig()
    config.filters = { Bass: defaultFilter() }
    config.pipeline = [
      { type: "Mixer", name: "Stereo", description: null, bypassed: false },
      { type: "Filter", names: ["Bass"], channels: [0], description: null, bypassed: true },
    ]
    expect(responseTargets(config)).toEqual([
      expect.objectContaining({ id: "step:1", index: 1, label: expect.stringContaining("bypassed") }),
      expect.objectContaining({ id: "filter:Bass", name: "Bass" }),
    ])
  })
  it("sends the individual filter and selected coefficient variant", async () => {
    const config = defaultConfig()
    config.filters = { Bass: defaultFilter() }
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => chart })
    vi.stubGlobal("fetch", fetch)
    await expect(
      fetchResponse(config, responseTargets(config)[0], new AbortController().signal, 96000, 4),
    ).resolves.toEqual(chart)
    expect(fetch.mock.calls[0][0]).toBe("/api/evalfilter")
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      config: config.filters.Bass,
      name: "Bass",
      samplerate: 96000,
      channels: 4,
    })
  })
  it("sends the entire configuration for a filter step", async () => {
    const config = defaultConfig()
    config.pipeline = [{ type: "Filter", names: [], channels: null, description: null, bypassed: false }]
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => chart })
    vi.stubGlobal("fetch", fetch)
    await fetchResponse(config, responseTargets(config)[0], new AbortController().signal)
    expect(fetch.mock.calls[0][0]).toBe("/api/evalfilterstep")
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ config, index: 0, samplerate: 48000, channels: 2 })
  })
  it("surfaces backend errors and does not post an aborted request", async () => {
    const config = defaultConfig()
    const target = { id: "filter:missing", name: "missing", label: "Missing" }
    const fetch = vi.fn().mockResolvedValue({ ok: false, text: async () => "Coefficient file not found" })
    vi.stubGlobal("fetch", fetch)
    await expect(fetchResponse(config, target, new AbortController().signal)).rejects.toThrow(
      "Coefficient file not found",
    )
    fetch.mockClear()
    const controller = new AbortController()
    controller.abort()
    await expect(fetchResponse(config, target, controller.signal)).rejects.toMatchObject({ name: "AbortError" })
    expect(fetch).not.toHaveBeenCalled()
  })
})
