# CLAUDE.md · CP2 Grupo 10: Alumbrado público adaptativo
---

## Objetivo

Construir el software del Componente Práctico 2 de Modelos Matemáticos y Simulación (UNEMI, Ingeniería de Software, Grupo 10). Son cinco piezas:

1. **Motor de simulación** con los 3 modelos.
2. **Aplicación web** responsive (laptop y celular) con dashboard, grafo, simulación y modo en vivo.
3. **Servidor** Node.js que recibe los datos del ESP32 por WebSocket, los guarda en CSV y los reenvía a la app.
4. **Emulador del ESP32**, para trabajar sin la maqueta física, que todavía se está construyendo.
5. **Firmware del ESP32** (Arduino).

**Contexto de la entrega.** El RAR con informe, código, simulación y presentación se entrega **hoy, domingo 22 de noviembre de 2026, 23:59**. En paralelo, otro chat escribira el informe. Necesita de aquí:
- resultados de la simulación en archivos;
- capturas de la app;
- tabla de trazabilidad ecuación → función.

La maqueta física se termina y se demuestra el día de la exposición, cuando se conectará el ESP32 real. Necesito que para cuando la coneccion se haga sea el proceso sencillo.

---

## Prioridad

1. Motor de simulación + script que genere `entrega/resultados/resultados_simulacion.csv` y `.json`, con pruebas de los valores de control. **Primero esto**, porque el informe lo necesita.
2. App web en modo Simulación: panel del grafo, estados, gráficas y tabla comparativa. Capturas PNG en `entrega/capturas/` (si hay Playwright o similar).
3. Servidor + emulador + modo En vivo.
4. Firmware del ESP32. Que compile con `arduino-cli` para `esp32:esp32:esp32` si está disponible.
5. `README.md` (cómo correr todo), `entrega/trazabilidad.md` y la estructura final del RAR.

Después de cada paso, que quede todo funcionando, para poder cortar si se acaba el tiempo.

---

## El sistema

- **Problema.** Las luminarias públicas pasan al 100 % toda la noche aunque no pase nadie. El sistema adaptativo regula cada luminaria según la luz ambiente y la cercanía de personas.
- **Ficha del grupo:** "Dashboard de luminarias y consumo. Simulación y comparación entre iluminación permanente, programada y adaptativa".

### Hardware y pines (para el firmware y los paneles de información)

| Componente | Conexión |
|---|---|
| ESP32 DevKit V1 30 pines | USB a la laptop para programar; WiFi al hotspot (solo 2,4 GHz) |
| 6 LEDs (postes A1, A2, A3, B1, B2, B3) | GPIO 13, 14, 16, 17, 18, 19 → resistencia 1 kΩ → base de un 2N2222. LED: 5 V → 100 Ω → ánodo; cátodo → colector; emisor → GND. PWM 5 kHz, 8 bits |
| PIR A (HC-SR501, entrada por A1) | OUT → GPIO 27, VCC 5 V. Detección = flanco de subida |
| PIR B (entrada por B3) | OUT → GPIO 26, VCC 5 V |
| LDR | 3,3 V → LDR → GPIO 34 (ADC1) → 10 kΩ → GND. Más luz = más ADC. ldr_pct = adc / 4095 × 100 |
| INA219 | SDA 21, SCL 22; en serie en la línea de 5 V que alimenta solo a los LEDs |
| MB102 | 5 V para LEDs y PIR; GND común con el ESP32 |

### Maqueta

- **Base:** 55 × 35 cm, elevada.
- **Zonas:** ciudad de 42 × 35 cm y zona técnica visible de 13 × 35 cm con 2 protoboards, ESP32, MB102 e INA219.
- **Calles en T:**
  - avenida horizontal (zona A) con A1, A2, A3 en la vereda superior;
  - calle vertical (zona B) que baja desde A2, con B1, B2, B3 en su vereda derecha.
- **Sensores:**
  - PIR A junto a A1;
  - PIR B junto a B3;
  - LDR en el techo de un edificio alto, con visera.
- **Decoración:** casas de papel.

---

## Los 3 modelos (fuente única de verdad)

Impleméntalos **una sola vez** en un módulo JS compartido por la app, el emulador y el script de resultados. Usa nombres en español, iguales a los del informe. El firmware los porta a C++ con los mismos nombres.

### Modelo 1: Máquina de estados de cada luminaria

| Elemento | Detalle |
|---|---|
| Estados | `Apagada` (0 %), `Base` (20 %), `Activa` (100 %), `Retencion` (100 %) |
| Umbrales | Noche si `ldr_pct < 30`; día si `ldr_pct > 40` (histéresis) |
| Parámetros | `NIVEL_BASE = 0.2`, `T_RET = 30 s`, `T_ANT = 10 s` |

Transiciones:
- Apagada → Base: anochece.
- Base → Activa: llega la hora de activación que calcula el grafo.
- Activa → Retención: la persona pasó el poste.
- Retención → Base: pasan `T_RET` segundos.
- Cualquier estado → Apagada: amanece.

Opcional: rampa suave de brillo, solo visual.

### Modelo 2: Consumo de energía

- `potencia(brillo, a, b) = a + b * brillo`, con brillo entre 0 y 1.
  - Escala real: `a = 0`, `b = 100` W.
  - Los parámetros son configurables, porque luego se reemplazan con la regresión del INA219 (en la maqueta, en mW).
- `energia`: suma de `potencia × Δt` de los 6 postes, con `Δt = 1 s`, en Wh.
- `regresionLineal(puntos)`: mínimos cuadrados. Devuelve a, b y R², para el barrido de brillo 0–100 % en pasos de 10 %.

### Modelo 3: Grafo de calles

- **Nodos:** A1, A2, A3, B1, B2, B3.
- **Aristas no dirigidas:** A1–A2, A2–A3, A2–B1, B1–B2, B2–B3.
- **Pesos:** 30 m cada una, configurables con las distancias reales.
- **Entradas:** A1 (PIR A) y B3 (PIR B). A3 es solo salida.
- `dijkstra(grafo, origen)` → distancias a cada poste.
- `planOlaDeLuz(origen, t0, v = 1.4)`. Para cada poste i:
  - llegada t_i = t0 + d_i / v;
  - Activa desde t_i − `T_ANT`;
  - Retención desde t_i;
  - Base en t_i + `T_RET`.
- **Bifurcación en A2:** se encienden **las dos ramas**, porque el sistema no sabe a dónde va la persona.
- Si varios planes se superponen, cada poste toma el estado de mayor brillo.

### Estrategias (noche de 18:00 a 06:00, oscura toda la noche en la simulación)

| Estrategia | Regla |
|---|---|
| `permanente` | 100 % siempre |
| `programada` | 100 % de 18 a 23, 50 % de 23 a 05, 100 % de 05 a 06 |
| `adaptativa` | Máquina de estados + grafo |

### Escenarios (determinísticos, reproducibles)

- Tranquila = 5 personas, normal = 20, concurrida = 60.
- Reparto por hora en %, redondeando con el método del mayor residuo y espaciando a las personas uniformemente dentro de cada hora:

| Hora | % |
|---|---|
| 18–19 | 20 |
| 19–20 | 20 |
| 20–21 | 15 |
| 21–22 | 15 |
| 22–23 | 10 |
| 23–00 | 6 |
| 00–01 | 4 |
| 01–02 | 2 |
| 02–03 | 1 |
| 03–04 | 1 |
| 04–05 | 2 |
| 05–06 | 4 |

- Recorridos, alternados en orden:
  - A1→A2→B1→B2→B3
  - B3→B2→B1→A2→A1
  - A1→A2→A3
  - B3→B2→B1→A2→A3
- Caminata a 1,4 m/s.

### Indicadores por estrategia y escenario

1. Energía total (Wh).
2. % de ahorro frente a la permanente.
3. Nivel de servicio: % de personas con 100 % de luz en cada poste de su recorrido al pasar.
4. Número de encendidos.

Además, guardar la serie de potencia por minuto para graficar.

### Valores de control (con pruebas automáticas)

- Permanente = 7 200 Wh.
- Programada = 5 400 Wh (25 % de ahorro).
- Adaptativa con 0 personas = 1 440 Wh.
- Adaptativa con personas > 1 440 Wh y < 7 200 Wh.
- Nivel de servicio: permanente 100 %; adaptativa 100 %; programada < 100 % si alguien pasa entre las 23 y las 05.

---

## Protocolo de comunicación (JSON por WebSocket)

**ESP32 o emulador → servidor**, cada 500 ms:

```json
{"tipo":"lectura","fuente":"esp32","t_ms":123456,"hora_sim":"21:30","estrategia":"adaptativa","ldr_adc":745,"ldr_pct":18.2,"noche":true,"pirA":1,"pirB":0,"brillo":[100,100,100,100,20,20],"estado":["Activa","Activa","Activa","Activa","Base","Base"],"ina_mA":74.2,"ina_V":5.02,"ina_mW":371.0}
```

`fuente` es `"esp32"` o `"emulador"`. La app muestra **siempre** un indicador visible de la fuente ("ESP32 real" o "Datos emulados"), para no presentar datos emulados como reales.

**Servidor → ESP32:**

| Mensaje | Qué hace |
|---|---|
| `{"tipo":"cmd","cmd":"estrategia","valor":"programada"}` | Cambia de estrategia |
| `{"tipo":"cmd","cmd":"iniciar_noche","factor":60}` | Noche acelerada: 1 s real = 1 min, la noche dura 12 min |
| `{"tipo":"cmd","cmd":"barrido_brillo"}` | Todos los LEDs de 0 a 100 % en pasos de 10 %, 3 s cada paso, para la regresión |
| `{"tipo":"cmd","cmd":"persona","entrada":"A1"}` | Solo en el emulador: simula una detección |

**Ola de luz en la maqueta física:** usa un factor de tiempo configurable (por defecto ×10, unos 2 s por tramo) para que se vea en la demo.

---

## Piezas de software

**Servidor (Node.js: `express` + `ws`)**
- Puerto 8080; sirve la app estática.
- WebSocket `/esp32` para la placa y `/app` para los navegadores; reenvía en ambos sentidos.
- Guarda cada prueba en `datos/prueba_<estrategia>_<escenario o barrido>_<fecha>.csv`.
- Alerta si el ESP32 se desconecta más de 3 s.
- Al iniciar, imprime la IP local para abrir la app desde el celular.

**Emulador (`emulador/emulador.js`)**
- Se conecta a `/esp32` como si fuera la placa y usa el mismo módulo de modelos.
- Responde a todos los comandos.
- Genera `ina_mW` con el modelo a escala de maqueta (unos 90 mW por LED al 100 %) más un poco de ruido.
- LDR según la hora simulada.
- Detecciones automáticas según el escenario, o manuales por comando o teclado.

**Firmware (`firmware/alumbrado_esp32/alumbrado_esp32.ino`)**
- Arduino-ESP32 core 3.x (`ledcAttach` / `ledcWrite`).
- Librerías:
  - `WebSocketsClient` (arduinoWebSockets de Links2004);
  - `ArduinoJson`;
  - `Adafruit_INA219`.
- Constantes `WIFI_SSID`, `WIFI_PASS`, `SERVIDOR_IP` y `SERVIDOR_PUERTO` al inicio.
- La lógica (máquina de estados + grafo) corre **en el ESP32**, así la maqueta funciona aunque se caiga el WiFi.
- Reconexión automática.

**App web**
- **Modo Simulación:** reloj de la noche; play, pausa, reiniciar y velocidad; selector de estrategia y escenario; botones "pasar persona por PIR A / PIR B"; deslizador de luz ambiente.
- **Modo En vivo:** refleja los datos del servidor (ESP32 o emulador) en la maqueta 3D y el grafo, y envía los comandos.
- **Vistas:**
  - panel del grafo en 2D con los nodos coloreados por brillo y los pesos en las aristas;
  - tabla de estados por poste;
  - gráficas de potencia y energía acumulada (Chart.js);
  - tabla comparativa de las 3 estrategias;
  - panel de alertas: ESP32 desconectado, LED con brillo alto y corriente que no sube (posible LED dañado), LDR fuera de rango;
  - histórico de pruebas (CSV);
  - comparación simulado vs observado en % de ahorro;
  - vista de la regresión del barrido de brillo (puntos, recta, a, b, R²).
- **Diseño:**
  - usa mis skills de diseño UI/UX que tengo instaladas, para que quede bonita y profesional;
  - responsive, para el celular;
  - todo en español, excepto el codigo;

---

## Estructura sugerida

```
cp2-alumbrado/
  CLAUDE.md
  README.md
  referencia/maqueta_3d.html
  modelo/           (módulo JS de los 3 modelos + pruebas)
  simulacion/       (script que genera los resultados)
  servidor/
  emulador/
  app/
  firmware/alumbrado_esp32/
  datos/            (CSV de pruebas)
  entrega/
    resultados/     (resultados_simulacion.csv y .json, series por minuto)
    capturas/
    trazabilidad.md (ecuación → archivo y función)
```

---

## Reglas

- Código limpio, simple y fácil de explicar en la exposición, con nombres en español.
- Implementar **exactamente** lo que está en este archivo. Si cambias un parámetro o una regla, anótalo en `README.md` en "Cambios respecto al diseño", para que el informe quede coherente.
- Cada número que vaya al informe tiene que salir de un archivo generado por el código.
- **Nunca** generar datos que parezcan mediciones reales del prototipo. Lo del emulador se etiqueta como emulado.