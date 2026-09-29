import React from "react"
import { useDspStatus } from "./status-context"
import { Analysis } from "../analysis/analysis"
import { Config } from "../camilladsp/config"

export function Overview({ config, navigate }: { config: Config; navigate: (index: number) => void }) {
  const steps = config.pipeline ?? []
  return (
    <div className="home-workspace">
      <Analysis config={config} openFilters={() => navigate(3)} />
      <div className="home-status">
        <button className="text-action" onClick={() => navigate(2)}>
          {(config.devices.samplerate / 1000).toLocaleString()} kHz · {config.devices.chunksize} samples
        </button>
        <button className="text-action" onClick={() => navigate(6)}>
          {steps.filter((step) => !step.bypassed).length}/{steps.length} steps
        </button>
        <LiveLoad />
      </div>
    </div>
  )
}

function LiveLoad() {
  const status = useDspStatus()
  return <span>DSP {typeof status.processingload === "number" ? `${status.processingload.toFixed(1)}%` : "—"}</span>
}
