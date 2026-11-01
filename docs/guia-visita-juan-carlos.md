# Campo · Guía de la visita a Juan Carlos

Todo lo que hay que hacer con él, en orden. Tiempo total: **unos 60 minutos**.

**Qué llevar:**
- Esta guía.
- El archivo **`preguntas-campo.md`** descargado en el ordenador donde vayáis a crear los GPTs (está en el proyecto Campo y en `C:\FINCAS\campo-web\docs\deberes`). Hace falta para el paso 4.
- Su móvil y, si puede ser, un ordenador con su cuenta de ChatGPT abierta. Los GPTs se crean desde el ordenador (chatgpt.com); desde el móvil solo se usan.

**Orden:**
0. Comprobar plan y móvil (2 min)
1. Crear el GPT de pruebas «Campo (prueba)» (10 min)
2. Probarlo en el ordenador y en el móvil (10 min)
3. Mirar ajustes y apuntar cómo habla (10 min)
4. Crear el GPT de preguntas «Campo · Preguntas» (10 min)
5. Hacer juntos el bloque 1 por voz (10 min)
6. Rellenar el resultado y mandármelo

> No uses ni apuntes sus contraseñas. Los dos GPTs se crean **en su cuenta** y se dejan como **«Solo yo»**.

---

## 0. Comprobar plan y móvil (2 min)

- [ ] **Qué plan tiene de verdad.** En la app: Ajustes → Cuenta (o «Mejorar plan»).
  - Si paga **unos 20-23 €/mes, es ChatGPT Plus** (no «Pro»; Pro cuesta unos 200 €/mes). Con Plus se pueden crear GPTs propios con acciones, que es lo que necesitamos.
  - Si es **Go** (el más barato de pago, unos 8 €) o gratis, **no** puede crear GPTs con acciones: apúntalo y seguimos con el resto de pruebas.
- [ ] **Dónde lo usa:** ¿móvil, ordenador o los dos? ¿iPhone o Android?
- [ ] **Versión de la app:** Ajustes → Acerca de (apunta el número).
- [ ] **Versión del sistema del móvil** (para las notificaciones de Campo): iPhone → Ajustes → General → Información → «Versión de iOS» (hace falta 16.4 o más); Android → Ajustes → Información del teléfono.
- [ ] **¿Usa la voz?** (el micrófono o el modo de conversación por voz).

> Importante: el GPT de prueba se crea **en su cuenta**, con él delante. No uses ni apuntes sus contraseñas.

---

## 1. GPT de pruebas «Campo (prueba)» (10 min)

Mejor desde el **ordenador** (chatgpt.com), con su cuenta abierta. Desde el móvil no se pueden crear GPTs.

1. Menú lateral → **GPTs** → **Crear**.
2. Pestaña **Configurar**:
   - **Nombre:** `Campo (prueba)`
   - **Descripción:** `Prueba de conexión con la app de las fincas`
   - **Instrucciones:** copia esto:

```
Eres el ayudante de campo de Juan Carlos (le llamas Carlos). Hablas en español, corto y claro.
Esto es una PRUEBA: nada se guarda de verdad.
- Si pregunta por el tiempo en una finca, usa la acción consultarTiempo con estas coordenadas:
  Corvera 37.8109, -1.1454 · Valladolises 37.7728, -1.1010 · Lobosillo 37.7181, -1.0798.
- Si te pide apuntar algo (tarea, nota, nivel de pantano, lectura de contador, riego, tratamiento),
  primero resume lo que vas a apuntar (qué, dónde, cuándo) y pide confirmación;
  después usa la acción apuntarPrueba y dile que es una prueba y que no se ha guardado.
- Si no sabes en qué finca o zona es, pregunta antes de apuntar. No inventes.
```

3. **Funciones:** deja activadas Búsqueda web y Análisis de imágenes (si salen).
4. **Acciones → Crear nueva acción.** Autenticación: **Ninguna**. En «Esquema», pega esto (es el tiempo, de Open-Meteo, gratis y sin claves):

```yaml
openapi: 3.1.0
info:
  title: Tiempo en las fincas (prueba)
  version: "1.0"
servers:
  - url: https://api.open-meteo.com
paths:
  /v1/forecast:
    get:
      operationId: consultarTiempo
      summary: Tiempo actual en un punto (temperatura, viento, lluvia)
      parameters:
        - name: latitude
          in: query
          required: true
          schema: { type: number }
        - name: longitude
          in: query
          required: true
          schema: { type: number }
        - name: current
          in: query
          required: false
          schema: { type: string, default: "temperature_2m,wind_speed_10m,precipitation" }
        - name: timezone
          in: query
          required: false
          schema: { type: string, default: "Europe/Madrid" }
      responses:
        "200":
          description: OK
```

5. **Otra acción nueva** (botón «Crear nueva acción» otra vez), autenticación **Ninguna**, con este esquema. Simula un guardado: el servicio solo devuelve lo que se le manda, **no guarda nada**. Usa solo datos de prueba (nada personal):

```yaml
openapi: 3.1.0
info:
  title: Apuntar en Campo (prueba, no guarda nada)
  version: "1.0"
servers:
  - url: https://httpbin.org
paths:
  /anything:
    post:
      operationId: apuntarPrueba
      summary: Simula apuntar algo en Campo. No guarda nada; devuelve lo enviado.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                tipo:
                  type: string
                  enum: [tarea, nota, nivel_pantano, lectura_contador, riego, tratamiento]
                texto: { type: string }
                finca: { type: string }
                zona: { type: string }
                fecha: { type: string, description: "AAAA-MM-DD" }
                valor: { type: string, description: "número o porcentaje, si lo hay" }
              required: [tipo, texto]
      responses:
        "200":
          description: OK
```

6. Arriba a la derecha: **Crear / Actualizar** → compartir: **Solo yo**.

---

## 2. Probar el GPT de pruebas (10 min)

Haz cada prueba **primero en el ordenador** y **luego en su móvil** (en la app, buscando el GPT «Campo (prueba)» en el menú de GPTs).

| # | Qué decir (o escribir) | Qué debe pasar | Ordenador | Móvil |
|---|---|---|---|---|
| 1 | «¿Qué tiempo hace en Corvera?» | Sale un aviso de que va a usar api.open-meteo.com → **Permitir**. Responde con temperatura y viento reales. | ☐ | ☐ |
| 2 | «Apunta una tarea: regar Los Nuevos mañana» | Resume (tarea, Valladolises / Del Pozo, fecha de mañana) y pide confirmar. Sale el botón **Confirmar** de ChatGPT. Al confirmar, dice que es una prueba. | ☐ | ☐ |
| 3 | «El pantano de Valladolises está a media altura» | Interpreta nivel ≈ 50 %, pregunta o confirma antes de «apuntar». | ☐ | ☐ |
| 4 | «Regar la finca 4» | **Debe preguntar** qué finca es (no adivinar). | ☐ | ☐ |
| 5 | Lo mismo que la 2 pero **hablando** (micrófono o modo voz) | ¿Lo entiende bien? ¿Lanza la acción en modo voz? | ☐ | ☐ |
| 6 | Foto de un **contador** (o de cualquier contador de agua/luz que tengáis a mano): «¿Qué lectura marca?» | Apunta si lee bien el número (anota el real y el que dice). | ☐ | ☐ |

**Si falla en el móvil:**
- Apunta el mensaje exacto que da (o haz captura).
- Prueba el mismo GPT desde el **navegador del móvil** (chatgpt.com) en vez de la app.
- Esto es justo lo que necesitamos saber: en mayo de 2026 se reportó que algunas acciones de GPTs dejaron de funcionar en la app móvil.

---

## 3a. Mirar ajustes sin tocar (3 min)

- [ ] Ajustes → **Aplicaciones / Conectores** → ¿aparece **«Modo desarrollador»** (en ajustes avanzados)? Solo mirar, **no activarlo**. (Es la otra vía, «MCP», que según las fuentes de 2026 solo funciona en la web).
- [ ] ¿Tiene activada la **Memoria** de ChatGPT? ¿Tiene conversaciones donde ya apunta cosas del campo («Archiva esto…»)? Pregúntale si quiere que más adelante pasemos ese historial a Campo.

---

## 3b. Cómo habla él (lo más valioso, 7 min)

Pídele que te diga **10 frases reales** de las que suele decirle a ChatGPT o que diría en el campo. Cópialas tal cual. Por ejemplo:

1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
4. _______________________________________________
5. _______________________________________________
6. _______________________________________________
7. _______________________________________________
8. _______________________________________________
9. _______________________________________________
10. ______________________________________________

Y pregúntale:
- [ ] ¿Qué es lo que **más le gustaría apuntar sin escribir**? (orden de importancia)
- [ ] ¿Qué **le gustaría preguntar** a Campo? (p. ej. «¿cuánta agua queda?», «¿qué hizo Pencho ayer?»)
- [ ] ¿Quién más debería poder apuntar? (Pencho, Salah, Diego Vélez, tu hermano…)
- [ ] ¿Cuánto tarda en cogerle el truco? ¿Le molesta el botón «Confirmar»?
- [ ] **Calendario:** ¿qué fechas le gustaría que Campo le recordara (cortes, tratamientos, plazos de papeles…)? ¿Con cuánta antelación? ¿A qué hora le viene bien el aviso en el móvil?

---

## 4. GPT de preguntas «Campo · Preguntas» (10 min)

Es el GPT de los «deberes»: le hace las preguntas de `preguntas-campo.md` de una en una y por voz, y al final le da un acta para mandarte.

### 4.1 Crear el GPT

1. Menú lateral → **GPTs** → **Crear** → pestaña **Configurar**.
2. **Nombre:** `Campo · Preguntas`
3. **Descripción:** `Te hago preguntas sobre las fincas para completar la app Campo`
4. **Instrucciones:** copia el bloque del apartado 4.2 tal cual.
5. **Conocimiento:** sube el archivo `preguntas-campo.md`.
6. **Iniciadores de conversación** (uno por línea):
   - `Empezamos por el siguiente bloque`
   - `Hazme el bloque 1`
   - `Quiero contarte algo de las fincas`
   - `Termina y dame el acta`
7. **Funciones:** activa **Análisis de imágenes / subida de archivos** (para fotos de planos, placas y contadores). Las demás, como vengan.
8. **Crear** → compartir: **Solo yo**.

En el móvil aparecerá en su lista de GPTs. Para hablar: el botón de **voz** o el **micrófono** del teclado.

### 4.2 Instrucciones del GPT (copiar entero en «Instrucciones»)

```
Eres el ayudante de Campo, la app de las fincas de la familia (Valladolises, Corvera y Lobosillo).
Hablas con Juan Carlos; llámale Carlos. Español de Murcia, cercano, frases cortas.
Muchas veces te hablará por voz: no uses tablas, listas largas ni negritas cuando hables; no leas los códigos (LOB-01…) en voz alta.

TU TRABAJO
Hacerle las preguntas del archivo «preguntas-campo.md» para completar los datos de la app.
- Si no dice qué bloque, pregúntale si sigue por donde lo dejó o qué bloque quiere (1 a 10). Si no se acuerda, empieza por el 1.
- Una pregunta cada vez. Primero di en una frase lo que ya creemos («Tenemos apuntado que…, ¿es así?») y luego pregunta.
- Espera su respuesta. Si da un número, repítelo con su unidad para confirmar («¿2.300 árboles, verdad?»).
- Si dice «no sé», «más o menos» o «eso lo sabe Pencho», apúntalo así y pasa a la siguiente. No insistas.
- Si su respuesta abre algo nuevo importante, haz como mucho UNA repregunta corta.
- Si manda una foto (plano, placa, contador), di qué ves en ella y pregúntale si lo has leído bien.
- Después de 5 preguntas, pregúntale si quiere seguir con otro bloque o terminar.
- Si en cualquier momento cuenta algo que no estaba en las preguntas, apúntalo como NOTA.
- Nunca inventes datos ni rellenes huecos con suposiciones. No des consejos agronómicos ni de tratamientos.
- No pidas datos personales (DNI, cuentas bancarias, contraseñas). Si los dice, no los copies en el acta.

AL TERMINAR (cuando diga «termina», «ya está», «dame el acta» o acabe el bloque y no quiera seguir)
Escribe el acta EXACTAMENTE con este formato, en un bloque de texto, sin nada más alrededor salvo una frase final:

ACTA CAMPO · AAAA-MM-DD · Juan Carlos · bloques X
CÓDIGO | respuesta con sus palabras, resumida | seguro / aproximado / no sé
CÓDIGO | …
NOTA | cualquier dato extra que haya contado
FOTOS | qué fotos ha mandado y para qué pregunta

Usa la fecha de hoy. Una línea por pregunta contestada (también las de «no sé»). No incluyas las preguntas que no se hicieron.
Después dile: «Mándale esto a Antonio por WhatsApp (pulsa en copiar). ¡Gracias, Carlos!»
```

---

## 5. Hacer juntos el bloque 1 por voz (10 min)

1. En su **móvil**, abre «Campo · Preguntas» y pulsa el botón de **voz** (o el micrófono del teclado).
2. Que diga: «Hazme el bloque 1».
3. Que conteste él, como le salga (Lobosillo: qué hay plantado, superficie, agua, riego, si es ecológica).
4. Al acabar: «Termina y dame el acta» → que te la mande por **WhatsApp**.
5. Apunta:
- [ ] ¿Le ha resultado cómodo por voz?
- [ ] ¿El acta recoge bien lo que dijo?
- [ ] ¿Ha funcionado mandar una foto (plano, placa, contador)?

**Si da tiempo, el bloque 11 (Lecturas) mejor en persona y en la caseta:** que te enseñe qué mira (contadores, pantano, cubetas del riego…), cómo lo lee y cada cuánto. Haz **una foto de cada contador y de cada cubeta** con la lectura de hoy: serán las primeras lecturas en Campo y la base de la lista «Lecturas de hoy».

### Para explicárselo (cómo será cada vez)

1. Abre **Campo · Preguntas** en el móvil y pulsa la **voz**.
2. Dice: «Seguimos con el bloque 2» (o simplemente «empezamos»).
3. Contesta como le salga. Si no sabe algo: «no lo sé» y sigue.
4. Cuando quiera parar: «termina y dame el acta».
5. Copia el acta y **te la manda por WhatsApp**, junto con las fotos si hizo alguna.

---

## 6. Resultado (rellenar al acabar y mandármelo)

| Pregunta | Respuesta |
|---|---|
| Plan de ChatGPT | |
| Dispositivo y versión de la app | |
| Acciones en ordenador | funcionan / no |
| Acciones en app móvil | funcionan / no (mensaje: …) |
| Acciones en navegador del móvil | funcionan / no |
| Modo voz con acciones | funciona / no |
| Lee bien un contador por foto | sí / no |
| Aparece «Modo desarrollador» | sí / no |
| Responder preguntas por voz le resulta cómodo | sí / no |
| Cómo prefiere mandar las respuestas | |
| Sistema del móvil y versión (iOS/Android) | |
| Qué quiere que le recuerde, antelación y hora | |

**Con esto decidimos el camino:**
- **Acciones funcionan en su móvil** → vamos con el **GPT «Campo»** propio (camino principal).
- **Solo funcionan en ordenador** → GPT para el ordenador + en el móvil un botón «Apuntar» en la propia app de Campo (escribiendo o dictando).
- **No puede crear GPTs** (plan Go/gratis) → o sube a Plus, o se apunta desde la app de Campo y ChatGPT queda para consultar.

**Después de la visita, pégame aquí (en el proyecto Campo):**
- esta tabla rellena;
- las 10 frases reales;
- el acta del bloque 1 y las fotos si las hay;
- capturas de cualquier error en el móvil.

Con eso decido el camino para conectar ChatGPT con Campo y cargo los primeros datos reales de Lobosillo.
