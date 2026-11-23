# Alumbrado público adaptativo · Grupo 10

Componente Práctico 2 de Modelos y Simulación (UNEMI, Ingeniería de Software).

Seis luminarias LED se regulan según la luz ambiente (LDR) y el paso de personas (PIR + grafo de calles). Un dashboard web cumple dos funciones:

- simula y compara tres estrategias: permanente, programada y adaptativa;
- muestra la maqueta ESP32 en tiempo real.

## Requisitos

- Node.js 22.
- `arduino-cli`, solo para el firmware.

## Cómo correrlo

```bash
npm install         # instala las dependencias dentro del proyecto (node_modules/)
npm test            # pruebas de los modelos con los valores de control
npm start           # dashboard en http://localhost:8080
npm run emulator    # ESP32 emulado, si la maqueta no está conectada
npm run export      # resultados de la simulación en data/results/
```

## Conectar la maqueta real

1. **Red WiFi.** Conecta la laptop y el celular al mismo hotspot de 2,4 GHz.
2. **Servidor.** Ejecuta `npm start` y anota la IP que aparece en la línea `Phone / ESP32 (SERVER_IP)`. La primera vez, permite el acceso de Node en el firewall de Windows (redes privadas).
3. **Firmware.** En `firmware/streetlights/streetlights.ino` cambia `WIFI_SSID`, `WIFI_PASS` y `SERVER_IP`.
4. **Subir el programa.** Conecta el ESP32 por USB y ejecuta:
   ```bash
   arduino-cli board list
   arduino-cli compile --upload -p COM3 --fqbn esp32:esp32:esp32 firmware/streetlights
   ```
   - `board list` muestra el puerto de la placa; cambia `COM3` por el que aparezca.
   - Si la subida se queda en "Connecting...", mantén presionado el botón BOOT un segundo.
5. **Abrir el dashboard.** Desde la laptop o el celular, abre `http://IP:8080` y elige **En vivo**. La etiqueta de arriba dice "ESP32 real" cuando los datos vienen de la placa.

Para que el PIR solo vea su calle:

- ponle un tubito de cartón;
- gira sus dos perillas al mínimo;
- espera un minuto después de encenderlo.

Si usan sensores FC-51 en lugar de PIR, cambia `PIR_ACTIVE_LEVEL` a `LOW`.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/shared/` | Los 3 modelos: máquina de estados, consumo con regresión, y grafo con Dijkstra y ola de luz. También las estrategias, los escenarios y el simulador de una noche |
| `src/client/` | Dashboard web |
| `src/server/` | Servidor: puente WebSocket entre placa y navegador, y registro de las pruebas en CSV |
| `src/emulator/` | ESP32 emulado |
| `firmware/streetlights/` | Programa del ESP32 |
| `tests/` | Pruebas automáticas |
| `scripts/` | Exportación de resultados |
| `data/` | Archivos generados: `results/` (simulación) y `logs/` (pruebas con la maqueta o el emulador) |
| `docs/` | Especificación del sistema, diagramas de arquitectura y material de referencia |
