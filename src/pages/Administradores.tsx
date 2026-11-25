import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Plus, UserMinus, UserPlus, User, Users, Ban, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

const Administradores = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmation, setConfirmation] = useState<{ userId: string; name: string; action: "deactivate" | "reactivate" | "delete" } | null>(null);

  const { data: currentProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: currentRole } = useQuery({
    queryKey: ["my_role", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, account_disabled")
        .eq("user_id", user.id)
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
  const canManage = currentRole?.role === "admin" && !currentRole.account_disabled;
  const disabled = (id: string) => allRoles.some((r) => r.user_id === id && r.account_disabled);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admins"] });
    queryClient.invalidateQueries({ queryKey: ["all_roles"] });
    queryClient.invalidateQueries({ queryKey: ["all_users_profiles"] });
  };

  const promoteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "admin", internal_access_approved: true })
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

  const accountMutation = useMutation({
    mutationFn: async (request: NonNullable<typeof confirmation>) => {
      const { data, error } = await supabase.functions.invoke("manage-user", { body: { userId: request.userId, action: request.action } });
      if (error) {
        let message = "Não foi possível concluir a ação.";
        if ("context" in error && error.context instanceof Response) {
          const response = await error.context.json().catch(() => null);
          if (response?.error) message = response.error;
        }
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.error || "Não foi possível concluir a ação.");
    },
    onSuccess: (_, request) => {
      toast.success(request.action === "delete" ? "Usuário excluído." : request.action === "deactivate" ? "Usuário desativado." : "Usuário reativado.");
      setConfirmation(null);
      invalidateAll();
    },
    onError: (error: Error) => { toast.error(error.message); invalidateAll(); },
  });

  const accountActions = (id: string, name: string) => canManage && id !== user?.id ? (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" title={disabled(id) ? "Reativar usuário" : "Desativar usuário"} aria-label={disabled(id) ? `Reativar ${name}` : `Desativar ${name}`} disabled={accountMutation.isPending} onClick={() => setConfirmation({ userId: id, name, action: disabled(id) ? "reactivate" : "deactivate" })}>
        {disabled(id) ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="text-destructive" title="Excluir usuário" aria-label={`Excluir ${name}`} disabled={accountMutation.isPending} onClick={() => setConfirmation({ userId: id, name, action: "delete" })}><Trash2 className="w-4 h-4" /></Button>
    </div>
  ) : null;

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">Gerencie os administradores e usuários do sistema</p>
        </div>
      </div>

      {canManage && <Button asChild className="mb-6"><Link to="/configuracoes"><Plus />Criar usuário</Link></Button>}

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
          <div className="sm:hidden space-y-3">
            {regularUsers.map((u) => <div key={u.id} className="border border-border rounded-lg p-4 space-y-3">
              <div><p className="font-medium break-words">{u.display_name}</p><p className="text-sm text-muted-foreground break-all">{u.email}</p></div>
              <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{disabled(u.user_id) ? "Inativo" : "Ativo"}</span><div className="flex items-center gap-1">
                {canManage && u.user_id !== user?.id && <Button variant="ghost" size="icon" title="Promover a administrador" aria-label={`Promover ${u.display_name}`} onClick={() => promoteMutation.mutate(u.user_id)}><UserPlus className="w-4 h-4" /></Button>}
                {accountActions(u.user_id, u.display_name)}
              </div></div>
            </div>)}
          </div>
          <div className="hidden sm:block rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="text-left px-5 py-3 font-semibold text-foreground">Nome</th>
                  <th className="text-left px-5 py-3 font-semibold text-foreground">E-mail</th>
                  <th className="text-left px-5 py-3 font-semibold text-foreground">Papel</th>
                  <th className="text-left px-3 py-3">Status</th>
                  <th className="px-3 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {regularUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                ) : (
                  regularUsers.map((u) => (
                    <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 sm:px-5 py-3 font-medium text-foreground break-words">{u.display_name}</td>
                      <td className="px-3 sm:px-5 py-3 text-muted-foreground break-all">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                          Usuário
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{disabled(u.user_id) ? "Inativo" : "Ativo"}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {canManage && u.user_id !== user?.id && <Button variant="ghost" size="icon" onClick={() => promoteMutation.mutate(u.user_id)} title="Promover a administrador" aria-label={`Promover ${u.display_name}`}><UserPlus className="w-4 h-4" /></Button>}
                          {accountActions(u.user_id, u.display_name)}
                        </div>
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
          </div>

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
                  className="bg-card rounded-xl border border-border p-4 flex flex-wrap gap-3 items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {admin.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{admin.display_name}</p>
                      <p className="text-xs text-muted-foreground break-all">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      Admin
                    </span>
                    <span className="text-xs text-muted-foreground">{disabled(admin.user_id) ? "Inativo" : "Ativo"}</span>
                    {canManage && admin.user_id !== user?.id && (
                      <Button variant="ghost" size="icon"
                        onClick={() => demoteMutation.mutate(admin.user_id)}
                        className="text-destructive"
                        title="Remover admin"
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                    {accountActions(admin.user_id, admin.display_name)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!confirmation} onOpenChange={(open) => { if (!open && !accountMutation.isPending) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.action === "delete" ? "Excluir usuário?" : confirmation?.action === "deactivate" ? "Desativar usuário?" : "Reativar usuário?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.name}. {confirmation?.action === "delete" ? "A exclusão é definitiva. Contas com histórico vinculado devem ser desativadas." : confirmation?.action === "deactivate" ? "O acesso será bloqueado, mantendo o cadastro e o histórico." : "O acesso da conta será restabelecido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accountMutation.isPending}>Cancelar</AlertDialogCancel>
            <Button variant={confirmation?.action === "delete" ? "destructive" : "default"} disabled={accountMutation.isPending} onClick={() => { if (confirmation) accountMutation.mutate(confirmation); }}>{accountMutation.isPending ? "Processando..." : "Confirmar"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Administradores;
