# Architecture

## Systems

```mermaid
flowchart LR
  subgraph Board["Physical model"]
    SENSORS[LDR · PIR A · PIR B · INA219]
    LEDS[6 PWM LEDs]
  end
  FIRMWARE[firmware/streetlights<br/>state machine + graph]
  EMULATOR[src/emulator]
  subgraph Server["src/server · :8080"]
    DEVICE["/esp32"]
    BROWSER["/app"]
    LOGS[(data/logs)]
  end
  SHARED[src/shared<br/>3 models]
  CLIENT[src/client<br/>Simulation · Live]
  EXPORT[scripts/exportResults.js]

  SENSORS --> FIRMWARE --> LEDS
  FIRMWARE <-->|reading / command| DEVICE
  EMULATOR <-->|reading / command| DEVICE
  DEVICE <--> BROWSER
  DEVICE --> LOGS
  BROWSER <-->|reading / command| CLIENT
  SHARED -.-> CLIENT
  SHARED -.-> EMULATOR
  SHARED -.-> EXPORT
  SHARED -.C++ port.-> FIRMWARE
```

| System | Responsibilities |
|---|---|
| `src/shared` | Implements the 3 models with no I/O. Simulates a full night and computes the indicators |
| `src/server` | Serves the app and the shared models. Bridges the WebSocket routes and logs CSV files. Raises an alert after 3 s without the device. Prints the LAN IP |
| `src/emulator` | Pretends to be the ESP32: sends readings every 500 ms, answers every command and adds noise to `powerMw` |
| `firmware` | Decides each pole's state **on the board**, so it keeps working without WiFi. Drives the PWM and reports readings |
| `src/client` | Dashboard with two modes: local simulation and live mirror |

## Luminaire states

```mermaid
stateDiagram-v2
  [*] --> Off
  Off --> Base: night (ldr < 30 %)
  Base --> Active: graph activation time
  Active --> Hold: person reaches the pole
  Hold --> Base: HOLD_TIME elapsed
  Base --> Off: day (ldr > 40 %)
  Active --> Off: day
  Hold --> Off: day
```

## Street graph

```mermaid
graph LR
  A1((A1 · PIR A)) ---|30 m| A2((A2))
  A2 ---|30 m| A3((A3 · exit))
  A2 ---|30 m| B1((B1))
  B1 ---|30 m| B2((B2))
  B2 ---|30 m| B3((B3 · PIR B))
```

## Client

```mermaid
flowchart TB
  MAIN[main.js] --> CONNECTION[Connection<br/>WebSocket /app]
  MAIN --> SIMULATION[LocalSimulation<br/>src/shared]
  MAIN --> STORE[Store<br/>current state + subscribers]
  CONNECTION --> STORE
  SIMULATION --> STORE
  STORE --> LAYERS[Layers<br/>Header · GraphPanel · StateTable · Charts<br/>Comparison · Alerts · History · Regression]
  LAYERS --> COMPONENTS[Components<br/>Card · Table · Button]
```
