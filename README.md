# Portón Garen FIT RAMP + Shelly Plus Uni

🇪🇸 Español · [🇬🇧 English](README.en.md)

Automatización de un portón con central **Garen FIT RAMP V2.2** usando un **Shelly Plus Uni**:
apertura desde el celular y **Apple CarPlay**, estado **abierto / cerrado / a mitad** leído de los
finales de carrera reales, y **alerta push** si el portón queda abierto.

Sin componentes extra: el Shelly se alimenta de la propia placa y se conecta con 7 cables.

| Antes | Después |
|---|---|
| ![Placa Garen original](images/placa-garen-instalada.webp) | ![Shelly instalado](images/instalado-general.jpeg) |

---

## Contenido

- [Hardware](#hardware)
- [Mediciones de la placa](#mediciones-de-la-placa)
- [Conexiones](#conexiones)
- [Configuración del Shelly](#configuración-del-shelly)
- [Cómo se detecta abierto / cerrado](#cómo-se-detecta-abierto--cerrado)
- [Scripts](#scripts)
- [Alertas push (ntfy)](#alertas-push-ntfy)
- [CarPlay](#carplay)
- [Siri](#siri-oye-siri-abrir-portón)
- [WiFi y recuperación](#wifi-y-recuperación)
- [Lecciones aprendidas](#lecciones-aprendidas)
- [Advertencia](#advertencia)

---

## Hardware

| | Detalle |
|---|---|
| Central | **Garen FIT RAMP V2.2**, etiqueta `FIT-RAMP A01516-X`, serigrafía `CI05619 FIT RAMP V2.2` |
| Variantes | `A01516` = DZ (corredizo) y `A01518` = BV (basculante) son la **misma placa**; cambia el jumper BV/DZ |
| Manual | [manual_central_fit_ramp.pdf](https://docs.garen.com.br/manuais/manual_central_fit_ramp.pdf) |
| Módulo | **Shelly Plus Uni** (Gen2), firmware original 2.0.1 |
| Extras | Cables Dupont hembra, termocontraíble |

### ¿Por qué Shelly Plus Uni?

Encaja directo con la placa, sin adaptar nada:

| Necesidad | Shelly Plus Uni | Placa Garen |
|---|---|---|
| Alimentación | 9–28 V DC | Conector FOTO: **12 V** |
| Pulso a BOT | 2 salidas libres de potencial (máx. 30 V / 0,3 A) | BOT: **5,2 V** |
| Leer finales de carrera | 2 entradas digitales | FCA / FCF: **0 V** activo, **~5 V** inactivo |
| App y CarPlay | App Shelly Smart Control (nube) | — |

![Shelly Plus Uni](images/shelly-plus-uni.webp)

---

## Mediciones de la placa

Medido con multímetro en DC, referencia = masa de la placa (negativo del conector FOTO).

**Conector FOTO** (orden `− señal +`): **12 V** entre + y −.

**FIM-CURSO**: la placa tiene **dos fichas en paralelo** para fin de carrera. Una la usa el
motor; la otra queda libre y es donde se conecta el Shelly. **Pin del medio = GND**.

| Portón | FCF | FCA | LED |
|---|---|---|---|
| Cerrado | 0 V | ~5 V | FCF (verde) |
| A mitad | 4,7 V | 4,7 V | ninguno |
| Abierto | 4,7 V | 0 V | FCA (rojo) |

**BOT** (2 pines): el pin marcado con **puntito = señal (5,2 V)**, el otro = GND.
Unirlos ~**1 segundo** equivale a apretar el pulsador. Ciclo: **abre → para → cierra → para → abre**.
Pulsos más cortos son ignorados por la placa.

**Recorrido**: ~**12 s** en cada sentido.

Los finales de carrera del motor son **microswitches mecánicos** accionados por una leva.

| Fichas FIM-CURSO en la placa | Fin de carrera en el motor |
|---|---|
| ![Fichas FIM-CURSO](images/fim-curso-fichas.png) | ![Fin de carrera](images/fin-de-carrera-motor.jpeg) |

---

## Conexiones

![Diagrama de conexiones](docs/wiring.svg)

| Shelly Plus Uni | Placa Garen |
|---|---|
| Arnés **1 · VAC1** | FOTO **+** (12 V) |
| Arnés **2 · VAC2** | FOTO **−** |
| Arnés **7 · GND** | FIM-CURSO libre, **pin del medio** |
| Arnés **9 · IN1** | FIM-CURSO libre, **FCF** |
| Arnés **10 · IN2** | FIM-CURSO libre, **FCA** |
| **OUT1** (2 cables negros gruesos) | Los 2 pines de **BOT** (sin polaridad) |

Notas:

- **GND (pin 7) es obligatorio**: las entradas IN1/IN2 se leen contra el pin 7, no contra VAC2
  (VAC1/VAC2 aceptan alterna y pasan por un rectificador interno).
- Cables sin uso: **3, 4, 5, 6, 8** y los dos negros de **OUT2**. Aislar cada uno.
  ⚠️ **4 (SENSOR VCC)** y **6 (+5 V)** son **salidas de alimentación**: si tocan masa hacen
  cortocircuito. Aislarlos bien o cortarlos.
- Se usaron cables **Dupont hembra** soldados al arnés: no hay que soldar nada en la placa Garen.
- El Shelly va dentro de la caja de la central, fijo para que no toque la placa ni el chasis.
  Señal WiFi medida dentro de la carcasa metálica del motor: **-62 a -65 dBm**.

### Fotos del proceso

| Arnés preparado (Dupont + termocontraíble) | |
|---|---|
| ![Arnés](images/arnes-preparado.jpeg) | ![Arnés](images/arnes-preparado-2.jpeg) |

| FIM-CURSO y FOTO conectados | BOT conectado |
|---|---|
| ![FIM-CURSO y FOTO](images/instalado-fim-curso-foto.jpeg) | ![BOT](images/instalado-bot.jpeg) |

---

## Configuración del Shelly

Con el **firmware original** de Shelly (no hace falta firmware alternativo).

| Componente | Configuración |
|---|---|
| OUT1 (`switch:0`) "Portón" | `in_mode: detached`, `auto_off: true`, `auto_off_delay: 1.0`, `initial_state: off` |
| OUT2 (`switch:1`) | `in_mode: detached`, `initial_state: off` — usada como indicador (ver abajo) |
| IN1 (`input:0`) "Cerrado (FCF)" | `invert: true` |
| IN2 (`input:1`) "Abierto (FCA)" | `invert: true` |
| COUNT (`input:2`) | `enable: false` |
| WiFi | Red principal (la del portón) + red de respaldo; AP con contraseña |

Se puede aplicar todo por RPC desde la red local (reemplazar `IP`):

```bash
curl -X POST -d '{"id":1,"method":"Switch.SetConfig","params":{"id":0,"config":{"name":"Porton","in_mode":"detached","initial_state":"off","auto_off":true,"auto_off_delay":1.0}}}' http://IP/rpc
curl -X POST -d '{"id":1,"method":"Switch.SetConfig","params":{"id":1,"config":{"in_mode":"detached","initial_state":"off"}}}' http://IP/rpc
curl -X POST -d '{"id":1,"method":"Input.SetConfig","params":{"id":0,"config":{"name":"Cerrado (FCF)","invert":true}}}' http://IP/rpc
curl -X POST -d '{"id":1,"method":"Input.SetConfig","params":{"id":1,"config":{"name":"Abierto (FCA)","invert":true}}}' http://IP/rpc
curl -X POST -d '{"id":1,"method":"Input.SetConfig","params":{"id":2,"config":{"enable":false}}}' http://IP/rpc
```

> ⚠️ **Importante:** de fábrica las salidas vienen en modo `follow` (la entrada maneja el relé).
> Con este cableado, eso haría que el Shelly **mantenga apretado BOT** cada vez que el portón llega
> a una posición, y el portón se movería solo. Configurar `detached` **antes** de conectar BOT.

---

## Cómo se detecta abierto / cerrado

Las entradas del Plus Uni marcan **"encendida" cuando hay tensión**. Como los finales de carrera
dan **0 V cuando están activos**, hay que **invertir** las dos entradas.

Estados verificados con el portón funcionando:

| Cerrado (FCF) | Abierto (FCA) | Estado |
|---|---|---|
| encendida | apagada | **Cerrado** |
| apagada | encendida | **Abierto** |
| encendida | encendida | **Entre medio** (moviéndose o frenado a mitad) |

- "Moviéndose" y "frenado a mitad" no se distinguen solo con las entradas. Como el recorrido dura
  ~12 s, si el estado "entre medio" dura más de ~30 s, quedó frenado.
- La **dirección** sí se puede deducir: si sale de cerrado está abriendo; si sale de abierto, cerrando.
- Con el multímetro (sin el Shelly) a mitad de camino se miden 4,7 V; con el Shelly conectado esas
  líneas se leen como "sin tensión". No afecta el funcionamiento.

### Indicador de estado y botón inteligente

La app de Shelly muestra las salidas pero no las entradas en modo `detached`. Por eso se usa
**OUT2** (no conectada a nada) con el script [`watchdog-state.js`](scripts/watchdog-state.js):

- **Indicador:** OUT2 queda **encendida cuando el portón no está cerrado** y apagada cuando está
  cerrado. Su nombre en el Shelly cambia a `Estado: cerrado / abierto / a mitad` (visible en la
  configuración del canal; el dashboard de la app usa su propio nombre).
- **Botón inteligente:** encender OUT2 **abre** el portón (solo si está cerrado); apagarla lo
  **cierra** (solo si está abierto). A mitad de camino no hace nada, porque no se sabe hacia
  dónde iría el pulso. Después de cada orden vuelve a mostrar el estado real.

En la app aparecen dos tarjetas: renombrarlas a **"Portón"** (OUT1, pulso simple) y
**"Portón abierto"** (OUT2, indicador y botón inteligente).

![App Shelly](images/app-dashboard.png)

---

## Scripts

El Plus Uni permite **como máximo 3 scripts activos**. Los tres se cargan desde la web del Shelly
(**Scripts → Create**), se pegan, se activan con **Enable** (arranque automático) y **Start**.

| Script | Qué hace |
|---|---|
| [`ap-rescue.js`](scripts/ap-rescue.js) | Si pasa 5 min sin poder conectarse a ninguna red WiFi, enciende el AP del Shelly **con contraseña**. Lo apaga al reconectar. |
| [`watchdog-state.js`](scripts/watchdog-state.js) | **Watchdog**: si OUT1 queda encendida más de 2-3 s (falla del auto-off), la apaga. **Indicador y botón inteligente** en OUT2. |
| [`open-alert.js`](scripts/open-alert.js) | Alerta push por ntfy si el portón **no está cerrado** más de 5 min; repite cada 15 min y avisa al cerrarse. |

Antes de cargarlos, cambiar `AP_PASS` en `ap-rescue.js` y `TOPIC` en `open-alert.js`.

---

## Alertas push (ntfy)

[ntfy](https://ntfy.sh) es gratis y no pide cuenta:

1. Instalar la app **ntfy** (iOS / Android).
2. Suscribirse a un tema **aleatorio y privado** (por ejemplo `porton-` + caracteres al azar).
   Cualquiera que conozca el nombre puede leer los avisos.
3. Poner ese tema en `TOPIC` de `open-alert.js`.

Activar este script **después** de verificar las entradas: si están al revés, el portón cerrado
se ve como abierto y llegan alertas falsas.

---

## CarPlay

La app **Shelly Smart Control** tiene CarPlay nativo y funciona por la nube (no requiere hub de
Apple Home): **Configuración → App Settings → CarPlay Devices → Editar** y elegir las tarjetas.
Ver la [guía oficial](https://support.shelly.cloud/en/support/solutions/articles/103000308601-add-shelly-devices-to-apple-carplay).

Apple Home (HomeKit) no se usó: el Plus Uni con firmware original no es compatible y el acceso
remoto necesitaría un hub (HomePod o Apple TV).

---

## Siri ("Oye Siri, abrir portón")

> En prueba: la orden llega al Shelly; falta confirmar el recorrido completo con el atajo.

Con la app **Atajos** del iPhone, un atajo por orden, usando la
[Cloud Control API](https://shelly-api-docs.shelly.cloud/cloud-control-api/) de Shelly. Como la
lógica está en el Shelly (botón inteligente en OUT2), cada atajo tiene solo dos acciones:

1. **Obtener contenido de URL**
   - URL: `https://<servidor>.shelly.cloud/device/relay/control`
   - Método: **POST** · Cuerpo: **Formulario**
   - Campos: `id` = ID del dispositivo, `auth_key` = clave de la nube, `channel` = `1`,
     `turn` = `on` (abrir) / `off` (cerrar)
2. **Leer texto con voz**: "Orden enviada".

El servidor y la clave están en la app Shelly (Configuración → Hogar → Acceso y permisos →
Clave de la nube). El ID es la MAC del Shelly en minúsculas.

- Tiene que ser **POST con los datos en el cuerpo**: con GET (datos en el link) la API responde
  `wrong_channel`.
- Ejecutar cada atajo una vez en el celular y elegir **Permitir siempre**; si no, en el auto iOS
  no puede mostrar la pregunta de permiso.
- La clave de la nube da control de **todos** tus dispositivos: no compartirla.

---

## WiFi y recuperación

Tres capas para no tener que desmontar nunca el Shelly:

1. **WiFi 1** = red del portón, **WiFi 2** = red de respaldo (por ejemplo, el hotspot del celular
   con nombre y clave fijos).
2. **`ap-rescue.js`**: sin WiFi durante 5 min, el Shelly crea su propia red (con clave).
   Conectarse y entrar a `http://192.168.33.1` para cargar la red nueva.
3. Último recurso: reset por cortes de alimentación (cortar la luz de la central).

---

## Lecciones aprendidas

- **`follow` de fábrica es peligroso** con este cableado: configurar `detached` antes de conectar BOT.
- **Las entradas se leen al revés** de lo que sugiere la documentación del Uni: hubo que invertirlas.
- **Doble toque en la app**: el pulso dura 1 s; tocar de nuevo mientras está encendido lo apaga en
  vez de mandar otro pulso. Esperar a que termine la animación del botón.
- **La API de la nube puede mostrar datos viejos** de las entradas: para verificar, leer en local
  (`http://IP/rpc/Input.GetStatus?id=0`).
- **Borrar el dispositivo de la app no lo resetea**: conserva WiFi, configuración y scripts; basta
  con volver a agregarlo.
- La app usa **sus propios nombres** para cada canal, no el nombre que pone el Shelly.
- **Un watchdog no debe cortar pulsos válidos**: la primera versión apagaba OUT1 cada vez que la
  encontraba encendida en un chequeo periódico, y a veces cortaba el pulso de 1 s antes de tiempo
  (la placa lo ignoraba). Ahora solo actúa si la salida sigue encendida en 3 chequeos seguidos.
- **Cloud API**: las órdenes (`/device/relay/control`) requieren POST con cuerpo de formulario.

---

## Advertencia

La central trabaja con **220 V**. Cortar la alimentación antes de conectar o desconectar cualquier
cosa. Proyecto personal, sin relación con Garen ni Shelly; usalo bajo tu propio riesgo.

## Licencia

[MIT](LICENSE)
