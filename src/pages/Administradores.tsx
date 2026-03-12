import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Plus, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

const Administradores = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      if (rolesErr) throw rolesErr;
      if (!roles.length) return [];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", roles.map((r) => r.user_id));
      if (profErr) throw profErr;
      return profiles;
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all_users_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["all_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const isAdmin = (userId: string) =>
    allRoles.some((r) => r.user_id === userId && r.role === "admin");

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admins"] });
    queryClient.invalidateQueries({ queryKey: ["all_roles"] });
    queryClient.invalidateQueries({ queryKey: ["all_users_profiles"] });
  };

  // Create new admin user
  const createAdminMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      // Sign up new user
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { display_name: values.displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpErr) throw signUpErr;
      if (!signUpData.user) throw new Error("Erro ao criar usuário");

      // Update role to admin
      const { error: roleErr } = await supabase
        .from("user_roles")
        .update({ role: "admin" as any })
        .eq("user_id", signUpData.user.id);
      if (roleErr) throw roleErr;
    },
    onSuccess: () => {
      toast.success("Administrador criado com sucesso!");
      setForm({ email: "", password: "", displayName: "" });
      setShowForm(false);
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao criar administrador");
    },
  });

  // Promote existing user to admin
  const promoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "admin" as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário promovido a administrador!");
      invalidateAll();
    },
    onError: () => toast.error("Erro ao promover usuário"),
  });

  // Demote admin to user
  const demoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "user" as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Administrador removido!");
      invalidateAll();
    },
    onError: () => toast.error("Erro ao remover administrador"),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Administradores</h1>
            <p className="text-sm text-muted-foreground">Gerencie os administradores do sistema</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo Administrador
        </button>
      </div>

      {/* Create admin form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6 animate-in fade-in slide-in-from-top-2">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">Criar novo administrador</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createAdminMutation.mutate(form);
            }}
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Nome</label>
              <input
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">E-mail</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Senha</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="col-span-3 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={createAdminMutation.isPending}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {createAdminMutation.isPending ? "Criando..." : "Criar Administrador"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-lg border border-border text-muted-foreground text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin list */}
      <div className="mb-10">
        <h2 className="font-display text-xl font-bold text-foreground mb-4">
          Administradores ativos ({admins.length})
        </h2>
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : admins.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            Nenhum administrador cadastrado
          </div>
        ) : (
          <div className="grid gap-3">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="bg-card rounded-xl border border-border p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {admin.display_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{admin.display_name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    Admin
                  </span>
                  {admin.user_id !== user?.id && (
                    <button
                      onClick={() => demoteMutation.mutate(admin.user_id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      title="Remover admin"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All users */}
      <h2 className="font-display text-xl font-bold text-foreground mb-4">
        Todos os usuários ({allUsers.length})
      </h2>
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary">
              <th className="text-left px-5 py-3 font-semibold text-foreground">Nome</th>
              <th className="text-left px-5 py-3 font-semibold text-foreground">E-mail</th>
              <th className="text-left px-5 py-3 font-semibold text-foreground">Papel</th>
              <th className="px-5 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {allUsers.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 font-medium text-foreground">{u.display_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      isAdmin(u.user_id)
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAdmin(u.user_id) ? "Admin" : "Usuário"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {!isAdmin(u.user_id) && (
                    <button
                      onClick={() => promoteMutation.mutate(u.user_id)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      title="Promover a admin"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Administradores;
