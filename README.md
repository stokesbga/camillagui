CamillaGUI frontend
---

This is the frontend of  CamillaGUI, the part that runs in the browser and handles the actual interface.

The backend is located here: https://github.com/HEnquist/camillagui-backend

For instructions on how to set the gui up, see the readme for the backend.

## Dependencies
The gui is based on the [React](https://react.dev/) framework.
It uses the [npm](https://www.npmjs.com/) package manager,
and the [Vite](https://vitejs.dev/) development environment.

It uses a number of open source libraries and components.
See `package.json` for the full list.

## Development
Install the dependencies with `npm install`.

Start the development server with `npm run dev`.
This makes the GUI available on `http://localhost:5173/gui`.
The development server watches for changes in the source files
and updates the running version automatically.

To make a production build, run `npm run build`.
The build will be stored in the `build` folder.
After building, the production build can be previewed with `npm run serve`.
Note that this preview is not automatically updated
when source files change, it must be manually update with `npm run build`.

Tests are executed by running `npm test`.


## Modern workspace

The interface uses black and gray controls, rainbow plots, a responsive navigation rail,
and a persistent DSP control panel. Home opens directly to the master-output spectrum. On narrow screens, the menu button opens navigation
and the sliders button opens DSP controls. All configuration editors, file imports and
exports, custom shortcuts, pipeline editing and plots, validation, log viewing, config
comparison, volume/faders, automatic save/apply, and compact view remain available.
Configuration title and description are under **Configuration**.

### Analysis

**Home → Frequency response** calculates an individual filter or a filter pipeline
step using the existing Python backend's `/api/evalfilter` and `/api/evalfilterstep`
endpoints. It uses the current edited configuration, even before applying changes.
Available traces include gain, phase, impulse, and group delay, with zoom, pan,
coefficient variant selection, and image/CSV export. A bypassed step is labeled and
can still be inspected individually. This is not a measurement of the room or a
combined response of the entire routed pipeline. Volume-dependent filters use 0 dB
as the analysis reference; their existing filter-editor plots retain volume controls.

**Home → Live spectrum** opens first and reads the CamillaDSP master output through
`/api/spectrum`. The sibling backend project adds a localhost ALSA playback tap and
computes FFT data from post-DSP samples. It needs a one-time setup on the DSP host;
see [the backend setup guide](../camillagui-backend/docs/spectrum.md). The frontend
never selects or opens a local microphone for the master-output view. Older backends
show an update message; disconnected taps recover automatically. Output RMS/peak
levels use the same status source as the sidebar.

Select all outputs (spectral power average) or an individual channel. FFT size,
smoothing, peak hold, freeze, CSV export, and image export are available. A Hann
window normalizes sinusoidal amplitudes to digital dBFS, not calibrated SPL.

**Use browser input** keeps the optional Web Audio analyzer available for a local
microphone or loopback input. Start input explicitly to request access; HTTPS or
localhost is required. Audio stays in the browser and is not played back or uploaded.
Stopping input, switching back to master output, or leaving Home closes the input.

The mixer matrix fills its container, scrolls horizontally for large channel counts,
and edits selected routes below the table. Gain, scale, mute, polarity, channel labels,
channel counts, and routing remain editable with keyboard-accessible controls.

### Local development and checks

Run the Python backend separately on port 5005; Vite proxies `/api` to that port.
Without it, the workspace remains browsable and displays its disconnected state,
but calculated response and backend-dependent operations are unavailable.

```sh
npm ci
npm run dev
npm run check
npx vitest run
npm run build
npm run lint
```

The default theme remains in `public/css-variables.css`. The workspace layout and
responsive styles are in `src/workspace/workspace.css`; the React application is
in `src/app.tsx`, with analysis components in `src/analysis/`.
