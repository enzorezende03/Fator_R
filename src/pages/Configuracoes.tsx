import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, UserPlus, Users, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInternalUser, type InternalUserForm } from "@/lib/createInternalUser";

const emptyForm: InternalUserForm = { displayName: "", email: "", password: "", role: "user" };

export default function Configuracoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InternalUserForm>(emptyForm);
  const { data: isAdmin, isLoading, isError } = useQuery({
    queryKey: ["can_create_users", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data;
    },
  });
  const creation = useMutation({
    mutationFn: createInternalUser,
    onSuccess: () => {
      setForm(emptyForm);
      for (const key of ["admins", "all_roles", "all_users_profiles"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary shrink-0" />
          <h1 className="font-display text-3xl font-bold text-foreground">Configurações</h1>
        </div>
        <Button variant="outline" asChild><Link to="/administradores"><Users />Usuários cadastrados</Link></Button>
      </div>
      <section className="max-w-2xl">
        <h2 className="font-display text-xl font-bold text-foreground mb-6 flex items-center gap-2"><UserPlus className="w-5 h-5 text-primary" />Criar usuário</h2>
        {isLoading ? <p className="text-muted-foreground">Verificando acesso...</p> : isError ? (
          <p role="alert" className="text-destructive">Não foi possível verificar seu acesso. Tente novamente.</p>
        ) : !isAdmin ? (
          <p role="alert" className="text-muted-foreground">Somente administradores podem criar usuários.</p>
        ) : (
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); creation.mutate(form); }}>
            <div className="space-y-2">
              <label htmlFor="user-name" className="text-sm font-medium">Nome completo</label>
              <Input id="user-name" autoComplete="name" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} disabled={creation.isPending} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="user-email" className="text-sm font-medium">E-mail</label>
                <Input id="user-email" type="email" autoComplete="off" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={creation.isPending} />
              </div>
              <div className="space-y-2">
                <label htmlFor="user-password" className="text-sm font-medium">Senha inicial</label>
                <Input id="user-password" type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={creation.isPending} />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="user-role" className="text-sm font-medium">Tipo de acesso</label>
              <Select value={form.role} onValueChange={(role) => { if (role === "admin" || role === "user") setForm({ ...form, role }); }} disabled={creation.isPending}>
                <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="user">Operacional</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent>
              </Select>
            </div>
            {creation.isError && <p role="alert" className="text-sm text-destructive">{creation.error.message}</p>}
            {creation.isSuccess && <p role="status" className="text-sm text-accent flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />{creation.data.needsConfirmation ? "Usuário criado. A confirmação do e-mail é necessária para entrar." : "Usuário criado com sucesso."}</p>}
            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              <Button type="submit" disabled={creation.isPending}>{creation.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}{creation.isPending ? "Criando..." : "Criar usuário"}</Button>
              <Button type="button" variant="outline" disabled={creation.isPending} onClick={() => { setForm(emptyForm); creation.reset(); }}>Limpar</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}