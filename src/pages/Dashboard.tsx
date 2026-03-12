import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Info, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatMonth = (date: Date) => {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${y}`;
};

const getMonthDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const Dashboard = () => {
  const now = new Date();
  const [refDate, setRefDate] = useState(getMonthDate(now));

  // Period: 12 months ending at refDate - 1 month
  // Ex: ref 03/2026 → period 03/2025 to 02/2026
  const periodEnd = addMonths(refDate, -1);
  const periodStart = addMonths(refDate, -12);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyData = [] } = useQuery({
    queryKey: ["monthly_data", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_data")
        .select("*")
        .gte("mes_referencia", periodStart.toISOString().split("T")[0])
        .lte("mes_referencia", periodEnd.toISOString().split("T")[0]);
      if (error) throw error;
      return data;
    },
  });

  const clientCalcs = useMemo(() => {
    return clients.map((client) => {
      const clientMonths = monthlyData.filter((d) => d.client_id === client.id);
      const rba12 = clientMonths.reduce((sum, d) => sum + Number(d.faturamento), 0);
      const folha12 = clientMonths.reduce((sum, d) => sum + Number(d.folha_salarios), 0);
      const fatorR = rba12 > 0 ? (folha12 / rba12) : null;
      
      let anexo = "Não se aplica";
      if (fatorR !== null && rba12 > 0) {
        anexo = fatorR >= 0.28 ? `${fatorR.toFixed(2)} Anexo III` : `${fatorR.toFixed(2)} Anexo V`;
      }

      // Quanto falta para atingir 28%
      let folhaNecessaria = 0;
      if (fatorR !== null && fatorR < 0.28 && rba12 > 0) {
        folhaNecessaria = rba12 * 0.28 - folha12;
      }

      return {
        ...client,
        rba12,
        folha12,
        fatorR,
        anexo,
        folhaNecessaria,
      };
    });
  }, [clients, monthlyData]);

  const counts = useMemo(() => {
    const gte28 = clientCalcs.filter((c) => c.fatorR !== null && c.fatorR >= 0.28).length;
    const lt28 = clientCalcs.filter((c) => c.fatorR !== null && c.fatorR < 0.28).length;
    const na = clientCalcs.filter((c) => c.fatorR === null).length;
    return { gte28, lt28, na };
  }, [clientCalcs]);

  const formatCNPJ = (cnpj: string) =>
    cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Fator R</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            O fator R é o cálculo utilizado para determinar em qual Anexo do regime tributário Simples Nacional uma empresa se enquadra.
          </p>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm font-medium text-muted-foreground">Mês de referência:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefDate(addMonths(refDate, -1))}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-foreground min-w-[80px] text-center">
            {formatMonth(refDate)}
          </span>
          <button
            onClick={() => setRefDate(addMonths(refDate, 1))}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          RBT12: {formatMonth(periodStart)} a {formatMonth(periodEnd)}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-0 mb-8">
        <div className="bg-accent/15 border border-accent/30 rounded-l-xl p-5">
          <p className="text-sm font-medium text-foreground mb-1">Empresas ≥ 0,28</p>
          <p className="text-2xl font-bold text-foreground">{counts.gte28}</p>
        </div>
        <div className="bg-card border-y border-border p-5">
          <p className="text-sm font-medium text-foreground mb-1">Empresas &lt; 0,28</p>
          <p className="text-2xl font-bold text-foreground">{counts.lt28}</p>
        </div>
        <div className="bg-card border border-border rounded-r-xl p-5">
          <p className="text-sm font-medium text-foreground mb-1">Não se aplica</p>
          <p className="text-2xl font-bold text-foreground">{counts.na}</p>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary text-left">
              <th className="px-5 py-3 font-semibold text-foreground">Empresa</th>
              <th className="px-5 py-3 font-semibold text-foreground">Mês de ref.</th>
              <th className="px-5 py-3 font-semibold text-foreground">
                <div>RBA</div>
                <div className="text-xs font-normal text-muted-foreground">12 MESES</div>
              </th>
              <th className="px-5 py-3 font-semibold text-foreground">
                <div>Folha</div>
                <div className="text-xs font-normal text-muted-foreground">12 MESES</div>
              </th>
              <th className="px-5 py-3 font-semibold text-foreground">
                <div>Fator R</div>
                <div className="text-xs font-normal text-muted-foreground">RESULTADO</div>
              </th>
              <th className="px-5 py-3 font-semibold text-foreground">Recomendação</th>
            </tr>
          </thead>
          <tbody>
            {clientCalcs.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-medium text-foreground">{c.razao_social}</div>
                  <div className="text-xs text-muted-foreground">{formatCNPJ(c.cnpj)}</div>
                </td>
                <td className="px-5 py-4 text-foreground">{formatMonth(refDate)}</td>
                <td className="px-5 py-4 text-foreground">{formatCurrency(c.rba12)}</td>
                <td className="px-5 py-4 text-foreground">{formatCurrency(c.folha12)}</td>
                <td className="px-5 py-4">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      c.fatorR === null
                        ? "bg-muted text-muted-foreground"
                        : c.fatorR >= 0.28
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }`}
                  >
                    {c.anexo}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm">
                  {c.folhaNecessaria > 0 ? (
                    <span className="text-warning">
                      Aumentar folha em {formatCurrency(c.folhaNecessaria)}
                    </span>
                  ) : c.fatorR !== null && c.fatorR >= 0.28 ? (
                    <span className="text-success">Anexo III ✓</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {clientCalcs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  Nenhum cliente cadastrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
