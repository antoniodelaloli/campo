import { cerrarSesion } from "@/app/auth/actions";

export default function PendientePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-hierba px-4">
      <div className="panel w-full max-w-md space-y-3 p-6">
        <h1 className="titulo-pixel text-2xl">Cuenta pendiente de activación</h1>
        <p className="text-tinta-suave">
          Tu usuario existe, pero todavía no tiene acceso a los datos. Pide a un
          administrador que lo active.
        </p>
        <form action={cerrarSesion}>
          <button type="submit" className="boton-madera">
            Salir
          </button>
        </form>
      </div>
    </main>
  );
}
