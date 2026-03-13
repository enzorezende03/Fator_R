import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { generateReportPdf, generateBatchReportPdf, type ReportData } from "@/lib/generateReportPdf";

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

type FilterType = "all" | "gte28" | "lt28" | "na";

function buildReportData(
  client: ReturnType<typeof buildClientCalcs>[0],
  monthlyData: any[],
  refDate: Date,
  periodEnd: Date
): ReportData {
  // Get the most recent month's data for this client
  const endStr = periodEnd.toISOString().split("T")[0];
  const clientMonthData = monthlyData.find(
    (d) => d.client_id === client.id && d.mes_referencia === endStr
  );
  const faturamentoMes = clientMonthData ? Number(clientMonthData.faturamento) : 0;
  const folhaMes = clientMonthData ? Number(clientMonthData.folha_salarios) : 0;

  return {
    razaoSocial: client.razao_social,
    cnpj: client.cnpj,
    competencia: formatMonth(refDate),
    rbt12: client.rba12,
    faturamentoMes,
    folhaMes,
  };
}

function buildClientCalcs(clients: any[], monthlyData: any[]) {
  return clients.map((client) => {
    const clientMonths = monthlyData.filter((d) => d.client_id === client.id);
    const rba12 = clientMonths.reduce((sum, d) => sum + Number(d.faturamento), 0);
    const folha12 = clientMonths.reduce((sum, d) => sum + Number(d.folha_salarios), 0);
    const fatorR = rba12 > 0 ? folha12 / rba12 : null;

    let anexo = "Não se aplica";
    if (fatorR !== null && rba12 > 0) {
      anexo = fatorR >= 0.28 ? `${fatorR.toFixed(2)} Anexo III` : `${fatorR.toFixed(2)} Anexo V`;
    }

    let complementoFolha = 0;
    if (fatorR !== null && fatorR < 0.28 && rba12 > 0) {
      complementoFolha = rba12 * 0.28 - folha12;
    }

    return {
      ...client,
      rba12,
      folha12,
      fatorR,
      anexo,
      complementoFolha,
    };
  });
}

const Dashboard = () => {
  const now = new Date();
  const [refDate, setRefDate] = useState(getMonthDate(now));
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const clientCalcs = useMemo(() => buildClientCalcs(clients, monthlyData), [clients, monthlyData]);

  const counts = useMemo(() => {
    const gte28 = clientCalcs.filter((c) => c.fatorR !== null && c.fatorR >= 0.28).length;
    const lt28 = clientCalcs.filter((c) => c.fatorR !== null && c.fatorR < 0.28).length;
    const na = clientCalcs.filter((c) => c.fatorR === null).length;
    return { gte28, lt28, na };
  }, [clientCalcs]);

  const filteredClients = useMemo(() => {
    switch (filter) {
      case "gte28": return clientCalcs.filter((c) => c.fatorR !== null && c.fatorR >= 0.28);
      case "lt28": return clientCalcs.filter((c) => c.fatorR !== null && c.fatorR < 0.28);
      case "na": return clientCalcs.filter((c) => c.fatorR === null);
      default: return clientCalcs;
    }
  }, [clientCalcs, filter]);

  const allSelected = filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatCNPJ = (cnpj: string) =>
    cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

  const handleDownloadSingle = async (client: (typeof filteredClients)[0]) => {
    const reportData = buildReportData(client, monthlyData, refDate, periodEnd);
    const doc = await generateReportPdf(reportData);
    doc.save(`relatorio_fator_r_${client.razao_social.replace(/\s+/g, "_")}_${formatMonth(refDate).replace("/", "_")}.pdf`);
    toast.success(`Relatório PDF gerado para ${client.razao_social}`);
  };

  const handleDownloadBatch = async () => {
    const toExport = someSelected
      ? filteredClients.filter((c) => selectedIds.has(c.id))
      : filteredClients;

    if (toExport.length === 0) {
      toast.error("Nenhum cliente selecionado para exportar.");
      return;
    }

    const dataList = toExport.map((c) => buildReportData(c, monthlyData, refDate, periodEnd));
    const doc = await generateBatchReportPdf(dataList);
    if (doc) {
      doc.save(`relatorio_fator_r_lote_${formatMonth(refDate).replace("/", "_")}.pdf`);
      toast.success(`Relatório PDF em lote gerado com ${toExport.length} empresa(s)`);
    }
  };

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

      {/* Summary Cards - clickable filters */}
      <div className="grid grid-cols-3 gap-0 mb-8">
        <button
          onClick={() => setFilter(filter === "gte28" ? "all" : "gte28")}
          className={`text-left border rounded-l-xl p-5 transition-colors ${
            filter === "gte28"
              ? "bg-accent/25 border-accent/50 ring-2 ring-accent/30"
              : "bg-accent/15 border-accent/30 hover:bg-accent/20"
          }`}
        >
          <p className="text-sm font-medium text-foreground mb-1">Empresas ≥ 0,28</p>
          <p className="text-2xl font-bold text-foreground">{counts.gte28}</p>
        </button>
        <button
          onClick={() => setFilter(filter === "lt28" ? "all" : "lt28")}
          className={`text-left border-y border-r p-5 transition-colors ${
            filter === "lt28"
              ? "bg-warning/15 border-warning/30 ring-2 ring-warning/30"
              : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <p className="text-sm font-medium text-foreground mb-1">Empresas &lt; 0,28</p>
          <p className="text-2xl font-bold text-foreground">{counts.lt28}</p>
        </button>
        <button
          onClick={() => setFilter(filter === "na" ? "all" : "na")}
          className={`text-left border rounded-r-xl p-5 transition-colors ${
            filter === "na"
              ? "bg-muted border-muted-foreground/30 ring-2 ring-muted-foreground/30"
              : "bg-card border-border hover:bg-muted/30"
          }`}
        >
          <p className="text-sm font-medium text-foreground mb-1">Não se aplica</p>
          <p className="text-2xl font-bold text-foreground">{counts.na}</p>
        </button>
      </div>

      {/* Batch download */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {filter !== "all" && (
            <button onClick={() => setFilter("all")} className="text-primary hover:underline mr-2">
              Limpar filtro ×
            </button>
          )}
          Exibindo {filteredClients.length} empresa(s)
          {someSelected && (
            <span className="ml-2 text-primary font-medium">
              · {selectedIds.size} selecionada(s)
            </span>
          )}
        </p>
        <button
          onClick={handleDownloadBatch}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary transition-colors"
        >
          <Download className="w-4 h-4" />
          {someSelected
            ? `Baixar relatório (${selectedIds.size} selecionadas)`
            : "Baixar relatório em lote"}
        </button>
      </div>

      {/* Table */}
      <div className="w-full rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[4%]" />
            <col className="w-[18%]" />
            <col className="w-[8%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr className="bg-secondary text-left">
              <th className="px-3 py-3 text-center">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Selecionar todas"
                />
              </th>
              <th className="px-4 py-3 font-semibold text-foreground">Empresa</th>
              <th className="px-4 py-3 font-semibold text-foreground">Mês ref.</th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">
                <div>RBA</div>
                <div className="text-xs font-normal text-muted-foreground">12 MESES</div>
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">
                <div>Folha</div>
                <div className="text-xs font-normal text-muted-foreground">12 MESES</div>
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-center">
                <div>Fator R</div>
                <div className="text-xs font-normal text-muted-foreground">RESULTADO</div>
              </th>
              <th className="px-4 py-3 font-semibold text-foreground text-right">
                <div>Compl. Folha</div>
                <div className="text-xs font-normal text-muted-foreground">PARA 28%</div>
              </th>
              <th className="px-4 py-3 font-semibold text-foreground">Recomendação</th>
              <th className="px-4 py-3 font-semibold text-foreground text-center">Rel.</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((c) => (
              <tr
                key={c.id}
                className={`border-t border-border hover:bg-muted/30 transition-colors ${
                  selectedIds.has(c.id) ? "bg-primary/5" : ""
                }`}
              >
                <td className="px-3 py-4 text-center">
                  <Checkbox
                    checked={selectedIds.has(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                    aria-label={`Selecionar ${c.razao_social}`}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-foreground truncate">{c.razao_social}</div>
                  <div className="text-xs text-muted-foreground">{formatCNPJ(c.cnpj)}</div>
                </td>
                <td className="px-4 py-4 text-foreground">{formatMonth(refDate)}</td>
                <td className="px-4 py-4 text-foreground text-right">{formatCurrency(c.rba12)}</td>
                <td className="px-4 py-4 text-foreground text-right">{formatCurrency(c.folha12)}</td>
                <td className="px-4 py-4 text-center">
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
                <td className="px-4 py-4 text-right">
                  {c.complementoFolha > 0 ? (
                    <span className="text-warning font-medium">{formatCurrency(c.complementoFolha)}</span>
                  ) : c.fatorR !== null && c.fatorR >= 0.28 ? (
                    <span className="text-success text-xs">—</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm truncate">
                  {c.complementoFolha > 0 ? (
                    <span className="text-warning">
                      Aumentar folha em {formatCurrency(c.complementoFolha)}
                    </span>
                  ) : c.fatorR !== null && c.fatorR >= 0.28 ? (
                    <span className="text-success">Anexo III ✓</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => handleDownloadSingle(c)}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    title="Gerar relatório de economia"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  Nenhum cliente encontrado
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
