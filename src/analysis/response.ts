import { Config, getCaptureDeviceChannelCount } from "../camilladsp/config"
import { ChartContent } from "../utilities/chart"

export interface ResponseTarget {
  id: string
  label: string
  index?: number
  name?: string
}

export function responseTargets(config: Config): ResponseTarget[] {
  return [
    ...(config.pipeline ?? []).flatMap((step, index) =>
      step.type === "Filter"
        ? [
            {
              id: `step:${index}`,
              index,
              label: `Step ${index + 1} · ${step.description || step.names.join(" + ") || "Empty filter step"}${step.bypassed ? " (bypassed; individual response)" : ""}`,
            },
          ]
        : [],
    ),
    ...Object.keys(config.filters ?? {})
      .sort()
      .map((name) => ({ id: `filter:${name}`, name, label: `Filter · ${name}` })),
  ]
}

export async function fetchResponse(
  config: Config,
  target: ResponseTarget,
  signal: AbortSignal,
  samplerate = config.devices.samplerate,
  channels?: number,
): Promise<ChartContent> {
  const channelCount = channels ?? (await getCaptureDeviceChannelCount(config.devices.capture))
  if (signal.aborted) throw new DOMException("Aborted", "AbortError")
  const response = await fetch(target.index !== undefined ? "/api/evalfilterstep" : "/api/evalfilter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(
      target.index !== undefined
        ? { config, index: target.index, samplerate, channels: channelCount }
        : { config: config.filters?.[target.name!], name: target.name, samplerate, channels: channelCount },
    ),
  })
  if (!response.ok) throw new Error((await response.text()) || "Unable to calculate this response.")
  const data: ChartContent = await response.json()
  if (!Array.isArray(data.f) || !Array.isArray(data.options))
    throw new Error("The backend returned an invalid frequency response.")
  return data
}
