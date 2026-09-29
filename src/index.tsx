/* Load base styles before the workspace design system. */
import "react-tabs/style/react-tabs.css"
import "react-tooltip/dist/react-tooltip.css"
import "./index.css"
import "./workspace/workspace.css"
import "./workspace/editors.css"
import React from "react"
import { createRoot } from "react-dom/client"
import { CamillaConfig } from "./app"

createRoot(document.getElementById("root")!).render(<CamillaConfig />)
