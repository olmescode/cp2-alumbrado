# Architecture

## How the system works

```mermaid
flowchart LR
  subgraph Board["Physical model"]
    SENSORS[LDR, PIR A, PIR B, INA219]
    FIRMWARE[ESP32<br/>decides on its own]
    LEDS[6 PWM LEDs]
  end
  subgraph Server["src/server :8080"]
    BRIDGE[WebSocket bridge<br/>/esp32 and /app]
    RECORDER[Recorder]
    DATA[(data/<br/>nights, calibration)]
  end
  subgraph App["src/client"]
    MONITOR[Monitoreo<br/>live data and controls]
    ANALYSIS[Análisis<br/>savings and regression]
    SIMULATION[Simulación<br/>digital copy of the city]
  end
  SHARED[src/shared<br/>3 models]

  SENSORS --> FIRMWARE --> LEDS
  FIRMWARE -->|reading| BRIDGE
  BRIDGE -->|command| FIRMWARE
  BRIDGE --> RECORDER --> DATA
  BRIDGE <--> MONITOR
  DATA --> ANALYSIS
  SHARED -.-> SIMULATION
  SHARED -.-> ANALYSIS
  SHARED -.C++ port.-> FIRMWARE
```

| Part | Responsibility |
|---|---|
| ESP32 (`firmware/`) | Reads the sensors, decides day or night with the LDR, runs the state machine and the light wave, drives the LEDs and reports every 500 ms. Works without WiFi |
| Server (`src/server/`) | Serves the app, forwards readings to the browsers and operator commands to the board, records each night and calibration, and warns after 3 s without data |
| Monitoreo | What happens right now: map, day or night, clock, measured power, people detected and alerts. Operator controls: strategy, lamp test, calibration |
| Análisis | Recorded nights, observed savings next to simulated savings, and the consumption regression |
| Simulación | A full 12 h night with 5, 20 or 60 people, the comparison of the 3 strategies and the Dijkstra table |

## Luminaire states

```mermaid
stateDiagram-v2
  [*] --> Off
  Off --> Base: LDR covered (night)
  Base --> Active: graph activation time
  Active --> Hold: person reaches the pole
  Hold --> Base: HOLD_TIME elapsed
  Base --> Off: LDR uncovered (day)
  Active --> Off: day
  Hold --> Off: day
```

## Street graph

```mermaid
graph LR
  A1((A1, PIR A)) ---|30 m| A2((A2))
  A2 ---|30 m| A3((A3, exit))
  A2 ---|30 m| B1((B1))
  B1 ---|30 m| B2((B2))
  B2 ---|30 m| B3((B3, PIR B))
```
