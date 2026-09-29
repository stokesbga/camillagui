import React, { useEffect, useMemo, useState } from "react"
import { mdiChartBellCurve, mdiMicrophoneOutline } from "@mdi/js"
import Icon from "@mdi/react"
import { fetchResponse, responseTargets, ResponseTarget } from "./response"
import { Spectrum } from "./spectrum"
import { Config } from "../camilladsp/config"
import { Chart, ChartContent } from "../utilities/chart"

export function Analysis({ config, openFilters }: { config: Config; openFilters: () => void }) {
  const [mode, setMode] = useState("response")
  return (
    <div className="analysis-workspace">
      <div className="segmented-control" aria-label="Analysis mode">
        <button aria-pressed={mode === "response"} onClick={() => setMode("response")}>
          <Icon path={mdiChartBellCurve} size={0.75} />
          Frequency response
        </button>
        <button aria-pressed={mode === "spectrum"} onClick={() => setMode("spectrum")}>
          <Icon path={mdiMicrophoneOutline} size={0.75} />
          Live spectrum
        </button>
      </div>
      {mode === "response" ? <FrequencyResponse config={config} openFilters={openFilters} /> : <Spectrum />}
    </div>
  )
}

function FrequencyResponse({ config, openFilters }: { config: Config; openFilters: () => void }) {
  const targets = useMemo(() => responseTargets(config), [config])
  const [selection, setSelection] = useState("")
  const target = targets.find((item) => item.id === selection) ?? targets[0]
  const [revision, setRevision] = useState(0)
  const [variant, setVariant] = useState<{ samplerate?: number; channels?: number }>({})
  const [response, setResponse] = useState<{
    config: Config
    target: ResponseTarget
    revision: number
    variant: typeof variant
    result?: ChartContent
    error?: string
  }>()
  const current =
    response?.config === config &&
    response?.target === target &&
    response?.revision === revision &&
    response?.variant === variant
  const result = current ? response?.result : undefined
  const error = current ? response?.error : undefined
  const loading = Boolean(target && !current)
  useEffect(() => {
    if (!target) return
    const controller = new AbortController()
    const request = { config, target, revision, variant }
    fetchResponse(config, target, controller.signal, variant.samplerate, variant.channels)
      .then((result) => {
        if (!controller.signal.aborted) setResponse({ ...request, result })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResponse({ ...request, error: error instanceof Error ? error.message : "Unable to load response." })
      })
    return () => controller.abort()
  }, [config, target, revision, variant])
  return (
    <>
      <section className="surface-card response-card">
        {target ? (
          <>
            <div className="analysis-toolbar">
              <span className="subtle-badge" title="Current edited configuration; volume reference 0 dB">
                Calculated · {((result?.samplerate ?? config.devices.samplerate) / 1000).toLocaleString()} kHz
              </span>
              <label>
                Source
                <select
                  value={target.id}
                  onChange={(event) => {
                    setSelection(event.target.value)
                    setVariant({})
                  }}
                >
                  {targets.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary-action" onClick={() => setRevision((value) => value + 1)} disabled={loading}>
                Recalculate
              </button>
            </div>
            {loading && (
              <div className="analysis-empty" role="status">
                <div className="loading-ring" />
                <span>Calculating…</span>
              </div>
            )}
            {error && (
              <div className="analysis-empty" role="alert">
                <h3>Response unavailable</h3>
                <p>{error}</p>
                <button className="secondary-action" onClick={() => setRevision((value) => value + 1)}>
                  Retry
                </button>
              </div>
            )}
            {result && (
              <div className="response-chart">
                <Chart
                  data={result}
                  onChange={(name) => {
                    const option = result.options.find((item) => item.name === name)
                    setVariant({ samplerate: option?.samplerate, channels: option?.channels })
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="analysis-empty">
            <span>No filters configured.</span>
            <button className="secondary-action" onClick={openFilters}>
              Filters
            </button>
          </div>
        )}
      </section>
    </>
  )
}
