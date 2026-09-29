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
and a persistent DSP control panel. Home opens directly to frequency analysis. On narrow screens, the menu button opens navigation
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

**Home → Live spectrum** analyzes this browser's microphone or audio input using
Web Audio. Start input explicitly to request access. After permission is granted,
available audio inputs can be selected while stopped. Use an OS-provided loopback
input to inspect local system audio. FFT size, smoothing, peak hold, display freeze,
CSV export, and image export are available. Freezing the display keeps the input
active; stopping the input or leaving the view closes it.

Audio stays in the browser and is not uploaded or played back. This spectrum is
**not the remote CamillaDSP signal**: the existing backend provides RMS/peak status,
not raw audio samples. Levels are digital dBFS, not calibrated SPL. Browser input
requires HTTPS or localhost and microphone permission. No backend changes or new
production dependencies are required for either analysis view.

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
