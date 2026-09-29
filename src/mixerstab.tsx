import React, { useEffect, useId, useRef, useState } from "react"
import "./index.css"
import { mdiPlusMinusVariant, mdiVolumeOff, mdiPlus, mdiVolumeHigh } from "@mdi/js"
import Icon from "@mdi/react"
import { Range } from "immutable"
import { cloneDeep } from "lodash"
import {
  Config,
  defaultMixer,
  Mapping,
  Mixer,
  mixerNamesOf,
  newMixerName,
  removeMixer,
  renameMixer,
  Source,
  GainScales,
  GainScale,
  getMixerInputLabels,
} from "./camilladsp/config"
import { modifiedCopyOf, Update } from "./utilities/common"
import { Errors } from "./utilities/errors"
import {
  AddButton,
  Box,
  DeleteButton,
  ErrorMessage,
  IntOption,
  ParsedInput,
  OptionalTextInput,
  null_to_default,
  FloatOption,
  EnumOption,
  ErrorBoundary,
  Button,
} from "./utilities/ui-components"

interface MixersTabProps {
  config: Config
  updateConfig: (update: Update<Config>) => void
  errors: Errors
}

export class MixersTab extends React.Component<
  MixersTabProps,
  {
    mixerKeys: { [name: string]: number }
  }
> {
  constructor(props: MixersTabProps) {
    super(props)
    this.mixerNames = this.mixerNames.bind(this)
    this.addMixer = this.addMixer.bind(this)
    this.updateMixer = this.updateMixer.bind(this)
    this.renameMixer = this.renameMixer.bind(this)
    this.removeMixer = this.removeMixer.bind(this)
    this.isFreeMixerName = this.isFreeMixerName.bind(this)
    this.state = {
      mixerKeys: {},
    }
    this.mixerNames().forEach((name, i) => (this.state.mixerKeys[name] = i))
  }

  private mixerNames(): string[] {
    return mixerNamesOf(this.props.config.mixers)
  }

  private updateMixer(name: string, update: Update<Mixer>) {
    this.props.updateConfig((config) => {
      if (!config.mixers) {
        config.mixers = {}
      }
      update(config.mixers[name])
    })
  }

  private addMixer() {
    this.props.updateConfig((config) => {
      const newMixer = newMixerName(config.mixers)
      this.setState((oldState) =>
        modifiedCopyOf(
          oldState,
          (newState) => (newState.mixerKeys[newMixer] = 1 + Math.max(0, ...Object.values(oldState.mixerKeys))),
        ),
      )
      if (config.mixers === null) {
        config.mixers = {}
      }
      config.mixers[newMixer] = defaultMixer()
    })
  }

  private removeMixer(name: string) {
    this.props.updateConfig((config) => {
      removeMixer(config, name)
      this.setState((oldState) => modifiedCopyOf(oldState, (newState) => delete newState.mixerKeys[name]))
    })
  }

  private renameMixer(oldName: string, newName: string) {
    if (this.isFreeMixerName(newName))
      this.props.updateConfig((config) => {
        this.setState((oldState) =>
          modifiedCopyOf(oldState, (newState) => {
            newState.mixerKeys[newName] = newState.mixerKeys[oldName]
            delete newState.mixerKeys[oldName]
          }),
        )
        renameMixer(config, oldName, newName)
      })
  }

  private isFreeMixerName(name: string) {
    return !this.mixerNames().includes(name)
  }

  render() {
    const { config, errors } = this.props
    const mixers = config.mixers ? config.mixers : {}
    return (
      <ErrorBoundary errorMessage={errors.asText()}>
        <div className="tabcontainer mixer-editor">
          <div className="tabpanel" style={{ width: "100%" }}>
            <ErrorMessage message={errors.rootMessage()} />
            {this.mixerNames().map((name) => (
              <MixerView
                key={this.state.mixerKeys[name]}
                name={name}
                mixer={mixers[name]}
                config={config}
                errors={errors.forSubpath(name)}
                update={(update) => this.updateMixer(name, update)}
                isFreeMixerName={this.isFreeMixerName}
                rename={(newName) => this.renameMixer(name, newName)}
                remove={() => this.removeMixer(name)}
              />
            ))}
            <div>
              <AddButton tooltip="Add a new mixer" onClick={this.addMixer} />
            </div>
          </div>
          <div className="tabspacer"></div>
        </div>
      </ErrorBoundary>
    )
  }
}

function MixerView(props: {
  name: string
  mixer: Mixer
  config: Config
  errors: Errors
  isFreeMixerName: (name: string) => boolean
  rename: (newName: string) => void
  remove: () => void
  update: (update: Update<Mixer>) => void
}) {
  const { name, mixer, config, errors, rename, remove, update } = props
  const isValidMixerName = (newName: string) =>
    name === newName || (newName.trim().length > 0 && props.isFreeMixerName(newName))
  const input_labels = getMixerInputLabels(config, name)
  const updateChannelLabel = (channel: number, label: string | null) => {
    let existing = props.mixer.labels
    if (existing === null || existing === undefined) {
      existing = []
    }
    while (existing.length <= channel) {
      existing.push(null)
    }
    existing[channel] = label
    update((mixer) => (mixer.labels = existing))
  }

  return (
    <Box
      title={
        <>
          <ParsedInput
            value={name}
            style={{ width: "min(300px, 100%)" }}
            tooltip="Mixer name, must be unique"
            onChange={rename}
            asString={(name) => name}
            parseValue={(name) => (isValidMixerName(name) ? name : undefined)}
            immediate={false}
          />
          <DeleteButton tooltip="Delete this mixer" smallButton={true} onClick={remove} />
        </>
      }
    >
      <ErrorMessage message={errors.rootMessage()} />
      <div className="mixer-channel-controls">
        <IntOption
          value={mixer.channels.in}
          desc="Inputs"
          tooltip="Number of channels in (source channels)"
          small={true}
          withControls={true}
          min={1}
          onChange={(channelsIn) =>
            update((mixer) => {
              mixer.channels.in = channelsIn
              pruneMixer(mixer)
            })
          }
        />
        <IntOption
          value={mixer.channels.out}
          desc="Outputs"
          tooltip="Number of channels out (destination channels)"
          small={true}
          withControls={true}
          min={1}
          onChange={(channelsOut) =>
            update((mixer) => {
              mixer.channels.out = channelsOut
              pruneMixer(mixer)
            })
          }
        />
      </div>
      <ErrorMessage message={errors.messageFor("channels")} />
      <ErrorMessage message={errors.messageFor("channels", "in")} />
      <ErrorMessage message={errors.messageFor("channels", "out")} />
      <MappingMatrix
        mixer={mixer}
        errors={errors}
        channels={mixer.channels}
        update={(mixerUpdate) => update((mixer) => mixerUpdate(mixer))}
        updateLabel={updateChannelLabel}
        inputLabels={input_labels}
      />
      <div className="vertically-spaced-content">
        <OptionalTextInput
          placeholder="description"
          value={mixer.description}
          tooltip="Mixer description"
          onChange={(desc) => update((mixer) => (mixer.description = desc))}
        />
      </div>
    </Box>
  )
}

function getMapping(mappings: Mapping[], dest: number): [Mapping | undefined, number] {
  const idx = mappings.findIndex((m) => m.dest === dest)
  if (idx >= 0) {
    return [mappings[idx], idx]
  }
  return [undefined, idx]
}

function getSource(mappings: Mapping[], src: number, dest: number): [Source | undefined, number, number] {
  const [mapping, map_idx] = getMapping(mappings, dest)
  if (mapping === undefined) {
    return [undefined, map_idx, -1]
  }
  const idx = mapping.sources.findIndex((s) => s.channel === src)
  if (idx >= 0) {
    return [mapping.sources[idx], map_idx, idx]
  }
  return [undefined, map_idx, idx]
}

function addCell(mixer: Mixer, source: number, dest: number) {
  let [mapping] = getMapping(mixer.mapping, dest)
  if (mapping === undefined) {
    mapping = {
      dest: dest,
      sources: [],
      mute: false,
    }
    mixer.mapping.push(mapping)
  }
  const cell = {
    channel: source,
    gain: 0,
    inverted: false,
    mute: false,
    scale: "dB" as GainScale,
  }
  mapping.sources.push(cell)
}

function deleteCell(mixer: Mixer, source: number, dest: number) {
  const [cell, map_idx, src_idx] = getSource(mixer.mapping, source, dest)
  if (cell === undefined) {
    return
  }
  mixer.mapping[map_idx].sources.splice(src_idx, 1)
  if (mixer.mapping[map_idx].sources.length === 0) {
    mixer.mapping.splice(map_idx, 1)
  }
}

function updateCell(mixer: Mixer, source: number, dest: number, cell: Source) {
  const [current, map_idx, src_idx] = getSource(mixer.mapping, source, dest)
  if (current === undefined) {
    return
  }
  mixer.mapping[map_idx].sources[src_idx] = cell
}

function toggleMappingMute(mixer: Mixer, dest: number) {
  const [current, idx] = getMapping(mixer.mapping, dest)
  if (current !== undefined) {
    if (current.mute === true) {
      mixer.mapping[idx].mute = false
    } else {
      mixer.mapping[idx].mute = true
    }
  }
}

function pruneMixer(mixer: Mixer) {
  mixer.mapping = mixer.mapping.filter((map) => map.dest < mixer.channels.out)
  for (const mapping of mixer.mapping) {
    mapping.sources = mapping.sources.filter((src) => src.channel < mixer.channels.in)
  }
}

function MappingMatrix(props: {
  mixer: Mixer
  errors: Errors
  channels: { in: number; out: number }
  update: (update: Update<Mixer>) => void
  updateLabel: (dest: number, new_label: string | null) => void
  inputLabels: (string | null)[] | null
}) {
  const { mixer, errors, channels, update, updateLabel, inputLabels } = props
  const [expanded, setExpanded] = useState<[number, number]>()
  const editorId = useId()
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    editorRef.current?.querySelector("input")?.focus()
  }, [expanded])
  const [selected, mappingIndex, sourceIndex] = expanded ? getSource(mixer.mapping, expanded[1], expanded[0]) : []
  return (
    <>
      <div className="mixer-matrix-scroll" role="region" aria-label="Channel routing matrix">
        <table className="mixer-table" style={{ minWidth: 230 + channels.in * 100 }}>
          <colgroup>
            <col className="mixer-output-column" />
            <col className="mixer-mute-column" />
            {Range(0, channels.in).map((src) => (
              <col key={src} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Output</th>
              <th scope="col">
                <span className="sr-only">Mute output</span>
              </th>
              {Range(0, channels.in).map((src) => (
                <th scope="col" key={src}>
                  <span className="mixer-input-heading">Input {src}</span>
                  {inputLabels?.[src] && <span className="mixer-input-label">{inputLabels[src]}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Range(0, channels.out).map((dest) => {
              const [mapping, mapIndex] = getMapping(mixer.mapping, dest)
              return (
                <tr key={dest} className={mapping?.mute ? "mixer-row-muted" : undefined}>
                  <th scope="row">
                    <div className="mixer-output-label">
                      <span className="channel-index">{dest}</span>
                      <OptionalTextInput
                        placeholder="Label"
                        value={mixer.labels?.[dest] ?? null}
                        tooltip={"Label for output " + dest}
                        onChange={(label) => updateLabel(dest, label)}
                      />
                    </div>
                    <ErrorMessage message={errors.forSubpath("mapping", mapIndex).rootMessage()} />
                  </th>
                  <td>
                    <OutputMute
                      channel={dest}
                      onClick={() => update((mixer) => toggleMappingMute(mixer, dest))}
                      mute={mapping?.mute}
                    />
                  </td>
                  {Range(0, channels.in).map((src) => {
                    const [cell, mapIndex, srcIndex] = getSource(mixer.mapping, src, dest)
                    const active = expanded?.[0] === dest && expanded[1] === src
                    const cellErrors = errors.forSubpath("mapping", mapIndex, "sources", srcIndex)
                    const gain = cell?.gain ?? (cell?.scale === "linear" ? 1 : 0)
                    const route = `Input ${src} to output ${dest}`
                    return (
                      <td key={src}>
                        <button
                          type="button"
                          className={`route-cell ${cell ? "is-routed" : "is-empty"} ${cell?.mute ? "is-muted" : ""}`}
                          style={
                            cell
                              ? ({ "--route-color": cssColorAt(cell, cellErrors) } as React.CSSProperties)
                              : undefined
                          }
                          aria-label={
                            cell
                              ? `${route}: ${gain} ${cell.scale === "linear" ? "linear" : "dB"}${cell.inverted ? ", inverted" : ""}${cell.mute ? ", muted" : ""}`
                              : `Add route: ${route}`
                          }
                          aria-expanded={active && Boolean(cell)}
                          aria-controls={active && cell ? editorId : undefined}
                          title={cellErrors.asText() || (cell ? "Edit route" : "Add route")}
                          onClick={() => {
                            if (!cell) update((mixer) => addCell(mixer, src, dest))
                            setExpanded(active ? undefined : [dest, src])
                          }}
                        >
                          {cell ? (
                            <>
                              {cell.inverted && <Icon path={mdiPlusMinusVariant} size={0.65} />}
                              <span>{Number(gain.toFixed(2))}</span>
                              <small>{cell.scale === "linear" ? "×" : "dB"}</small>
                              {cell.mute && <Icon path={mdiVolumeOff} size={0.65} />}
                            </>
                          ) : (
                            <Icon path={mdiPlus} size={0.7} />
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && expanded && (
        <div
          className="route-editor"
          ref={editorRef}
          id={editorId}
          role="group"
          aria-label="Edit route"
          key={expanded.join(":")}
        >
          <div className="section-heading">
            <strong>
              Input {expanded[1]} → Output {expanded[0]}
            </strong>
            <button className="text-action" onClick={() => setExpanded(undefined)}>
              Done
            </button>
          </div>
          <SourceCell
            source={selected}
            errors={errors.forSubpath("mapping", mappingIndex!, "sources", sourceIndex!)}
            update={(cellUpdate) =>
              update((mixer) => {
                const copy = cloneDeep(selected)
                cellUpdate(copy)
                updateCell(mixer, expanded[1], expanded[0], copy)
              })
            }
            remove={() => {
              update((mixer) => deleteCell(mixer, expanded[1], expanded[0]))
              setExpanded(undefined)
            }}
          />
        </div>
      )}
    </>
  )
}

function SourceCell(props: {
  source: Source
  errors: Errors
  update: (update: Update<Source>) => void
  remove: () => void
}) {
  const { source, errors, update, remove } = props
  return (
    <div className="route-editor-fields">
      <FloatOption
        desc="Gain"
        value={source.gain ?? (source.scale === "linear" ? 1 : 0)}
        tooltip="Gain value for this source channel"
        error={errors.forSubpath("gain").asText()}
        onChange={(gain) => update((source) => (source.gain = gain))}
      />
      <EnumOption
        value={null_to_default(source.scale, "dB")}
        options={GainScales}
        desc="Scale"
        tooltip="Scale for gain"
        onChange={(scale) => update((source) => (source.scale = scale))}
      />
      <Button
        text="Invert polarity"
        highlighted={source.inverted}
        onClick={() => update((source) => (source.inverted = !source.inverted))}
      />
      <Button
        text="Mute source"
        highlighted={source.mute}
        onClick={() => update((source) => (source.mute = !source.mute))}
      />
      <Button text="Remove route" onClick={remove} />
      <ErrorMessage message={errors.rootMessage()} />
    </div>
  )
}

function OutputMute(props: { channel: number; onClick: () => void; mute: boolean | null | undefined }) {
  const { onClick, mute, channel } = props
  const enabled = mute !== undefined
  const tooltip = enabled ? `${mute ? "Unmute" : "Mute"} output ${channel}` : `Output ${channel} has no sources`
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={Boolean(mute)}
      disabled={!enabled}
      className="mixer-output-mute"
      onClick={onClick}
    >
      <Icon path={mute || !enabled ? mdiVolumeOff : mdiVolumeHigh} size={0.8} />
    </button>
  )
}

function cssColorAt(cell: Source, errors: Errors): string {
  if (errors.hasErrors()) {
    return "var(--error-cell-color)"
  } else if (cell.mute) {
    return "var(--muted-cell-color)"
  } else if (cell.inverted) {
    return "var(--inverted-cell-color)"
  }
  return "var(--normal-cell-color)"
}
