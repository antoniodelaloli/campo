# Campo

Gestión interna de las fincas (Valladolises, Corvera, Lobosillo). Next.js + Supabase.

## Arrancar en local

```bash
npm install
npm run dev        # http://localhost:3000
```

Las variables están en `.env.local` (ver `.env.example`). Solo se usan la URL
del proyecto y la clave pública (`sb_publishable_...`). La clave `service_role`
no se pone nunca en este proyecto de cara al navegador.

## Estructura

- `src/proxy.ts` y `src/lib/supabase/proxy.ts`: refresca la sesión y manda a `/login` si no hay usuario.
- `src/lib/supabase/server.ts` / `client.ts`: clientes de Supabase (servidor / navegador).
- `src/app/login`: pantalla de acceso (email + contraseña, sin registro libre).
- `src/app/page.tsx`: inicio con la lista de fincas (respeta RLS).
- `supabase/`: migraciones SQL.

## Despliegue

Repositorio privado en GitHub, importado en Vercel con las dos variables
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
