import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";

const Administradores = () => {
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

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-8 h-8 text-primary" />
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Administradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie os administradores do sistema</p>
        </div>
      </div>

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
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  Admin
                </span>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Administradores;
