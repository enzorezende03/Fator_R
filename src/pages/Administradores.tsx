import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Plus, UserMinus, UserPlus, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Administradores = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });

  const { data: currentProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: currentRole } = useQuery({
    queryKey: ["my_role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

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

  const regularUsers = allUsers.filter((u) => !isAdmin(u.user_id));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admins"] });
    queryClient.invalidateQueries({ queryKey: ["all_roles"] });
    queryClient.invalidateQueries({ queryKey: ["all_users_profiles"] });
  };

  const createAdminMutation = useMutation({
    mutationFn: async (values: typeof form) => {
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os administradores e usuários do sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="perfil" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="administradores" className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Administradores
          </TabsTrigger>
        </TabsList>

        {/* Tab: Perfil */}
        <TabsContent value="perfil">
          <div className="bg-card rounded-xl border border-border p-6 max-w-lg">
            <h2 className="font-display text-xl font-bold text-foreground mb-6">Meu Perfil</h2>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl">
                {currentProfile?.display_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{currentProfile?.display_name || "—"}</p>
                <p className="text-sm text-muted-foreground">{currentProfile?.email || user?.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Papel</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  currentRole?.role === "admin"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {currentRole?.role === "admin" ? "Administrador" : "Usuário"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Membro desde</span>
                <span className="text-sm text-foreground">
                  {currentProfile?.created_at
                    ? new Date(currentProfile.created_at).toLocaleDateString("pt-BR")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Usuários */}
        <TabsContent value="usuarios">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">
            Usuários ({regularUsers.length})
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
                {regularUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  regularUsers.map((u) => (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{u.display_name}</td>
                      <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                          Usuário
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => promoteMutation.mutate(u.user_id)}
                          className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          title="Promover a admin"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab: Administradores */}
        <TabsContent value="administradores">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-foreground">
              Administradores ({admins.length})
            </h2>
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
              <h3 className="font-display text-lg font-bold text-foreground mb-4">Criar novo administrador</h3>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Administradores;
