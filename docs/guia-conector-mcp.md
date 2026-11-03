# Guía: conector MCP para ChatGPT y Claude con Next.js + Supabase

Así se hizo el conector de **Campo**: una app Next.js que, además de la web, expone un servidor **MCP** en `/api/mcp`. ChatGPT y Claude se conectan a él. El usuario inicia sesión con su cuenta de la app a través de **OAuth 2.1 de Supabase**, y todo lo que hace el asistente pasa por **RLS** con los permisos de ese usuario.

Esta guía está pensada para pasársela a otro Claude que vaya a montar lo mismo en otro proyecto. Los nombres propios de Campo (fincas, tareas, `profiles.rol`…) son ejemplos: hay que cambiarlos por los del proyecto nuevo.

---

## 1. Idea general

```
ChatGPT / Claude ──(1) POST /api/mcp sin token──▶ 401 + WWW-Authenticate (dónde están los metadatos)
                 ──(2) GET /.well-known/oauth-protected-resource/api/mcp ──▶ "el servidor de auth es Supabase"
                 ──(3) registro dinámico + login OAuth en Supabase ──▶ Supabase redirige a /oauth/consent de la app
                       (el usuario entra con su cuenta y pulsa «Permitir»)
                 ──(4) POST /api/mcp con Bearer <JWT de Supabase> ──▶ herramientas MCP, ejecutadas como ese usuario (RLS)
```

- **Sin estado.** Cada petición crea su `McpServer` con el usuario del token. No hay sesiones MCP guardadas, y por eso funciona bien en Vercel (serverless).
- **El token es un JWT de Supabase.** Se crea un cliente de Supabase con ese token en la cabecera `Authorization`, y así RLS se aplica exactamente igual que en la web.
- **Sin claves en el asistente.** Nadie pega API keys: el asistente se registra solo (registro dinámico de clientes) y el usuario da permiso una vez.
- **Por qué MCP y no un GPT personalizado con «acciones».** OpenAI retira los GPT personalizados y sus acciones el 11/12/2026. Los conectores MCP son el sustituto y sirven también para Claude: un solo conector vale para los dos.

## 2. Requisitos

- Next.js con App Router. Campo usa la 16, con `src/proxy.ts`, el antiguo middleware.
- Supabase con Auth y RLS. Proyecto en Vercel con dominio público. **Ojo:** el dominio de producción no puede tener la «Vercel Authentication» activa; ver los fallos típicos.
- Paquetes:
  ```bash
  npm i @modelcontextprotocol/sdk zod @supabase/supabase-js @supabase/ssr
  ```
  Versiones usadas en Campo: `@modelcontextprotocol/sdk` 1.32.x, `zod` 4.x y `@supabase/supabase-js` 2.118 (necesita `auth.getClaims` y `auth.oauth.*`).
- Variables de entorno, las mismas que la web: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. El conector **no** usa la clave secreta.

## 3. Configuración en Supabase (una vez)

1. **Authentication → OAuth Server:**
   - activar el servidor OAuth;
   - *Authorization path*: `/oauth/consent`;
   - activar **Allow dynamic client registration**.
2. **Authentication → URL Configuration → Site URL:** el dominio público de producción, por ejemplo `https://mi-app.vercel.app`. Supabase construye con esta URL la dirección de la pantalla de consentimiento. Si apunta a un dominio protegido de Vercel, el usuario verá un login de Vercel en vez del de la app.
3. Si las tablas tienen una columna `origen` con un `check`, hay que añadir un valor nuevo como `'conector'` para marcar lo que apunta el asistente. Es opcional, pero muy útil para auditar.

## 4. Archivos

| Archivo | Para qué |
|---|---|
| `src/lib/mcp/auth.ts` | Valida el token y crea el cliente de Supabase del usuario. También construye el 401 con `WWW-Authenticate`. |
| `src/app/api/mcp/route.ts` | El endpoint MCP (POST/GET/DELETE/OPTIONS), sin estado, con CORS. |
| `src/app/.well-known/oauth-protected-resource/[[...ruta]]/route.ts` | Metadatos RFC 9728: «para este recurso, el servidor de auth es Supabase». |
| `src/app/oauth/consent/page.tsx` + `actions.ts` | La pantalla «¿Permitir que ChatGPT use la app con tu usuario?». |
| `src/lib/mcp/herramientas.ts` | Instrucciones y herramientas (`registerTool`). |
| `src/proxy.ts` | Excluir `/api/mcp` y `/.well-known` del middleware de sesión. |
| `src/lib/supabase/proxy.ts` + login | Al pedir login, recordar adónde iba (`?siguiente=`) para volver a la pantalla de consentimiento. |

### 4.1 `src/lib/mcp/auth.ts`

```ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Comprobación del token que manda ChatGPT o Claude al conector.
// El token lo emite el servidor OAuth de Supabase al iniciar sesión el usuario:
// es un JWT de Supabase con su user_id y el client_id del asistente.
// Con él se crea un cliente de Supabase «como ese usuario»: RLS se aplica igual
// que en la app.

export type ContextoAgente = {
  supabase: SupabaseClient;
  userId: string;
  nombre: string;
  puedeEditar: boolean;
};

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CLAVE_PUBLICA = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Emisor de los tokens (servidor de autorización). */
export const EMISOR = `${URL_SUPABASE.replace(/\/$/, "")}/auth/v1`;

/** Dirección pública del conector y de sus metadatos, según la petición. */
export function direcciones(request: Request) {
  const u = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? u.host;
  const proto = request.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const base = `${proto}://${host}`;
  return {
    recurso: `${base}/api/mcp`,
    metadatos: `${base}/.well-known/oauth-protected-resource/api/mcp`,
  };
}

/** 401 con la pista para que el asistente sepa dónde iniciar sesión. */
export function noAutorizado(request: Request, motivo: string) {
  const { metadatos } = direcciones(request);
  return Response.json(
    { error: "unauthorized", error_description: motivo },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${metadatos}", scope="openid email profile"`,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}

/** Valida el token y devuelve el cliente del usuario, o una respuesta 401/403. */
export async function contextoAgente(request: Request): Promise<ContextoAgente | Response> {
  const cabecera = request.headers.get("authorization") ?? "";
  const token = cabecera.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return noAutorizado(request, "Falta iniciar sesión.");

  const supabase = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims as (Record<string, unknown> & { sub?: string; iss?: string }) | undefined;
  if (error || !claims?.sub) return noAutorizado(request, "La sesión no es válida o ha caducado.");
  if (claims.iss !== EMISOR) return noAutorizado(request, "Token de otro servidor.");
  // Solo tokens emitidos para un asistente (no la sesión normal de la web)
  if (typeof claims.client_id !== "string" || !claims.client_id) {
    return noAutorizado(request, "Este token no es de un asistente conectado.");
  }

  // ADAPTAR: tabla de perfiles y roles del proyecto
  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nombre, rol, activo")
    .eq("id", claims.sub)
    .maybeSingle<{ id: string; nombre: string | null; rol: string; activo: boolean }>();
  if (!perfil?.activo) {
    return Response.json(
      { error: "forbidden", error_description: "Tu usuario aún no está activado." },
      { status: 403 },
    );
  }

  return {
    supabase,
    userId: perfil.id,
    nombre: perfil.nombre ?? "",
    puedeEditar: perfil.rol === "admin" || perfil.rol === "editor",
  };
}
```

### 4.2 `src/app/api/mcp/route.ts`

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { contextoAgente } from "@/lib/mcp/auth";
import { INSTRUCCIONES, registrarHerramientas } from "@/lib/mcp/herramientas";

// Conector MCP para ChatGPT y Claude.
// Dirección para añadirlo: https://<la-app>/api/mcp
// Sin estado: cada petición crea su servidor, con el usuario del token.

export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

function conCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function atender(request: Request) {
  const ctx = await contextoAgente(request);
  if (ctx instanceof Response) return conCors(ctx);

  // ADAPTAR: nombre y título del servidor
  const server = new McpServer({ name: "campo", title: "Campo · fincas", version: "1.0.0" }, { instructions: INSTRUCCIONES });
  registrarHerramientas(server, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // sin estado
    enableJsonResponse: true,      // respuestas JSON normales, sin streaming SSE
  });
  try {
    await server.connect(transport);
    return conCors(await transport.handleRequest(request));
  } catch (e) {
    console.error("[mcp]", e);
    return conCors(
      Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null },
        { status: 500 },
      ),
    );
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

export const POST = atender;
export const GET = atender;
export const DELETE = atender;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
```

### 4.3 `src/app/.well-known/oauth-protected-resource/[[...ruta]]/route.ts`

Responde tanto en `/.well-known/oauth-protected-resource` como en `/.well-known/oauth-protected-resource/api/mcp`, porque cada cliente prueba una de las dos rutas.

```ts
import { direcciones, EMISOR } from "@/lib/mcp/auth";

// Metadatos del recurso protegido (RFC 9728): le dicen a ChatGPT o Claude
// que el conector /api/mcp se usa con el inicio de sesión de Supabase.

export async function GET(request: Request, { params }: { params: Promise<{ ruta?: string[] }> }) {
  const { ruta } = await params;
  const camino = (ruta ?? []).join("/");
  if (camino && camino !== "api/mcp") return Response.json({ error: "not_found" }, { status: 404 });

  const { recurso } = direcciones(request);
  return Response.json(
    {
      resource: recurso,
      authorization_servers: [EMISOR],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_name: "Campo · fincas", // ADAPTAR
      resource_documentation: recurso.replace(/\/api\/mcp$/, "/"),
    },
    { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=3600" } },
  );
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
```

### 4.4 Pantalla de consentimiento: `src/app/oauth/consent/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server"; // cliente de servidor normal (@supabase/ssr, con cookies)

// Permitir o rechazar que ChatGPT o Claude usen la app con tu usuario.

async function decidir(formData: FormData, permitir: boolean) {
  const id = String(formData.get("authorization_id") ?? "");
  if (!id) redirect("/");
  const supabase = await createClient();
  const { data, error } = permitir
    ? await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true })
    : await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) {
    redirect(`/oauth/consent?authorization_id=${encodeURIComponent(id)}&error=${encodeURIComponent(error?.message ?? "sin respuesta")}`);
  }
  redirect(data.redirect_url);
}

export async function permitir(formData: FormData) {
  await decidir(formData, true);
}

export async function rechazar(formData: FormData) {
  await decidir(formData, false);
}
```

### 4.5 `src/app/oauth/consent/page.tsx` (lo esencial; el diseño es de cada app)

```tsx
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { permitir, rechazar } from "./actions";

export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <main>
      <Suspense fallback={<p>Cargando…</p>}>
        <Consentimiento searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Consentimiento({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const sp = await searchParams;
  const id = typeof sp.authorization_id === "string" ? sp.authorization_id : "";
  const errorPrevio = typeof sp.error === "string" ? sp.error : null;
  if (!id) return <p>Falta la solicitud. Vuelve a ChatGPT o Claude y pulsa otra vez «Conectar».</p>;

  // El proxy ya obliga a iniciar sesión antes de llegar aquí
  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <p>La solicitud ha caducado o no es válida ({error?.message}).</p>;

  // Ya se dio permiso antes: vuelve directamente al asistente
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const asistente = data.client?.name ?? "Un asistente";
  return (
    <section>
      <h1>Conectar con {asistente}</h1>
      <p>{asistente} quiere usar la app con tu usuario ({data.user.email}). Podrá consultar y apuntar con tus permisos.</p>
      {errorPrevio && <p role="alert">No se pudo completar: {errorPrevio}</p>}
      <form action={rechazar}>
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button type="submit">No permitir</button>
      </form>
      <form action={permitir}>
        <input type="hidden" name="authorization_id" value={data.authorization_id} />
        <button type="submit">Permitir</button>
      </form>
    </section>
  );
}
```

### 4.6 `src/proxy.ts`: excluir el conector del middleware de sesión

El middleware de la web redirige a `/login` si no hay cookie de sesión. El conector va con su propio token, así que **hay que excluirlo**. Si no se excluye, ChatGPT recibe un 307 a `/login` en vez del 401 y no sabe iniciar sesión.

```ts
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
```

### 4.7 Volver a la pantalla de consentimiento después del login

Supabase manda al usuario a `/oauth/consent?authorization_id=…`. Si no tiene sesión, el middleware lo lleva a `/login`, y **después del login tiene que volver** a esa misma URL con su `authorization_id`.

En `src/lib/supabase/proxy.ts`, dentro de `updateSession`, cuando no está autenticado:
```ts
if (!autenticado && !esLogin) {
  const url = request.nextUrl.clone();
  const destino = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = destino !== "/" ? `?siguiente=${encodeURIComponent(destino)}` : "";
  return NextResponse.redirect(url);
}
if (autenticado && esLogin) {
  return NextResponse.redirect(new URL(destinoSeguro(request.nextUrl.searchParams.get("siguiente")), request.url));
}

/** Solo rutas internas de la app (evita redirecciones a otras webs). */
export function destinoSeguro(siguiente: string | null | undefined) {
  if (!siguiente || !siguiente.startsWith("/") || siguiente.startsWith("//") || siguiente.startsWith("/\\")) return "/";
  return siguiente;
}
```
En la página de login, un `<input type="hidden" name="siguiente">` con el valor de `?siguiente=`. En la acción de login, después del `signInWithPassword`: `redirect(destinoSeguro(String(formData.get("siguiente") ?? "")))`.

### 4.8 `src/lib/mcp/herramientas.ts`: el patrón

```ts
import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ContextoAgente } from "@/lib/mcp/auth";

const ORIGEN = "conector"; // se guarda en la columna origen de lo que apunta el asistente

// Lo que el asistente lee nada más conectarse: cómo comportarse con estas herramientas
export const INSTRUCCIONES = `La app X es … Cómo usar estas herramientas:
- Habla en español, claro y breve.
- Para saber qué pasa hoy, empieza por «resumen_del_dia».
- ANTES de apuntar nada, repite en una frase lo que vas a guardar y espera a que diga que sí.
- No inventes datos: si algo no está en la app, dilo.
- Nada se borra: si algo está mal, se marca como anulado.`;

type Resultado = { content: { type: "text"; text: string }[]; isError?: boolean };
const ok = (datos: unknown): Resultado => ({
  content: [{ type: "text", text: typeof datos === "string" ? datos : JSON.stringify(datos, null, 1) }],
});
const fallo = (mensaje: string): Resultado => ({ content: [{ type: "text", text: mensaje }], isError: true });

// Pistas para el asistente: ChatGPT pide confirmación en las de escritura
const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const ESCRITURA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

function sinPermiso(ctx: ContextoAgente): Resultado | null {
  return ctx.puedeEditar ? null : fallo("Tu usuario solo puede consultar, no apuntar.");
}

export function registrarHerramientas(server: McpServer, ctx: ContextoAgente) {
  const { supabase } = ctx;

  // --- Consulta ---
  server.registerTool(
    "tareas",
    {
      title: "Tareas",
      description: "Tareas abiertas con estado, fecha y lugar. Úsala para «¿qué hay pendiente?».",
      inputSchema: { limite: z.number().int().min(1).max(50).default(15) },
      annotations: LECTURA,
    },
    async ({ limite }) => {
      const { data, error } = await supabase
        .from("tareas")
        .select("id, titulo, estado, fecha_prevista")
        .in("estado", ["prevista", "en_curso"])
        .order("fecha_prevista", { ascending: true, nullsFirst: false })
        .limit(limite);
      if (error) return fallo(`No se pudieron leer las tareas: ${error.message}`);
      return ok(data);
    },
  );

  // --- Escritura ---
  server.registerTool(
    "crear_tarea",
    {
      title: "Apuntar una tarea",
      description: "Apunta una tarea nueva. Antes, dile en una frase lo que vas a guardar y espera a que diga que sí.",
      inputSchema: {
        titulo: z.string().min(3).max(200),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("AAAA-MM-DD"),
      },
      annotations: ESCRITURA,
    },
    async ({ titulo, fecha }) => {
      const p = sinPermiso(ctx);
      if (p) return p;
      const { data, error } = await supabase
        .from("tareas")
        .insert({ titulo, fecha_prevista: fecha ?? null, estado: "prevista", origen: ORIGEN })
        .select("id")
        .single();
      if (error) return fallo(`No se pudo guardar: ${error.message}`);
      return ok({ guardado: true, id: data.id, mensaje: `Tarea apuntada: «${titulo}».` });
    },
  );
}
```

Consejos para las herramientas:
- **Las descripciones son el manual del asistente.** Hay que decir cuándo usar cada herramienta, con frases de ejemplo de cómo habla el usuario.
- **Devolver datos ya masticados:** nombres en vez de ids, la fecha de «hoy» y textos como «faltan 3 días». El modelo se equivoca menos.
- **Errores en lenguaje humano**, con `isError: true`. El asistente se los lee al usuario.
- **Antes de guardar:** si un sitio es ambiguo, devolver «¿cuál de estos?» en vez de adivinar. Para lecturas raras (un contador que baja), pedir un `confirmar: true`.
- **Nada de borrar.** Mejor marcar como anulado. Y RLS sigue mandando: si el usuario es lector, el insert falla igualmente.

## 5. Probarlo

1. **Sin token** tiene que dar 401 con la cabecera `WWW-Authenticate`:
   ```bash
   curl -i -X POST https://mi-app.vercel.app/api/mcp -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```
2. **Metadatos:**
   ```bash
   curl https://mi-app.vercel.app/.well-known/oauth-protected-resource/api/mcp
   ```
   Tiene que mostrar `authorization_servers: ["https://<proyecto>.supabase.co/auth/v1"]`.
3. **Inspector de MCP:** `npx @modelcontextprotocol/inspector`, con la URL `https://mi-app.vercel.app/api/mcp` y transporte Streamable HTTP. Hace el OAuth completo y deja llamar a las herramientas.
4. **En Claude** (claude.ai → Ajustes → Conectores → Añadir conector personalizado): poner la URL → Conectar → login → Permitir. Funciona en el plan gratuito y, una vez añadido, también en el móvil.
5. **En ChatGPT** (plan Plus o superior):
   - Ajustes → Aplicaciones/Conectores → Avanzado → **Modo desarrollador**.
   - Crear o añadir un servidor MCP con la URL y autenticación **OAuth** (sin rellenar nada más).
   - En cada chat se activa con **+** o mencionando **@NombreDelConector**.
   - Al cambiar las herramientas, hay que darle a «Actualizar» en el conector.

## 6. Fallos típicos que nos encontramos

- **Al conectar sale el login de Vercel en vez del de la app.** La *Site URL* de Supabase apuntaba a un dominio `*-proyecto.vercel.app` protegido por Vercel Authentication. Se arregla poniendo el dominio público de producción como Site URL.
- **ChatGPT no ofrece iniciar sesión.** El middleware redirigía `/api/mcp` a `/login` (307) en lugar de dejar pasar el 401. Hay que excluir `api/mcp` y `.well-known` del matcher.
- **Tras el login el usuario acaba en la portada y no en la pantalla de permiso.** Faltaba el `?siguiente=` del apartado 4.7.
- **La sesión normal de la web también servía como token.** Por eso se comprueba `claims.client_id`: solo lo tienen los tokens emitidos por el servidor OAuth para un cliente.
- **El `insert` falla con `violates check constraint *_origen_check`.** Falta añadir `'conector'` a los valores permitidos de `origen`.
- **En Vercel, los cambios de herramientas no se ven en ChatGPT.** ChatGPT guarda la lista de herramientas: hay que actualizar el conector o quitarlo y volver a añadirlo.
- **Las instrucciones del usuario en ChatGPT mandan más que las `INSTRUCCIONES` del servidor.** Si se quiere un comportamiento concreto, como «guarda sin preguntar», hay que ponerlo también en sus instrucciones personalizadas.
