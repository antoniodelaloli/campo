# Campo · Conector para ChatGPT y Claude

Con el conector, ChatGPT o Claude pueden **consultar y apuntar en Campo** desde la propia conversación (por voz o escribiendo), con el usuario y los permisos de cada persona. No hace falta abrir la web.

- Dirección del conector: **`https://campo-lac.vercel.app/api/mcp`**
- Inicio de sesión: el de Campo (correo y contraseña), **una sola vez** al conectar. Después se pulsa «Permitir».
- Todo lo que se apunta queda a nombre de quien conectó y marcado «desde el asistente» (`origen = conector`). Nada se borra.

> **Por qué conector y no un GPT:** OpenAI retira los GPT personalizados y sus «acciones» el **11 de diciembre de 2026**. Los sustituye por apps/plugins con conectores (MCP), que es justo lo que usa también Claude. Un único conector sirve para los dos.

---

## Antes de nada (una vez, ya preparado por Antonio)

1. Supabase → Authentication → **OAuth Server**: activado, *Authorization path* `/oauth/consent` y **Allow dynamic client registration** activado.
2. Migración `supabase/migrations/0006_conector.sql` aplicada (permite el origen «conector»).
3. App publicada en Vercel con los cambios.

---

## Conectarlo en ChatGPT

Requisitos: plan **Plus o superior** (el gratuito no admite conectores propios). Según OpenAI, de momento **solo funciona en la web** (chatgpt.com) y en la app de escritorio, no en la app del móvil.

Los menús cambian a menudo; aproximadamente:
1. En chatgpt.com: **Ajustes → Apps (o Aplicaciones y conectores) → Avanzado → Modo desarrollador** → activar.
2. **Crear app / Añadir conector propio**:
   - Nombre: `Campo`
   - Descripción: `Las fincas de la familia: fechas clave, tareas, agua y tratamientos`
   - URL del servidor MCP: `https://campo-lac.vercel.app/api/mcp`
   - Autenticación: **OAuth** (sin rellenar nada más: se registra solo).
   - Marcar «Confío en esta aplicación» y **Crear**.
3. Se abre una ventana de Campo: entrar con el usuario de Campo → **Permitir**.
4. En una conversación nueva: botón **+** → **Modo desarrollador / Campo** para activarlo en ese chat.
5. Cuando vaya a apuntar algo, ChatGPT pedirá confirmación (está bien: es la seguridad).

## Conectarlo en Claude

Vale en cualquier plan (el gratuito admite un conector propio) y funciona también en la **app del móvil** una vez añadido.
1. En claude.ai: **Ajustes → Conectores → Añadir conector personalizado**.
2. Nombre `Campo`, URL `https://campo-lac.vercel.app/api/mcp` → **Añadir**.
3. **Conectar** → entrar con el usuario de Campo → **Permitir**.
4. En el chat, activar «Campo» en el menú de herramientas si no lo está.

---

## Qué se le puede pedir (frases de prueba)

**Consultar**
- «¿Qué tengo hoy en el campo?» / «¿Qué fechas clave vienen este mes?»
- «¿Cuánta agua queda en el pantano de Corvera?»
- «¿Qué tareas hay pendientes en Valladolises?»
- «¿Cuándo se fumigó Corvera la última vez y con qué?»
- «¿Qué día de esta semana se puede fumigar en Valladolises?» / «¿Va a granizar?»

**Apuntar** (siempre confirma antes)
- «Apunta que hay que limpiar los filtros de Corvera el jueves.»
- «El pantano de Valladolises está a la mitad.»
- 📷 Foto del contador + «apunta esta lectura del contador del trasvase de Valladolises». El asistente lee el número de la foto y lo confirma. Si es menor que la lectura anterior, avisa por si está mal leído.
- «Apunta como fecha clave el primer corte de Corvera hacia el 15 de diciembre.»
- «Ya está hecha la fecha clave del precio de referencia.»
- «Hay una fuga en el sector 2 de Corvera.»
- «Apunta en el diario: ha venido Diego y dice que hay algo de cotonet en Valladolises.»
- «Apunta una idea: en Lobosillo plantaría almendros en la parte de arriba.» / «¿Qué ideas tenía yo sobre el riego?»
- «Vamos con las preguntas de Antonio, bloque 1.» → hace las preguntas de una en una y guarda cada respuesta en Campo al momento («✅ Guardada»). «Seguimos con las preguntas» → mira cuáles faltan.

> La foto en sí no se guarda en Campo (al conector solo le llega el número). Guardar la foto será una mejora futura.

## Herramientas del conector

| Consultar | Apuntar |
|---|---|
| `resumen_del_dia` | `crear_tarea` |
| `fechas_clave` | `cambiar_estado_tarea` |
| `tareas` | `apuntar_nivel_pantano` |
| `agua` | `apuntar_lectura_contador` |
| `tratamientos` | `crear_fecha_clave` / `marcar_fecha_clave` |
| `buscar_lugar` | `apuntar_incidencia` / `nota_diario` |
| `buscar_ideas` | `apuntar_idea` (libreta de ideas y reflexiones) |
| `tiempo_para_fumigar` (viento y granizo, 6 días) | `guardar_respuesta` (banco de preguntas) |
| `preguntas_contestadas` | |

Un usuario **lector** solo puede consultar; uno **editor** puede apuntar.

## Si algo falla
- «No se pudo conectar» o la ventana no abre: comprobar el paso «Antes de nada».
- «Tu usuario de Campo aún no está activado»: activarlo en Supabase (`profiles.activo`).
- Para desconectar: en ChatGPT o Claude, quitar el conector. Los permisos dados se pueden revisar en Supabase → Authentication → OAuth Server.

---

## Instrucciones para pegar en ChatGPT y Claude (cuenta de Juan Carlos)

Dónde pegarlas:
- **ChatGPT:** Ajustes → Personalización → **Instrucciones personalizadas** → campo «¿Cómo quieres que responda ChatGPT?» (o «Más sobre ti»).
- **Claude:** Ajustes → Perfil → **Preferencias personales** («¿Qué preferencias personales debería tener en cuenta Claude?»).

```
Llevo las fincas de limoneros de la familia (Valladolises, Corvera y Lobosillo, en Murcia) con la app Campo, que tienes conectada como «Campo».

Cuando hable del campo (fincas, tareas, riego, agua, pantanos, contadores, tratamientos, cosecha, fechas, trabajadores):
1. Saca siempre la información del conector Campo. No contestes de memoria ni con lo de otras conversaciones. Si algo no está en Campo, dime «eso no está apuntado».
2. Todo lo que tenga que quedar apuntado (tareas, recordatorios, fechas importantes, niveles de pantano, lecturas de contadores, avisos, notas) guárdalo en Campo con el conector. Nunca lo guardes solo en tu memoria ni en tus propias tareas, recordatorios o notas.
3. Recordatorios («recuérdame…»): si es algo importante de la campaña (cortar, fumigar, un plazo, pagar), apúntalo como fecha clave; si es otra cosa, como tarea con la fecha de ese día. Campo me lo recuerda en el móvil esa mañana.
4. Si te mando la foto de un contador, lee el número y apúntalo como lectura de ese contador.
5. Antes de apuntar, dime en una frase lo que vas a guardar y espera a que diga que sí. Menos las ideas (punto 7), que las guardas directamente.
6. Si no sabes qué finca o sitio es, pregúntame.
7. A veces divago: estate atento. Si suelto una idea, reflexión, duda o plan sobre el campo que merezca la pena recordar (no una tarea ni algo con fecha), guárdala tú en la libreta de ideas de Campo sin preguntarme, con un resumen corto y lo que dije completo, y dímelo al final en una línea («📝 Apuntado en ideas: …»). Solo lo del campo, nada personal.
8. Si el conector falla, dímelo claro y no lo guardes en otro sitio: ya lo apuntaré después.

Háblame claro y corto, en español, que lo uso mucho por voz.
```
