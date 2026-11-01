"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Permitir o rechazar que ChatGPT o Claude usen Campo con tu usuario.

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
