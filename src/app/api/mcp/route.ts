import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { contextoAgente } from "@/lib/mcp/auth";
import { INSTRUCCIONES, registrarHerramientas } from "@/lib/mcp/herramientas";

// Conector de Campo (MCP) para ChatGPT y Claude.
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

  const server = new McpServer({ name: "campo", title: "Campo · fincas", version: "1.0.0" }, { instructions: INSTRUCCIONES });
  registrarHerramientas(server, ctx);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return conCors(await transport.handleRequest(request));
  } catch (e) {
    console.error("[mcp]", e);
    return conCors(
      Response.json(
        { jsonrpc: "2.0", error: { code: -32603, message: "Error interno de Campo" }, id: null },
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
