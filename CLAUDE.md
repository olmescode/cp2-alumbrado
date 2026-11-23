# CLAUDE.md

## Project Overview

Adaptive street lighting for the CP2 assignment of the UNEMI course "Modelos y Simulación" (Group 10). Six LED street lights on a physical model respond to ambient light (LDR) and to pedestrians (PIR + street graph). A web dashboard simulates and compares three lighting strategies (permanent, scheduled, adaptive). It also mirrors the ESP32 in real time.

The scope of this repository is the software: the shared models, the web app, the server, the ESP32 emulator and the firmware. The written report is produced elsewhere, from what this app generates.

Delivery is Sunday 22 Nov 2026, 23:59. Keep every step working so work can stop at any point.

Domain rules (models, strategies, scenarios, control values, protocol, hardware pins) live in `docs/system.md`. Read it before touching `src/shared/`, `src/emulator/` or `firmware/`.

## Development Setup & Commands

- Node.js 22, ES modules (`"type": "module"`).
- `arduino-cli` 1.6 with the `esp32:esp32` core 4.0.0 and the `WebSockets` 2.7, `ArduinoJson` 7.4 and `Adafruit INA219` 1.2 libraries.

```bash
npm test                 # node --test (runs tests/*.test.js)
npm run export           # writes data/results/ (simulation results)
npm start                # server on :8080, serves the app, prints the LAN IP for phones
npm run emulator         # fake ESP32 connected to the server
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/streetlights
```

## Architecture

### Entry Points

- **Server**: `src/server/main.js`. Serves `src/client/` and `src/shared/`, bridges the WebSocket routes `/esp32` and `/app`, and logs every test to `data/logs/`.
- **Client**: `src/client/main.js`. Initializes the services, then the layers.
- **Emulator**: `src/emulator/main.js`.
- **Firmware**: `firmware/streetlights/streetlights.ino` (`setup()` / `loop()`).

### Code Organization

```
src/
├── shared/       # The 3 models, pure, no I/O; imported by client, server, emulator and scripts
├── server/       # Node: static hosting, WebSocket bridge, CSV logging
├── client/       # Web app: services/, layers/, components/, styles/
└── emulator/     # Pretends to be the ESP32 using the shared models
firmware/         # Arduino sketch (C++ port of src/shared with the same names)
scripts/          # One-off tools (results export, parameter optimization)
tests/            # node --test
data/             # Generated output: logs/ and results/
docs/             # system.md, architecture.md, reference/ (assignment PDF, plan, prior context)
```

## Core Principles

### I. Single Entry Point Architecture
Each runtime has exactly one entry point. It initializes systems in a fixed order.

### II. Singleton-Based Systems
Top-level systems (`Connection`, `Store`, `LocalSimulation`, `CsvLogger`) are modules that export one named object of functions and state. They are never instantiated. Call them with dot syntax (`Connection.send()`). The entry point initializes them explicitly.

### III. Shared Models Are Pure
`src/shared/` never touches the DOM, sockets or the file system. Everything that simulates or decides comes from there, so the app, the emulator and the export script always agree. The firmware ports it to C++ with identical names.

### IV. Communication Hierarchy
1. **State replication**: `reading` messages. The ESP32 or the emulator owns the state and everyone else only mirrors it.
2. **Commands**: `command` messages are the only transactional channel, used to request actions.

Validate `type` at every boundary.

### V. Composition Over Inheritance
Classes extend functionality through composition rather than `extends`. Child objects are created in the constructor and stored as members.
- **Cleanup**: every class that creates listeners, timers or DOM nodes implements `destroy()`.

### User Interface
- **Imperative**: plain DOM, with no framework. Chart.js for charts.
- **Layers and components**:
  - **Layers** are singleton views (`Header`, `GraphPanel`, `StateTable`, `Charts`, `Comparison`, `Alerts`, `History`, `Regression`). Each one subscribes to `Store`.
  - **Components** are reusable classes (`Card`, `Table`, `Button`).
- **Modes**: Simulation (local, driven by `src/shared`) and Live (data from the server). The data source badge ("ESP32 real" or "Datos emulados") is always visible.
- **Language**: all user-facing text is in Spanish. Code, files, folders and docs are in English.
- **Design**: use the `frontend-design` skill. The app is responsive for laptop and phone (390 px).

## Testing & Validation

Never claim behaviour is verified without having run it.

- **Models**: `npm test` covers the control values, the hourly share, Dijkstra against a hand result, and the regression against example 1 of class practice 7.
- **App**: open it through the server, because `file://` breaks ES module imports. Use Chrome or Playwright for screenshots and console errors, and check the 390 px phone width.
- **Server + emulator**: run both. Confirm that readings arrive, that the CSV is written, and that commands reach the device and its readings change.
- **Firmware**: it must pass `arduino-cli compile`.

## Documentation & Verification

Never assume how an API behaves; verify it before writing code that depends on it. This applies to:
- Arduino-ESP32 core 4.0.0 (`ledcAttach(pin, freq, resolution)` / `ledcWrite(pin, duty)`, confirmed in the installed headers);
- `WebSocketsClient` (Links2004);
- ArduinoJson 7;
- `Adafruit_INA219`;
- `ws`, `express` and Chart.js.

If behaviour cannot be confirmed, state the assumption instead of presenting a guess as fact.

## Governance

### Code Standards
- **Naming**: `camelCase` for functions and variables, `PascalCase` for classes and singletons, `UPPER_SNAKE_CASE` for model constants.
- **Cleanup**: `destroy()` is mandatory for any class that creates listeners, timers or DOM nodes.
- **Singletons**: import the module directly to access the singleton.
- **Integrity**:
  - Every number shown as a result must come from code.
  - Emulated data is always labelled `source: "emulator"`.
  - Never present emulated data as real measurements.

### Design Principles
- Follow SOLID principles, with emphasis on clear separation of concerns.
- Keep the structure flat and simple. Do not add folders beyond the ones listed in Code Organization.

### Code Style & Readability
- Write elegant code. Elegant means simple, clean and easy to read, using the least amount of code possible for the best future readability.
- Use syntactic sugar when it improves readability and conciseness.
- Avoid nested `if` structures and unnecessary guard clauses. Prefer clean and direct flow control.
- Put all `import` statements at the top: packages first, then local modules.
- All variable names must be complete words that clearly describe what they represent. Never use generic names like `data`, `result`, `value`, `text`, `item` or `temp` when a more specific name is available.
- Never chain method calls inline (e.g. `foo().bar()`). Always assign the result to a named variable first, then call the method on the next line.
- Each module declares one named object or class and exports it at the end, e.g. `const StreetGraph = {}; ... export default StreetGraph;`. Never `export default {}` directly.
- Never compare against `null`, `undefined`, `true` or `false`.
  - Use `if (value)` and `if (!value)` for objects and booleans.
  - Compare numbers explicitly (`brightness > 0`), because 0 is a valid brightness, LDR reading and time.

### Output Constraints
- Do not add comments to the code.
- Do not generate emojis, praise or condescending language.
- Do not introduce additional functions, abstractions or files unless explicitly requested.
