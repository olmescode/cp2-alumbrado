# Alumbrado público adaptativo · Grupo 10

Componente Práctico 2 de Modelos y Simulación (UNEMI, Ingeniería de Software).

Seis luminarias LED se regulan según la luz ambiente (LDR) y el paso de personas (PIR + grafo de calles). El sistema tiene tres partes, como uno real:

1. **La maqueta decide sola.** El ESP32 lee el LDR y los PIR y enciende los postes, aunque no haya WiFi.
2. **Monitoreo.** La app muestra en vivo lo que pasa en la maqueta y deja cambiar la estrategia, probar las luminarias o calibrar el consumo. Todo lo que llega se registra.
3. **Análisis y simulación.** La app calcula cuánto se ahorró en las noches registradas. También simula una noche completa de la ciudad para comparar las tres estrategias: permanente, programada y adaptativa.

## Cómo correrlo

```bash
npm install     # dependencias dentro del proyecto (node_modules/)
npm test        # pruebas de los modelos con los valores de control
npm start       # app en http://localhost:8080
```

## Cómo se prueba con la maqueta

- **Día:** el LDR destapado. El reloj marca 06:00 y las luces se apagan.
- **Noche:** al tapar el LDR, el reloj salta a 18:00 y corre rápido (1 minuto real = 12 horas). Una prueba de 1 minuto tapado es una noche completa.
- **Personas:** se pasa el muñeco con la mano frente a un PIR. Detecta el calor de la mano. La ola de luz recorre los postes a ritmo visible, unos 2 s por tramo.
- **Comparar estrategias:**
  1. Haz una noche de 1 minuto con cada estrategia, pasando el muñeco el mismo número de veces.
  2. Abre **Análisis**: ahí aparece el ahorro medido junto al simulado.
- **Antes de la exposición:** pulsa **Calibrar consumo** una vez para obtener la recta potencia = a + b · brillo con datos reales.
- **Simulación:** a velocidad ×720 una noche simulada dura 1 minuto, igual que en la maqueta. Al llegar a las 06:00 la noche se guarda en Análisis junto a las de la maqueta.
- **Unidades:** todo se muestra a escala real (W y Wh). Lo que mide la maqueta en mW se convierte con 1 LED al 100 % (90 mW) = 1 luminaria real (100 W).

## Análisis en Colab

1. En **Análisis**, descarga los 4 CSV desde el menú **⋯** de la parte superior.
2. Abre `practica_cp2_alumbrado_grupo10.ipynb` en Google Drive (carpeta de prácticas) con Colab y ejecútalo; la primera celda pide subir los archivos.

El cuaderno sigue el formato de las prácticas de clase y aplica sus funciones (`reg_lin`, `tabla_sumatorias`, Euler, `dijkstra_tabla`) a los datos de la maqueta y de la simulación.

## Conectar la placa

1. **WiFi.** Conecta la laptop y el celular al mismo hotspot de 2,4 GHz.
2. **Servidor.** Ejecuta `npm start` y anota la IP que aparece como `SERVER_IP`. La primera vez, permite Node en el firewall de Windows (redes privadas).
3. **Firmware.** En `firmware/streetlights/streetlights.ino`, cambia `WIFI_SSID`, `WIFI_PASS` y `SERVER_IP`.
4. **Subir el programa.** Conecta el ESP32 por USB y ejecuta:
   ```bash
   arduino-cli board list
   arduino-cli compile --upload -p COM3 --fqbn esp32:esp32:esp32 firmware/streetlights
   ```
   Cambia `COM3` por el puerto que muestre `board list`. Si se queda en "Connecting...", mantén presionado BOOT un segundo.
5. **Ver los datos.** Abre `http://IP:8080` en la laptop o en el celular. Arriba debe aparecer "ESP32 conectado".

**PIR:**
- Ponles un tubito de cartón para que solo vean su calle.
- Gira sus dos perillas al mínimo.
- Espera un minuto después de encenderlos.
- Si usan sensores FC-51, cambia `PIR_ACTIVE_LEVEL` a `LOW`.

**LDR:** con la luz del salón encendida y con el LDR tapado, mira el porcentaje de "Luz ambiente" en Monitoreo. Ajusta `NIGHT_THRESHOLD` y `DAY_THRESHOLD` para que queden entre esos dos valores.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/shared/` | Los 3 modelos (máquina de estados, consumo y regresión, grafo con Dijkstra y ola de luz), estrategias, escenarios y simulador |
| `src/client/` | App web con las pestañas Monitoreo, Análisis y Simulación |
| `src/server/` | Puente entre la placa y la app, y registro de noches y calibración |
| `firmware/streetlights/` | Programa del ESP32 |
| `tests/` | Pruebas automáticas |
| `data/` | Generado por el servidor: `nights/` (lecturas de cada noche), `nights.json` (resumen) y `calibration.json` |
| `docs/` | Especificación, diagramas y material de referencia |
