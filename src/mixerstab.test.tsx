import React, { act } from "react"
import { cloneDeep } from "lodash"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it } from "vitest"
import { Config, defaultConfig, defaultMixer } from "./camilladsp/config"
import { MixersTab } from "./mixerstab"
import { NoErrors } from "./utilities/errors"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let root: Root
let container: HTMLDivElement
let config: Config
function render() {
  root.render(
    <MixersTab
      config={config}
      errors={NoErrors}
      updateConfig={(update) => {
        config = cloneDeep(config)
        update(config)
        render()
      }}
    />,
  )
}
beforeEach(async () => {
  container = document.createElement("div")
  root = createRoot(container)
  config = defaultConfig()
  config.mixers = { stereo: { ...defaultMixer(), channels: { in: 2, out: 8 } } }
  await act(async () => render())
})
afterEach(async () => {
  await act(async () => root.unmount())
})
function labeled(text: string) {
  return container.querySelector(`[aria-label="${text}"]`) as HTMLButtonElement
}
async function clickText(text: string) {
  await act(async () =>
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === text)!
      .click(),
  )
}
it("keeps all eight outputs editable and supports route creation, polarity, mute and deletion", async () => {
  expect(container.querySelectorAll("tbody tr")).toHaveLength(8)
  await act(async () => labeled("Add route: Input 1 to output 7").click())
  expect(labeled("Edit route")).not.toBeNull()
  expect(config.mixers!.stereo.mapping.find((mapping) => mapping.dest === 7)?.sources[0].channel).toBe(1)
  await clickText("Invert polarity")
  await clickText("Mute source")
  expect(labeled("Input 1 to output 7: 0 dB, inverted, muted")).not.toBeNull()
  await act(async () => labeled("Mute output 7").click())
  expect(config.mixers!.stereo.mapping.find((mapping) => mapping.dest === 7)?.mute).toBe(true)
  await clickText("Remove route")
  expect(labeled("Add route: Input 1 to output 7")).not.toBeNull()
  expect(config.mixers!.stereo.mapping.find((mapping) => mapping.dest === 7)).toBeUndefined()
})
it("prunes routes when channel counts shrink", async () => {
  const input = container.querySelector(
    '[aria-label="Number of channels out (destination channels)"]',
  ) as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "1")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(config.mixers!.stereo.channels.out).toBe(1)
  expect(config.mixers!.stereo.mapping.every((mapping) => mapping.dest === 0)).toBe(true)
})
