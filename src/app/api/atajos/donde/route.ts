import { leerCuerpo, numero, texto, usuarioDeAtajo } from "@/lib/atajos";
import { textoDistancia, ubicar } from "@/lib/ubicacion";

// Atajo de Siri «¿En qué finca estoy?»: responde finca y zona en una frase.

export const maxDuration = 10;

async function atender(request: Request) {
  const cuerpo = await leerCuerpo(request);
  const u = await usuarioDeAtajo(request, cuerpo);
  if (u instanceof Response) return u;

  const lat = numero(cuerpo.lat ?? cuerpo.latitud);
  const lon = numero(cuerpo.lon ?? cuerpo.lng ?? cuerpo.longitud);
  if (lat == null || lon == null) return texto("No me ha llegado tu ubicación. Revisa que el atajo tenga permiso para usarla.");

  const d = ubicar(lat, lon);
  if (!d.enFinca) return texto(`No estás en ninguna finca. La más cercana es ${d.finca}, ${textoDistancia(d.distanciaFincaM)}.`);
  if (d.zona) return texto(`Estás en ${d.finca}, zona ${d.zona}.`);
  return texto(
    d.distanciaFincaM > 0
      ? `Estás junto a ${d.finca}, ${textoDistancia(d.distanciaFincaM)} del borde.`
      : `Estás en ${d.finca}${d.clave === "lobosillo" ? "" : ", pero no sé en qué zona"}.`,
  );
}

export const POST = atender;
export const GET = atender;
