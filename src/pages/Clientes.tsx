import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, Upload, Search, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

const formatCNPJ = (value: string) => {
  const nums = value.replace(/\D/g, "").slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const Clientes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ razao_social: "", cnpj: "", email: "", telefone: "" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editingId) {
        const { error } = await supabase.from("clients").update(values).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ ...values, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(editingId ? "Cliente atualizado!" : "Cliente cadastrado!");
      resetForm();
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("CNPJ já cadastrado!");
      } else {
        toast.error("Erro ao salvar cliente");
      }
    },
  });

  const resetForm = () => {
    setForm({ razao_social: "", cnpj: "", email: "", telefone: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (client: any) => {
    setForm({
      razao_social: client.razao_social,
      cnpj: client.cnpj,
      email: client.email || "",
      telefone: client.telefone || "",
    });
    setEditingId(client.id);
    setShowForm(true);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    const mapped = rows
      .map((row) => ({
        razao_social: String(row["Razão Social"] || row["razao_social"] || row["RAZAO_SOCIAL"] || row["Empresa"] || "").trim(),
        cnpj: String(row["CNPJ"] || row["cnpj"] || "").replace(/\D/g, ""),
        email: String(row["E-mail"] || row["email"] || row["Email"] || "").trim() || null,
        telefone: String(row["Telefone"] || row["telefone"] || row["Tel"] || "").trim() || null,
        created_by: user?.id,
      }))
      .filter((r) => r.razao_social && r.cnpj.length >= 14);

    if (mapped.length === 0) {
      toast.error("Nenhum cliente válido encontrado na planilha");
      return;
    }

    const { error } = await supabase.from("clients").upsert(mapped, { onConflict: "cnpj" });
    if (error) {
      toast.error("Erro ao importar: " + error.message);
    } else {
      toast.success(`${mapped.length} clientes importados!`);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
    e.target.value = "";
  };

  const filtered = clients.filter(
    (c) =>
      c.razao_social.toLowerCase().includes(search.toLowerCase()) ||
      c.cnpj.includes(search.replace(/\D/g, ""))
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-1">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clientes cadastrados</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 border border-primary text-primary px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/5 transition-colors">
            <Upload className="w-4 h-4" />
            Importar Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
          </label>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6 mb-6 animate-in fade-in slide-in-from-top-2">
          <h2 className="font-display text-xl font-bold text-foreground mb-4">
            {editingId ? "Editar Cliente" : "Novo Cliente"}
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form); }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">Razão Social</label>
              <input
                required
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">CNPJ</label>
              <input
                required
                value={formatCNPJ(form.cnpj)}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value.replace(/\D/g, "") })}
                maxLength={18}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="col-span-2 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-lg border border-border text-muted-foreground text-sm hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CNPJ..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="text-left px-5 py-3 font-semibold text-foreground">Razão Social</th>
                <th className="text-left px-5 py-3 font-semibold text-foreground">CNPJ</th>
                <th className="text-left px-5 py-3 font-semibold text-foreground">E-mail</th>
                <th className="text-left px-5 py-3 font-semibold text-foreground">Telefone</th>
                <th className="px-5 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{client.razao_social}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatCNPJ(client.cnpj)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{client.email || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{client.telefone || "—"}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleEdit(client)}
                      className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">
                    {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Clientes;
