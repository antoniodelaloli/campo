# Campo · versión sencilla (para otra finca)

El mismo código que Campo, con lo básico: **tareas, fechas clave (agenda), diario de campo, libreta de ideas, avisos, el tiempo para fumigar y el conector para ChatGPT o Claude**. No tiene mapa dibujado, agua, tratamientos, cosecha ni cuentas: esas secciones llevan al inicio.

Cada finca va con **su propio Supabase** (del dueño de la finca) y **su propio proyecto de Vercel**, conectado a este mismo repositorio. Así sus datos no se mezclan nunca con los de la familia y los arreglos valen para las dos.

---

## 1. Supabase (lo crea el dueño de la finca)

1. Cuenta en supabase.com → organización nueva (plan **Free**) → **New project**, región en Europa. La contraseña de la base de datos se la guarda él.
2. **Team → Invite member**: invitar a Antonio con rol **Administrator**.
3. **SQL Editor** → pegar `supabase/sencilla/esquema.sql` completo → **Run** (una sola vez, en un proyecto vacío).
   Después, en otra consulta, `supabase/sencilla/permisos.sql`. **Imprescindible en proyectos nuevos:** Supabase ya no da permisos automáticos sobre las tablas y, sin esto, todos los usuarios se quedan en «pendiente de activación». Si el editor avisa de «tables without RLS», elegir **Run without RLS** (todas las tablas ya llevan sus políticas).
4. **Authentication → OAuth Server**: activarlo, *Authorization path* `/oauth/consent` y **Allow dynamic client registration** activado (para el conector).
5. **Authentication → URL Configuration**: *Site URL* = la dirección de su app en Vercel.
6. **Authentication → Users → Add user**: crear su usuario (correo y contraseña). Después, en el SQL Editor, activarlo:

   ```sql
   update public.profiles set activo = true, rol = 'admin', nombre = 'NOMBRE'
   where email = 'SU_CORREO';
   ```

7. Los datos de su finca (finca, zonas, personas, fechas clave de cada año) van en un `datos_inicial.sql` propio, sacado del resumen de su ChatGPT. **No** se guarda en este repositorio: es de él.

> El plan gratuito de Supabase pausa el proyecto tras una semana sin uso. El aviso diario (cron de Vercel) lo consulta cada mañana y lo mantiene despierto.

## 2. Vercel (en la cuenta de Antonio)

**Add New → Project** → importar `antoniodelaloli/campo` (rama `main`). Variables de entorno:

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_EDICION` | `sencilla` |
| `NEXT_PUBLIC_NOMBRE_APP` | nombre que sale arriba (p. ej. `El Olivar`) |
| `FINCAS_TIEMPO` | `Nombre de la finca:lat,lon` (varias con `;`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys (`sb_publishable_…`) |
| `SUPABASE_SECRET_KEY` | Project Settings → API Keys (`sb_secret_…`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | nuevas: `npx web-push generate-vapid-keys` |
| `VAPID_CONTACTO` | `mailto:antonio@delaloli.com` |
| `CRON_SECRET` | una cadena larga aleatoria nueva |

Las `NEXT_PUBLIC_…` se leen al compilar: si se cambian, hay que volver a desplegar.

## 3. Conector en su ChatGPT

Dirección: `https://<su-app>.vercel.app/api/mcp`. Mismos pasos que en `docs/conector-campo.md` (plan Plus o superior; modo desarrollador; autenticación OAuth; entrar con su usuario → **Permitir**).

Instrucciones para pegar en su ChatGPT (Ajustes → Personalización → Instrucciones personalizadas), cambiando `NOMBRE_APP`:

```
Llevo mi finca con la app NOMBRE_APP, que tienes conectada.

Cuando hable de la finca (tareas, riego, tratamientos, recogida, fechas, trabajadores, lo que ha pasado hoy):
1. Saca siempre la información del conector NOMBRE_APP. No contestes de memoria. Si algo no está, dime «eso no está apuntado».
2. Todo lo que tenga que quedar apuntado (tareas, recordatorios, fechas importantes, avisos, notas del diario) guárdalo en NOMBRE_APP con el conector. Nunca solo en tu memoria ni en tus propias tareas o recordatorios.
3. Recordatorios («recuérdame…»): si es algo importante del año, como fecha clave; si es del día a día, como tarea con la fecha de ese día.
4. Antes de apuntar, dime en una frase lo que vas a guardar y espera a que diga que sí. Menos las ideas, que las guardas directamente y me lo dices al final en una línea.
5. Si no sabes de qué sitio de la finca hablo, pregúntame.
6. Si el conector falla, dímelo claro y no lo guardes en otro sitio.

Háblame claro y corto, en español.
```

## 4. Mantenimiento

- Cuando haya una migración nueva en `supabase/migrations`: `python supabase/sencilla/generar.py` y aplicar en su Supabase **solo la migración nueva**, sin la parte de datos de la familia (el esquema completo es para la primera vez). Si una migración trae datos de las fincas de la familia, en su Supabase fallará o no hará nada: pasa solo lo que crea tablas, columnas o funciones.
- Un cambio en el código se despliega en las dos apps a la vez (vuestra y la suya). Si algo es solo de la familia, que dependa de `SENCILLA` (`src/lib/edicion.ts`).
