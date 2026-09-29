import React, { createContext, useContext, useEffect, useState } from "react"
import { defaultStatus, isCdspOnline, StatusPoller } from "../camilladsp/status"

const StatusContext = createContext(defaultStatus())

export function StatusProvider({ interval, children }: { interval: number; children: React.ReactNode }) {
  const [status, setStatus] = useState(defaultStatus)
  useEffect(() => {
    const poller = new StatusPoller(setStatus, interval)
    return () => poller.stop()
  }, [interval])
  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
}

export const useDspStatus = () => useContext(StatusContext)

export function ConnectionBadge() {
  const status = useDspStatus()
  return (
    <span className={`connection-badge ${isCdspOnline(status) ? "is-online" : ""}`}>
      <span className="status-dot" />
      {status.cdsp_status}
    </span>
  )
}
