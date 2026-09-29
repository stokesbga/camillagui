import React, { useState } from "react"
import { OutputSpectrum } from "./output-spectrum"
import { Spectrum } from "./spectrum"
import { getLabelForChannel } from "../camilladsp/config"
import { isCdspOnline } from "../camilladsp/status"
import { useDspStatus } from "../workspace/status-context"

const levelWidth = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(100, value + 100)) : 0)
const levelText = (value: number) => (Number.isFinite(value) && value > -1000 ? value.toFixed(1) : "−∞")

export function LiveAnalysis() {
  const [browserInput, setBrowserInput] = useState(false)
  const status = useDspStatus()
  const online = isCdspOnline(status)
  return (
    <div className="live-analysis">
      <div className="source-toolbar">
        <span>{browserInput ? "Browser input" : "Master output"}</span>
        <button className="text-action" onClick={() => setBrowserInput(!browserInput)}>
          {browserInput ? "Use master output" : "Use browser input"}
        </button>
      </div>
      {browserInput ? (
        <Spectrum />
      ) : (
        <section className="surface-card master-spectrum-card" aria-label="Master output analysis">
          <OutputSpectrum labels={status.labels.playback} />
          <div className="section-heading output-level-heading">
            <span>
              Output levels <small>· dBFS</small>
            </span>
            <span className="muted">{online ? "RMS / Peak" : status.cdsp_status}</span>
          </div>
          {online && status.playbacksignalrms.length > 0 ? (
            <div className="output-levels">
              {status.playbacksignalrms.map((rms, channel) => {
                const peak = status.playbacksignalpeak[channel] ?? -Infinity
                const label = getLabelForChannel(status.labels.playback, channel)
                return (
                  <div className="output-level-row" key={channel}>
                    <span className="output-channel" title={label}>
                      {label}
                    </span>
                    <div
                      className="output-level-track"
                      role="img"
                      aria-label={`Output ${label}: RMS ${levelText(rms)}, peak ${levelText(peak)} dBFS`}
                    >
                      <span className="output-level-fill" style={{ width: `${levelWidth(rms)}%` }} />
                      <span className="output-level-peak" style={{ left: `${levelWidth(peak)}%` }} />
                    </div>
                    <span className="output-level-value">
                      {levelText(rms)} / {levelText(peak)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="output-level-empty">{online ? "Waiting for output levels…" : "No output data"}</div>
          )}
        </section>
      )}
    </div>
  )
}
