# Tejo Mecha 💥

Juego de **tejo**, el deporte nacional de Colombia, para Android. Está hecho con **Vite (vanilla JS)** y **Capacitor**.
Cada chico tiene 10 tejos. Primero fijas la puntería, después la fuerza, y tienes que compensar el viento para reventar mechas o meter el tejo en el bocín.

**Autor:** Yeison Fabian Maceto Huertas · Tecnología en Desarrollo de Software · Uniagustiniana

## Puntaje
| Jugada | Puntos |
|---|---|
| Mecha (revientas una mecha) | 3 |
| Embocinada (el tejo cae dentro del bocín) | 6 |
| Moñona (embocinada + mecha) | 9 |
| Cerquita (cerca del bocín) | 1 |

El récord queda guardado en el celular.

## Controles
- 1er toque: fija la puntería (la flecha se mueve de lado a lado)
- 2do toque: fija la fuerza (la barra sube y baja)
- En PC: barra espaciadora o Enter. `P` para pausar.

## Cómo correrlo
```bash
npm install
npm run dev        # probar en el navegador
npm run build      # genera la carpeta dist
npx cap sync android
```

## Generar el APK
1. Ejecuta `npm install` (Android Studio necesita `node_modules/@capacitor/android`).
2. Abre la carpeta `android` en Android Studio.
3. Ve a Build → Generate App Bundle(s) / APK → Generate APK → **Locate**.

## Icono
La fuente está en `assets/icon.svg` (tejo, bocín y mecha explotando). Los PNG de Android se generan con:
```bash
npx capacitor-assets generate --android --iconBackgroundColor '#5b3518'
```
