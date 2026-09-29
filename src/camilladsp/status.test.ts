import { afterEach, expect, it, vi } from "vitest"
import { defaultStatus, StatusPoller } from "./status"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("does not resume polling or publish stale status after unmount", async () => {
  vi.useFakeTimers()
  let resolve!: (response: unknown) => void
  const fetch = vi.fn(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal("fetch", fetch)
  const onUpdate = vi.fn()
  const poller = new StatusPoller(onUpdate, 100)
  await vi.advanceTimersByTimeAsync(100)
  poller.stop()
  resolve({ ok: true, json: async () => defaultStatus() })
  await vi.advanceTimersByTimeAsync(1000)
  expect(onUpdate).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledOnce()
})

it("reports an unsuccessful status response as backend offline", async () => {
  vi.useFakeTimers()
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }))
  const onUpdate = vi.fn()
  const poller = new StatusPoller(onUpdate, 100)
  await vi.advanceTimersByTimeAsync(100)
  expect(onUpdate).toHaveBeenCalledWith(defaultStatus())
  poller.stop()
})

it.each([
  { name: "missing labels", fields: {}, expected: { capture: null, playback: null } },
  { name: "null labels", fields: { labels: null }, expected: { capture: null, playback: null } },
  { name: "empty labels", fields: { labels: {} }, expected: { capture: null, playback: null } },
  {
    name: "capture labels only",
    fields: { labels: { capture: ["Mic", null] } },
    expected: { capture: ["Mic", null], playback: null },
  },
  {
    name: "playback labels only",
    fields: { labels: { playback: ["Left", "Right"] } },
    expected: { capture: null, playback: ["Left", "Right"] },
  },
  {
    name: "complete labels",
    fields: { labels: { capture: ["Mic"], playback: ["Left", "Right"] } },
    expected: { capture: ["Mic"], playback: ["Left", "Right"] },
  },
])("continues polling with $name and preserves meter readings", async ({ fields, expected }) => {
  vi.useFakeTimers()
  const readings = {
    capturesignalpeak: [-12],
    capturesignalrms: [-18],
    playbacksignalpeak: [-10, -11],
    playbacksignalrms: [-16, -17],
  }
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cdsp_status: "Running", ...readings, ...fields }),
    }),
  )
  const onUpdate = vi.fn()
  const poller = new StatusPoller(onUpdate, 100)
  await vi.advanceTimersByTimeAsync(200)
  expect(onUpdate).toHaveBeenCalledTimes(2)
  expect(onUpdate).toHaveBeenLastCalledWith({
    ...defaultStatus(),
    cdsp_status: "Running",
    ...readings,
    labels: expected,
  })
  poller.stop()
})
