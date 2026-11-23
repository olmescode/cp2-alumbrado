# Alumbrado público adaptativo · Grupo 10

Componente Práctico 2 de Modelos y Simulación (UNEMI, Ingeniería de Software).

Seis luminarias LED se regulan según la luz ambiente y el paso de personas. Un dashboard web simula y compara tres estrategias de iluminación (permanente, programada y adaptativa) y muestra la maqueta ESP32 en tiempo real.

## Cómo correrlo

```bash
npm install
npm test            # pruebas de los modelos
npm start           # abre http://localhost:8080 (también desde el celular con la IP que imprime)
npm run emulator    # ESP32 emulado, si no está la maqueta
```

## Documentación

- [docs/system.md](docs/system.md): modelos, estrategias, escenarios y protocolo.
- [docs/architecture.md](docs/architecture.md): diagramas de arquitectura.
