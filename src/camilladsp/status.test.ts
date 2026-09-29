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
