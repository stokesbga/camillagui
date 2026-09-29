import React, { act } from "react"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CamillaConfig } from "./app"
import { defaultConfig } from "./camilladsp/config"
import { defaultStatus } from "./camilladsp/status"
import { defaultGuiConfig } from "./guiconfig"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
// Meter drawing is covered separately; these checks exercise the workspace and request state.
vi.mock("./sidepanel/volumebox", () => ({ VolumeBox: () => <div>Volume monitor</div> }))
vi.mock("./sidepanel/auxfaderbox", () => ({ AuxFadersBox: () => null }))

describe("workspace configuration actions", () => {
  let root: Root
  let container: HTMLDivElement
  let app: CamillaConfig | null
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(async () => {
    vi.useFakeTimers()
    container = document.createElement("div")
    document.body.append(container)
    root = createRoot(container)
    fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/getstartconfig")
        return new Response(JSON.stringify({ config: defaultConfig(), configFileName: "test.yml", source: "default" }))
      if (url === "/api/guiconfig") return new Response(JSON.stringify(defaultGuiConfig()))
      if (url.startsWith("/api/status"))
        return new Response(JSON.stringify({ ...defaultStatus(), cdsp_status: "Running" }))
      if (url.startsWith("/api/spectrum")) return new Response(JSON.stringify({ available: false, message: "No tap" }))
      return new Response("OK")
    })
    vi.stubGlobal("fetch", fetchMock)
    await act(async () =>
      root.render(
        <CamillaConfig
          ref={(value) => {
            app = value
          }}
        />,
      ),
    )
    await act(async () => vi.advanceTimersByTimeAsync(100))
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  function button(text: string) {
    return Array.from(container.querySelectorAll("button")).find((button) => button.textContent === text)!
  }
  async function edit() {
    const config = { ...app!.state.undoRedo.current(), title: "Changed" }
    await act(async () =>
      app!.setState((state) => ({
        undoRedo: state.undoRedo.changeTo(config),
        unsavedChanges: true,
        unappliedChanges: true,
      })),
    )
  }
  it("opens live output spectrum on Home and keeps every editor reachable", async () => {
    expect(Array.from(container.querySelectorAll('[role="tab"]'), (tab) => tab.textContent)).toEqual([
      "Home",
      "Configuration",
      "Devices",
      "Filters",
      "Mixers",
      "Processors",
      "Pipeline",
      "Files",
      "Shortcuts",
    ])
    expect(container.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Home")
    expect(button("Live spectrum").getAttribute("aria-pressed")).toBe("true")
    expect(container.querySelector(".master-spectrum-card")).not.toBeNull()
    expect(container.querySelector(".segmented-control button")?.textContent).toBe("Live spectrum")
    await act(async () => button("Frequency response").click())
    expect(container.querySelector(".response-card")).not.toBeNull()
  })
  it("retains dirty flags on failed saves and applies", async () => {
    await edit()
    fetchMock.mockImplementation(async () => new Response("Rejected", { status: 400 }))
    await act(async () => button("Save to file").click())
    expect(app!.state.unsavedChanges).toBe(true)
    await act(async () => button("Apply to DSP").click())
    expect(app!.state.unappliedChanges).toBe(true)
    expect(container.textContent).toContain("Rejected")
  })
  it("renders normal and compact controls when status omits labels", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/status"))
        return new Response(JSON.stringify({ ...defaultStatus(), cdsp_status: "Running", labels: undefined }))
      if (url === "/api/storedconfigs") return new Response("[]")
      return new Response("OK")
    })
    await act(async () => vi.advanceTimersByTimeAsync(defaultGuiConfig().status_update_interval))
    expect(container.textContent).toContain("Volume monitor")
    await act(async () => app!.setState({ compactView: true }))
    expect(container.querySelector(".compact-panel")?.textContent).toContain("Volume monitor")
  })
  it("does not save when the apply part of apply-and-save fails", async () => {
    fetchMock.mockClear().mockImplementation(async () => new Response("Rejected", { status: 400 }))
    await act(async () => button("Apply and save").click())
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/setconfig")).toBe(true)
    expect(fetchMock.mock.calls.some((call) => call[0] === "/api/saveconfigfile")).toBe(false)
  })
  it("keeps edits made during a pending save marked as unsaved", async () => {
    let resolve!: (response: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    await act(async () => button("Save to file").click())
    await edit()
    await act(async () => resolve(new Response("OK")))
    expect(app!.state.unsavedChanges).toBe(true)
  })
  it("marks undo and redo as changes after saving", async () => {
    await edit()
    await act(async () => button("Apply and save").click())
    expect(app!.state.unsavedChanges).toBe(false)
    expect(app!.state.unappliedChanges).toBe(false)
    await act(async () => (container.querySelector('[aria-label^="Undo last change"]') as HTMLButtonElement).click())
    expect(app!.state.undoRedo.current().title).toBeNull()
    expect(app!.state.unsavedChanges).toBe(true)
    expect(app!.state.unappliedChanges).toBe(true)
    await act(async () => (container.querySelector('[aria-label^="Redo last change"]') as HTMLButtonElement).click())
    expect(app!.state.undoRedo.current().title).toBe("Changed")
  })
})
