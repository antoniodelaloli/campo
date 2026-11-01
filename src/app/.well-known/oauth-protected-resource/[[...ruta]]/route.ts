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
      resource_name: "Campo · fincas",
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
