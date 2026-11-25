import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type InternalUserForm = {
  displayName: string;
  email: string;
  password: string;
  role: "admin" | "user";
};

export async function createInternalUser(values: InternalUserForm) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !sessionData.user) throw new Error("Entre novamente no sistema.");
  const { data: permitted, error: permissionError } = await supabase.rpc("has_role", {
    _user_id: sessionData.user.id,
    _role: "admin",
  });
  if (permissionError || !permitted) throw new Error("Somente administradores podem criar usuários.");

  // A separate, non-persistent client prevents signup from replacing the administrator's session.
  const registrationClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await registrationClient.auth.signUp({
    email: values.email.trim(),
    password: values.password,
    options: {
      data: { display_name: values.displayName.trim() },
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.message === "User already registered") {
      throw new Error("Este e-mail já está cadastrado. Consulte a aba Usuários.");
    }
    throw new Error("Não foi possível criar o usuário. Verifique os dados e tente novamente.");
  }
  if (!data.user || data.user.identities?.length === 0) {
    throw new Error("Não foi possível criar a conta. Verifique se o e-mail já está cadastrado.");
  }
  const { error: roleError } = await supabase.from("user_roles")
    .update({ role: values.role }).eq("user_id", data.user.id).select("role").single();
  if (roleError) {
    throw new Error("A conta foi cadastrada, mas o acesso não foi definido. Confira o usuário na aba Usuários antes de tentar novamente.");
  }
  return { needsConfirmation: !data.session };
}