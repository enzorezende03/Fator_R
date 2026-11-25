import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateUserAction } from "./rules.ts";

const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Serviço indisponível." });
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Entre novamente no sistema." });
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: identity, error: identityError } = await caller.auth.getUser();
  if (identityError || !identity.user) return reply(401, { error: "Entre novamente no sistema." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: actor, error: actorError } = await admin.from("user_roles").select("role, internal_access_approved, account_disabled").eq("user_id", identity.user.id).maybeSingle();
  const allowed = !actorError && actor?.role === "admin" && actor.internal_access_approved && !actor.account_disabled;
  if (!allowed) return reply(403, { error: "Somente administradores podem gerenciar usuários." });
  let body;
  try { body = await req.json(); } catch { return reply(400, { error: "Dados inválidos." }); }
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  try { validateUserAction(identity.user.id, targetId, body?.action, allowed); }
  catch (error) { return reply(400, { error: error instanceof Error ? error.message : "Dados inválidos." }); }
  const { data: target, error: targetError } = await admin.auth.admin.getUserById(targetId);
  if (targetError || !target.user) return reply(404, { error: "Usuário não encontrado." });
  try {
    if (body.action === "delete") {
      // Keep attribution and financial history intact: linked authors can only be disabled.
      for (const table of ["clients", "monthly_data"]) {
        const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq("created_by", targetId);
        if (error) throw error;
        if (count) return reply(409, { error: "Este usuário possui histórico vinculado. Use Desativar para preservar os registros." });
      }
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return reply(409, { error: "Não foi possível excluir esta conta. Use Desativar para preservar o histórico." });
    } else {
      const disabled = body.action === "deactivate";
      // Revoke existing tokens' data access before disabling sign-in.
      if (disabled) {
        const { error } = await admin.from("user_roles").update({ account_disabled: true }).eq("user_id", targetId);
        if (error) throw error;
      }
      const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: disabled ? "876000h" : "none" });
      if (error) throw error;
      if (!disabled) {
        const { error } = await admin.from("user_roles").update({ account_disabled: false }).eq("user_id", targetId);
        if (error) throw error;
      }
    }
    return reply(200, { success: true });
  } catch { return reply(500, { error: "Não foi possível concluir a ação. Atualize a lista e tente novamente." }); }
});