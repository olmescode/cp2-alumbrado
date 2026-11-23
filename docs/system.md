# System Specification

This is the source of truth for the models, strategies, scenarios and protocol. `src/shared/` implements it once. `firmware/` ports it to C++ using the same names.

## Day, night and the clock (on the board)

- The LDR decides: covering it starts a **night**, uncovering it starts a **day** (hysteresis: night below 30 %, day above 40 %).
- When a night starts the clock jumps to **18:00**; when a day starts it jumps to **06:00**. The clock then runs at **1 real minute = 12 hours** (`CLOCK_FACTOR = 720`) and stops at the end of the half day. A 1-minute covered test is one full night.
- The `scheduled` strategy reads this clock (50 % from 23:00 to 05:00).
- The light wave runs at a human pace so it can be seen with a toy figure: `WAVE_FACTOR = 10`, about 2 s per 30 m segment.

## Hardware

| Component | Connection |
|---|---|
| ESP32 DevKit V1 (30 pins) | USB for programming. WiFi to the hotspot (2.4 GHz only) |
| 6 LEDs, poles `A1 A2 A3 B1 B2 B3` | GPIO `13 14 16 17 18 19` → 1 kΩ → 2N2222 base. LED: 5 V → 100 Ω → anode, cathode → collector, emitter → GND. PWM at 5 kHz, 8 bit |
| PIR A (HC-SR501), entrance at A1 | OUT → GPIO 27. A detection is a rising edge |
| PIR B, entrance at B3 | OUT → GPIO 26 |
| LDR | 3.3 V → LDR → GPIO 34 (ADC1) → 10 kΩ → GND. `ldrPercent = raw / 4095 × 100` |
| INA219 | SDA 21, SCL 22. In series on the 5 V line that feeds only the LEDs |
| MB102 | 5 V for the LEDs and the PIRs. GND is shared with the ESP32 |

Each PIR gets a cardboard tube so it only sees the entrance of its own street. Both potentiometers go to minimum: sensitivity, for the shortest range, and delay, for about 3 s HIGH. The PIR detects warm moving bodies, so a toy figure is detected through the hand that moves it. After power-on the PIRs need about 60 s to warm up.

The model is a 55 × 35 cm board with a T-shaped street layout:

- **Avenue A** (horizontal) has poles A1, A2 and A3.
- **Street B** runs down from A2 and has poles B1, B2 and B3.
- **PIR A** sits next to A1 and **PIR B** next to B3. The LDR is on a rooftop.

## Model 1: Luminaire state machine (`stateMachine.js`)

| State | Brightness |
|---|---|
| `Off` | 0 % |
| `Base` | 20 % |
| `Active` | 100 % |
| `Hold` | 100 % |

Parameters:

| Parameter | Value |
|---|---|
| `BASE_LEVEL` | 0.2 |
| `HOLD_TIME` | 30 s |
| `ANTICIPATION_TIME` | 10 s |

Night and day use hysteresis: it is night when `ldrPercent < 30` and day when `ldrPercent > 40`.

| From | To | When |
|---|---|---|
| `Off` | `Base` | Night begins |
| `Base` | `Active` | The activation time computed by the graph is reached |
| `Active` | `Hold` | The person reaches the pole |
| `Hold` | `Base` | `HOLD_TIME` elapses |
| Any state | `Off` | Day begins |

## Model 2: Energy (`energy.js`)

- `power(brightness, intercept, slope) = intercept + slope · brightness`, with brightness between 0 and 1.
  - Real scale: intercept 0, slope 100 W.
  - Physical model: replace both with the INA219 regression, in mW.
- `energy`: the sum of `power × Δt` over the 6 poles, with Δt = 1 s, reported in Wh. This is Euler's method on dE/dt = P(t) (class practice 2).
- `linearRegression(points)` returns `{ intercept, slope, r2 }`.
  - It uses the same summation formulas as `reg_lin` in class practice 7: Sx, Sy, Sxy, Sxx, Syy, and r² from the correlation.
  - Input is the brightness sweep from 0 to 100 % in steps of 10 %.

## Model 3: Street graph (`streetGraph.js`)

Undirected edges: `A1–A2`, `A2–A3`, `A2–B1`, `B1–B2`, `B2–B3`. Each is 30 m and configurable.

- **Entrances:** A1 (PIR A) and B3 (PIR B). A3 is an exit only.
- `dijkstra(graph, origin)` returns `{ distances, predecessors, iterations }`. It uses the same O(n²) selection as the group's `dijkstra_tabla` (TPE4), and the app shows the iteration table.
- `lightWavePlan(origin, startTime, speed = 1.4)` computes, for each pole i:

  | Quantity | Value |
  |---|---|
  | arrival time | `arrival = startTime + distance / speed` |
  | `Active` from | `max(startTime, arrival − ANTICIPATION_TIME)` |
  | `Hold` from | `arrival` |
  | `Base` at | `arrival + HOLD_TIME` |

  `Active` cannot start before `startTime`, because the ESP32 cannot light a pole before the PIR fires.
- **At the A2 fork both branches light up**, because the system cannot know where the person is going.
- **Overlapping plans:** each pole takes the highest brightness. When brightness ties, the shown state follows this priority: `Active` > `Hold` > `Base` > `Off`.

## Strategies (`strategies.js`)

The night runs from 18:00 to 06:00 and stays dark the whole time in the simulation.

| Id | Rule |
|---|---|
| `permanent` | 100 % all night |
| `scheduled` | 100 % from 18 to 23, 50 % from 23 to 05, 100 % from 05 to 06 |
| `adaptive` | State machine + street graph |

## Scenarios (`scenarios.js`, deterministic)

| Id | People |
|---|---|
| `quiet` | 5 |
| `normal` | 20 |
| `busy` | 60 |

**Hourly share.** People are split across the hours by largest remainder, using integer arithmetic:

- `base = floor(pct · N / 100)`
- `remainder = (pct · N) % 100`
- When remainders tie, the earlier hour wins.

| Hour | 18 | 19 | 20 | 21 | 22 | 23 | 00 | 01 | 02 | 03 | 04 | 05 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| % | 20 | 20 | 15 | 15 | 10 | 6 | 4 | 2 | 1 | 1 | 2 | 4 |
| quiet | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| normal | 4 | 4 | 3 | 3 | 2 | 1 | 1 | 1 | 0 | 0 | 0 | 1 |
| busy | 12 | 12 | 9 | 9 | 6 | 4 | 2 | 1 | 1 | 1 | 1 | 2 |

**Arrival times.** Person k of the n people in an hour arrives at `hourStart + (k + 0.5) · 3600 / n`.

**Routes.** People are assigned these routes in turn: the first person gets route 1, the second route 2, and so on, cycling back to route 1.

1. A1→A2→B1→B2→B3
2. B3→B2→B1→A2→A1
3. A1→A2→A3
4. B3→B2→B1→A2→A3

Everyone walks at 1.4 m/s.

## Indicators (`nightSimulator.js`)

Each strategy × scenario run reports:

1. **Energy** in Wh.
2. **Savings** in % compared with `permanent`.
3. **Service level**: the % of people for whom every pole on their route is at 100 % at the moment they reach it.
4. **Switch-ons**: the number of times a pole rises to 100 % from a lower level.
5. **Power series**: power sampled once per minute, for charts.

## Control values (automated tests)

| Case | Expected |
|---|---|
| `permanent` | 7200 Wh |
| `scheduled` | 5400 Wh, a 25 % saving |
| `adaptive` with 0 people | 1440 Wh |
| `adaptive` with people | More than 1440 Wh and less than 7200 Wh |
| Service level, `permanent` and `adaptive` | 100 % |
| Service level, `scheduled` | Below 100 % **only** when someone walks between 23:00 and 05:00, which happens in `normal` and `busy`. `quiet` gives 100 % |

## Protocol (WebSocket JSON)

**ESP32 → server**, every 500 ms:

```json
{"type":"reading","strategy":"adaptive","mode":"auto","isNight":true,"clock":"21:30","ldrRaw":745,"ldrPercent":18.2,"pirA":1,"pirB":0,"brightness":[100,100,100,100,20,20],"states":["Active","Active","Active","Active","Base","Base"],"currentMa":74.2,"voltage":5.02,"powerMw":371.0}
```

- `mode` is `auto` (normal operation), `lampTest` or `calibration`.
- `permanent` and `scheduled` report the state `Fixed`; tests report `Fixed` too.
- The server forwards each reading to the browsers with the current night summary attached (`night: { strategy, seconds, energyMwh, people }`).

**App → server → ESP32** (operator controls):

| Message | Effect |
|---|---|
| `{"type":"command","name":"setStrategy","value":"scheduled"}` | Switches strategy |
| `{"type":"command","name":"lampTest"}` | All 6 LEDs at 100 % for 5 s, to spot a damaged LED |
| `{"type":"command","name":"calibrate"}` | LEDs from 0 to 100 % in steps of 10 %, 3 s per step; the INA219 readings give the Model 2 regression |

## What the server records (`data/`)

| File | Content |
|---|---|
| `nights/night_<start>.csv` | Every reading of one night |
| `nights.json` | One summary per night: start, strategy (or mixed), seconds, people detected, energy in mWh (Σ P · Δt with readings in `auto` mode), average power |
| `calibration.json` | Points (brightness %, average mW) of the last calibration |

Simulated nights are saved in `nights.json` too (`source: simulacion`, Wh and W, with service level and power per minute) when a night reaches 06:00 in the Simulación tab or with "Calcular al instante".

**CSV export** (`/api/export/<name>.csv`, buttons in Análisis): `resumen_noches`, `lecturas_maqueta`, `calibracion`, `simulacion_por_minuto`. `notebooks/analisis_alumbrado.ipynb` reads these four files.
