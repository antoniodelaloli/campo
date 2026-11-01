# Campo · Pruebas con el ChatGPT de Juan Carlos + hoja de ruta

Objetivo de la visita: saber **si su ChatGPT podrá apuntar datos en Campo** (tareas, notas, niveles de pantano, lecturas, riegos, tratamientos) y **cómo habla él** cuando apunta cosas. No hace falta que Campo esté publicado: todo se prueba con un GPT de prueba que no guarda nada.

Tiempo estimado: 30-40 minutos. Llévate el móvil cargado y este documento.

---

## 0. Antes de empezar (2 min)

- [ ] **Qué plan tiene de verdad.** En la app: Ajustes → Cuenta (o «Mejorar plan»).
  - Si paga **unos 20-23 €/mes, es ChatGPT Plus** (no «Pro»; Pro cuesta unos 200 €/mes). Con Plus se pueden crear GPTs propios con acciones, que es lo que necesitamos.
  - Si es **Go** (el más barato de pago, unos 8 €) o gratis, **no** puede crear GPTs con acciones: apúntalo y seguimos con el resto de pruebas.
- [ ] **Dónde lo usa:** ¿móvil, ordenador o los dos? ¿iPhone o Android?
- [ ] **Versión de la app:** Ajustes → Acerca de (apunta el número).
- [ ] **¿Usa la voz?** (el micrófono o el modo de conversación por voz).

> Importante: el GPT de prueba se crea **en su cuenta**, con él delante. No uses ni apuntes sus contraseñas.

---

## 1. Crear el GPT de prueba «Campo (prueba)» (10 min)

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

## 2. Pruebas (marca cada una)

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

## 3. Mirar sin tocar (3 min)

- [ ] Ajustes → **Aplicaciones / Conectores** → ¿aparece **«Modo desarrollador»** (en ajustes avanzados)? Solo mirar, **no activarlo**. (Es la otra vía, «MCP», que según las fuentes de 2026 solo funciona en la web).
- [ ] ¿Tiene activada la **Memoria** de ChatGPT? ¿Tiene conversaciones donde ya apunta cosas del campo («Archiva esto…»)? Pregúntale si quiere que más adelante pasemos ese historial a Campo.

---

## 4. Cómo habla él (lo más valioso, 10 min)

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

---

## 4 bis. Probar los «deberes» por voz (5 min)

Para comprobar si le resulta cómodo ir respondiendo preguntas en sus ratos libres:
- [ ] En su ChatGPT, nueva conversación. Pega esto y pulsa enviar:
  «Hazme estas 3 preguntas de una en una, esperando mi respuesta: 1) ¿Qué hay plantado en Lobosillo y cuántos árboles? 2) ¿Cuántos mandarinos hay en Los Olivos, 2.000 o 2.300? 3) ¿Qué marca es el programador de riego? Al final hazme un resumen con las respuestas.»
- [ ] Que conteste **por voz** (modo voz o el micrófono del teclado).
- [ ] ¿Le resulta cómodo? ¿El resumen final recoge bien lo que dijo?
- [ ] ¿Cómo prefiere mandarte el resumen? (WhatsApp, correo, compartir enlace del chat)

---

## 5. Resultado (rellenar al acabar)

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

**Con esto decidimos el camino:**
- **Acciones funcionan en su móvil** → vamos con el **GPT «Campo»** propio (camino principal).
- **Solo funcionan en ordenador** → GPT para el ordenador + en el móvil un botón «Apuntar» en la propia app de Campo (escribiendo o dictando).
- **No puede crear GPTs** (plan Go/gratis) → o sube a Plus, o se apunta desde la app de Campo y ChatGPT queda para consultar.

---

## 6. Hoja de ruta

### Fase 0 · Visita (esta prueba)
Saber qué funciona en su ChatGPT y cómo habla. Borrar el GPT de prueba al final o dejarlo para jugar (no guarda nada).

### Fase 1 · Poner Campo en marcha de verdad
- Darle a Claude acceso al proyecto de Supabase (invitar tu cuenta habitual a la organización de Campo).
- Ejecutar las migraciones pendientes (`pendiente_0004.sql` y, si se quiere, `demo_fechas_clave.sql`) y comprobar la app contra los datos reales. (0002 y 0003: aplicadas el 31/10.)
- Publicar la app: repositorio **privado** en GitHub + **Vercel**. Así tiene dirección pública (necesaria para ChatGPT) y la podéis abrir en el móvil sin tu PC.
- Bienvenida «¡Hola, Carlos!» en la app (con el nombre de quien entra).

### Fase 1 bis · «Deberes» de Juan Carlos (datos que solo él sabe)
Para llenar los huecos (distribución de Lobosillo, nº de árboles, superficies, marcas, contadores…) sin quitarle tiempo:
1. **Banco de preguntas** (`preguntas-campo.md`): Claude lo genera a partir de todo lo que está «por confirmar». Cada pregunta lleva un código (p. ej. `LOB-01`), lo que ya creemos («¿2.000 o 2.300 mandarinos?»), qué tipo de respuesta se espera (número, sí/no, foto) y prioridad. En bloques de 5 preguntas (5-10 min).
2. **GPT «Campo · Preguntas»** en su ChatGPT, con el banco de preguntas como archivo: le pregunta **de una en una, por voz**, acepta «no lo sé», «más o menos» o «pregúntale a Pencho», pide unidades cuando hay números y admite fotos (planos, placas, contadores).
3. **Al terminar**, el GPT le da un **acta** con formato fijo (código, respuesta, seguridad: seguro/aproximado/no sé, fecha). Él te la manda por WhatsApp o correo. Más adelante (fase 3) se guarda sola en Campo como «pendiente de revisar».
4. **Tú pegas el acta a Claude** en el proyecto Campo → Claude actualiza `campo-contexto-fincas.md`, marca las preguntas respondidas, señala contradicciones como «pendiente de conciliar» (no sobrescribe) y genera un `datos_000N.sql` repetible.
5. **Ejecutas ese SQL en Supabase** (o lo hace Claude si tiene acceso) y los datos aparecen en la app sin tocar código. Claude prepara el siguiente bloque de preguntas, incluidas las repreguntas.

### Fase 1 ter · Fechas clave y recordatorios
Objetivo: que Carlos vea **al entrar** qué viene y en cuánto tiempo, y que **el móvil le avise** (no el correo, que no lo lee). Necesita la app publicada (fase 1): las notificaciones solo funcionan con dirección https, no desde `localhost` en el móvil.

> **Hecho (31/10/2026):** puntos 1 a 3 en local.
> - **Fechas clave ≠ tareas.** Fechas clave: lo importante de la campaña (cortes, plazos, tratamientos), pocas y casi las mismas cada año; en la sección «Agenda» del menú (`/calendario`) y en el panel «Fechas clave» del inicio. Tareas: el día a día, solo en Tareas.
> - Una tarea puede **colgar de una fecha clave** (migración `0004_tareas_de_fecha_clave.sql`): la fecha clave muestra «1 de 3 tareas» y la tarea, de qué fecha clave es.
> - **Línea de la campaña** (octubre → septiembre) arriba de la Agenda: hoy, fechas clave por tipo, hechas en gris, aproximadas difuminadas.
> - SQL: `0003_hitos.sql` + `datos_0003.sql` (aplicados el 31/10) y `pendiente_0004.sql`.
> Pendiente: notificaciones (punto 4, tras publicar), Google Calendar, ChatGPT y repaso de los lunes.

1. **Fechas clave en Campo** (tabla `hitos`, migración `0003_hitos.sql`): finca (opcional), tipo (corte/cosecha, tratamiento, plazo de papeles —CHS, desaladora, seguros, contratos—, agua/riego, compra, otro), título, fecha (y hora si la hay), cuándo avisar (por defecto **7 días antes, el día antes y el mismo día**, se puede cambiar), repetir cada año (opcional) y estado (pendiente / hecho / anulado; nada se borra).
2. **Hitos que salen solos** (calculados, no se apuntan a mano):
   - «No cortar antes de…» = fecha del tratamiento + plazo de seguridad del producto. Si el plazo no está confirmado, sale como «plazo sin confirmar» en vez de inventarlo.
   - Tareas con fecha prevista.
   - Fechas de los contratos de cosecha (cuando entren en la base de datos, fase 4).
3. **Al entrar en la app:** franja «Lo que viene» en el inicio y en la bienvenida (próximos 14 días, con cuenta atrás: «faltan 3 días», «mañana», «hoy»; lo pasado sin hacer, en rojo). Página **Calendario** con vista de mes y lista. Crear un hito con una frase («cortar Corvera el 15 de diciembre»), con el mismo intérprete que ya usan las tareas.
4. **Notificaciones en el móvil (PWA):**
   - Campo se instala como app (icono en la pantalla de inicio) y tiene un botón **«Avisarme en este móvil»**. Cada móvil queda apuntado a nombre de su usuario.
   - **iPhone:** hay que abrir Campo en **Safari → Compartir → «Añadir a pantalla de inicio»** y abrirla desde ese icono (iOS 16.4 o posterior). **Android:** funciona desde Chrome; mejor instalada también.
   - **Aviso diario a las ~8:00** con lo de hoy y lo que toca recordar; los **lunes, repaso de la semana**. Con Vercel gratis basta (cron una vez al día, con margen de hasta una hora). Si algún día hacen falta avisos a una hora exacta, se programa en Supabase (`pg_cron`) cada 15 minutos.
   - Al tocar el aviso se abre el hito. En Android, botones «Hecho» y «Mañana» en el propio aviso.
   - Hacen falta: claves VAPID, librería `web-push`, service worker y tabla de suscripciones (guía oficial de Next.js para PWA).
5. **Google Calendar (para quien lo use: tú, tu hermano):** enlace privado de calendario (`.ics`) para suscribirse desde Google Calendar o el calendario del iPhone. Es de solo lectura y Google lo refresca cada 12-24 h, así que sirve **para ver**, no para avisar. Si más adelante lo queréis al momento y con los recordatorios de Google, Campo puede escribir los hitos en el calendario compartido «CAMPO» con la API de Google.
6. **ChatGPT (fases 2 y 3):** «¿qué tengo esta semana?» (consulta) y «apúntame que el 15 de diciembre cortamos en Corvera» (crear hito, con confirmación).
7. **Repaso de los lunes con Claude (para ti, no para Carlos):** cuando Claude tenga acceso a Supabase, una tarea programada los lunes por la mañana revisa hitos, tareas, avisos y pantanos, te dice lo que viene y lo atrasado, y propone hitos que falten (plazos que aparezcan en documentos o en las actas de Carlos). A Carlos le llega el aviso de la propia app.
8. **Deberes:** añadir al banco de preguntas un bloque **«Fechas del año»**: cuándo se corta cada finca y variedad, abonados, podas, plazos de papeles, revisiones (contadores, atomizador). Con sus respuestas se crean los hitos que se repiten cada año.

**Para la visita:** ¿iPhone o Android y qué versión del sistema? ¿Qué le gustaría que le recordara, con cuánta antelación y a qué hora le viene bien el aviso?

### Fase 1 quater · Fincas dibujadas a imagen y semejanza
> **Hecho (31/10/2026):** Corvera, Valladolises (trozo de la casa, con pista de tenis y piscina) y Lobosillo (con pista de fútbol) redibujadas sobre capturas de Google Earth; vista 3D tipo dron en escritorio. Pendiente: confirmar la superficie de Corvera (¿35 o 22 ha?), la posición de sus sectores y la casa de Lobosillo; dibujar el resto de zonas de Valladolises en su módulo.

Pendiente de Antonio (hecho): pasar vistas aéreas de las tres fincas para que Claude redibuje cada una en el mapa (mismo estilo pixel 2D, pero con la forma y distribución reales).

Qué mandar (pegar en el proyecto Campo):
- Una captura por finca en vista satélite (Google Maps/Earth o foto de dron), con el norte arriba y lo bastante cerca para distinguir filas de árboles; si se puede, con la regla de escala visible.
- Una captura de las tres juntas, para las posiciones relativas.
- Sobre la imagen o en un mensaje: dónde están la casa, la caseta del cabezal, los pantanos, la piscina, las entradas y caminos, y los nombres de cada trozo (La Casa, Los Olivos, Abajo, Del Pozo, Triviño, La Mari; rectángulo grande y parcela del panadero en Corvera; lo que haya en Lobosillo).
- Fotos de dron, si las hay, mejor todavía.

Qué hace Claude con eso: redibujar Corvera, Valladolises y Lobosillo (contorno, orientación de las filas, caminos, pantanos y edificios en su sitio), ajustar sus superficies y los planos de cada finca (`PlanoFinca`), y comprobar que todo cuadra con las zonas y sectores de la base de datos.

### Fase 2 · Consultar desde ChatGPT
- Migración 0005: claves personales (una por persona, revocable, ligada a su usuario).
- Acciones de **consulta**: resumen del día, tareas, pantanos, avisos, buscar un sitio («Los Nuevos», «sector 2 de Corvera»).
- GPT **«Campo»** en su cuenta (privado), con instrucciones y frases reales de la visita.

### Fase 3 · Apuntar desde ChatGPT
- Acciones de **escritura**: crear y completar tareas, nota del diario, nivel de pantano, lectura de contador, riego, tratamiento, incidencia.
- Acción `guardar_respuesta` para los «deberes»: sus respuestas entran directamente en Campo como «pendientes de revisar» (sin pasar por WhatsApp).
- Siempre con confirmación; todo queda marcado «desde ChatGPT» y a su nombre; nada se borra (se puede anular lo último).
- Si algo es ambiguo («finca 4»), Campo devuelve opciones y ChatGPT pregunta.
- Prueba real con él durante una semana.

### Fase 4 · Mejoras
- Foto del contador → lectura apuntada.
- Cosecha y liquidaciones en la base de datos (migración 0006). Ya hay KPIs y pestaña de estimación 2026/27 en Cosecha con datos de documentos; faltan los albaranes (hoja de Valladolises 25/26 analizada) y los costes reales (agua, abono, tratamientos: hay uno de 16.131 € de julio de 2022).
- **Parte del día** (como la hoja «control AGUA» de 2022): contadores propio y de la Comunidad, cupo restante, riego por sector, trabajos, incidencias y tiempo en una pantalla; aviso si los dos contadores se separan.
- Copias de seguridad automáticas.
- Otros usuarios (tu hermano para Lobosillo, quizá Pencho para avisar de tareas).
- **Easter egg «Campo Tenis»:** si se toca 3 veces seguidas la pista de tenis de Valladolises en el mapa, se abre a pantalla completa la escena del partido (diseño «Easter egg · tenis v2» y vídeo `docs/disenos/campo-tenis-easter-egg-v2.mp4`). Se juega **un solo punto**, sin controles (puro NPC): peloteo entre Juan Carlos y el atomizador, con el limón como pelota, y **gana Juan Carlos** («¡Punto para Juan Carlos!» y vuelta al mapa). Con sonido (brisa, golpes, botes y el «pssst» del atomizador), que se pueda silenciar; respetar «reducir movimiento»; botón «Volver al trabajo» siempre visible. Hecho con la misma escena en HTML/SVG animada (no hace falta incrustar el vídeo).
