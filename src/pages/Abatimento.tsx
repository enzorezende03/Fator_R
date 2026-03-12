import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Save, ChevronLeft, ChevronRight, ChevronsUpDown, Check, Upload } from "lucide-react";
import { parseCartaFaturamento } from "@/lib/parseCartaFaturamento";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const formatMonth = (date: Date) => {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${y}`;
};

const getMonthDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const toISODate = (date: Date) => date.toISOString().split("T")[0];

const parseBRL = (value: string) => {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const formatBRL = (value: number) => {
  if (value === 0) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const Abatimento = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [refDate, setRefDate] = useState(getMonthDate(now));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // 12 months: from refDate-11 to refDate
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => addMonths(refDate, i - 11));
  }, [refDate]);

  const periodStart = months[0];
  const periodEnd = months[11];

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const { data: monthlyData } = useQuery({
    queryKey: ["monthly_data_abatimento", selectedClientId, periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const { data, error } = await supabase
        .from("monthly_data")
        .select("*")
        .eq("client_id", selectedClientId)
        .gte("mes_referencia", toISODate(periodStart))
        .lte("mes_referencia", toISODate(periodEnd));
      if (error) throw error;
      return data;
    },
    enabled: !!selectedClientId,
  });

  const monthlyRows = useMemo(() => monthlyData ?? [], [monthlyData]);

  // Local state for form values
  const [folhaValues, setFolhaValues] = useState<Record<string, string>>({});
  const [rbaValues, setRbaValues] = useState<Record<string, string>>({});

  // Initialize from DB data
  useEffect(() => {
    if (!selectedClientId) return;
    const folha: Record<string, string> = {};
    const rba: Record<string, string> = {};
    months.forEach((m) => {
      const key = toISODate(m);
      const existing = monthlyRows.find((d) => d.mes_referencia === key);
      folha[key] = existing ? formatBRL(Number(existing.folha_salarios)) : "";
      rba[key] = existing ? formatBRL(Number(existing.faturamento)) : "";
    });
    setFolhaValues(folha);
    setRbaValues(rba);
  }, [monthlyRows, months, selectedClientId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || !user) return;

      type MonthlyPayload = {
        client_id: string;
        mes_referencia: string;
        folha_salarios: number;
        faturamento: number;
        created_by: string;
      };

      const updates: Array<MonthlyPayload & { id: string }> = [];
      const inserts: MonthlyPayload[] = [];

      months.forEach((m) => {
        const key = toISODate(m);
        const existing = monthlyRows.find((d) => d.mes_referencia === key);

        const payload: MonthlyPayload = {
          client_id: selectedClientId,
          mes_referencia: key,
          folha_salarios: parseBRL(folhaValues[key] || "0"),
          faturamento: parseBRL(rbaValues[key] || "0"),
          created_by: user.id,
        };

        if (existing) {
          updates.push({ id: existing.id, ...payload });
        } else {
          inserts.push(payload);
        }
      });

      if (updates.length > 0) {
        const { error } = await supabase.from("monthly_data").upsert(updates, { onConflict: "id" });
        if (error) throw error;
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("monthly_data").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly_data_abatimento"] });
      queryClient.invalidateQueries({ queryKey: ["monthly_data"] });
      toast.success("Dados salvos com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar dados");
    },
  });

  const totalFolha = months.reduce((sum, m) => sum + parseBRL(folhaValues[toISODate(m)] || "0"), 0);
  const totalRba = months.reduce((sum, m) => sum + parseBRL(rbaValues[toISODate(m)] || "0"), 0);
  const fatorR = totalRba > 0 ? totalFolha / totalRba : 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Abatimento</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os valores de Folha de Salários e RBA (Receita Bruta Acumulada) dos últimos 12 meses.
        </p>
      </div>

      {/* Client selector + month navigator */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">Cliente</label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                role="combobox"
                className="flex w-full items-center justify-between px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                {selectedClientId
                  ? clients.find((c) => c.id === selectedClientId)?.razao_social
                  : "Selecione ou pesquise um cliente..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Pesquisar cliente..." />
                <CommandList>
                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.razao_social}
                        onSelect={() => {
                          setSelectedClientId(c.id === selectedClientId ? null : c.id);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                        {c.razao_social}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Competência:</span>
          <button
            onClick={() => setRefDate(addMonths(refDate, -1))}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-foreground min-w-[100px] text-center text-sm">
            {formatMonth(addMonths(refDate, 1))}
          </span>
          <button
            onClick={() => setRefDate(addMonths(refDate, 1))}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {selectedClientId && (
          <label className="flex items-center gap-2 border border-primary text-primary px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/5 transition-colors whitespace-nowrap">
            <Upload className="w-4 h-4" />
            Importar Carta de Faturamento
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await parseCartaFaturamento(file);
                  if (data.rows.length === 0) {
                    toast.error("Nenhum dado encontrado no PDF.");
                    return;
                  }
                  const newFolha = { ...folhaValues };
                  const newRba = { ...rbaValues };
                  let filled = 0;
                  data.rows.forEach((row) => {
                    if (newFolha.hasOwnProperty(row.mesReferencia)) {
                      newFolha[row.mesReferencia] = row.folhaSalarios > 0 ? formatBRL(row.folhaSalarios) : "";
                      newRba[row.mesReferencia] = row.faturamento > 0 ? formatBRL(row.faturamento) : "";
                      filled++;
                    }
                  });
                  setFolhaValues(newFolha);
                  setRbaValues(newRba);
                  toast.success(`${filled} mês(es) importado(s) com sucesso!`);
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao ler o PDF.");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
      </div>

      {selectedClientId && (
        <>
          {/* Folha de Salários */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-1">Folha de Salários</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Folha de Salários, incluídos encargos (até 12 meses anteriores ao Período de Apuração) (R$):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {months.map((m) => {
                const key = toISODate(m);
                return (
                  <div key={`folha-${key}`}>
                    <label className="block text-sm font-bold text-foreground mb-1">
                      {formatMonth(m)}
                    </label>
                    <input
                      type="text"
                      value={folhaValues[key] || ""}
                      onChange={(e) => setFolhaValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={(e) => {
                        const num = parseBRL(e.target.value);
                        setFolhaValues((prev) => ({ ...prev, [key]: num > 0 ? formatBRL(num) : "" }));
                      }}
                      placeholder="0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-right text-sm font-semibold text-foreground">
              Total: R$ {formatBRL(totalFolha) || "0,00"}
            </div>
          </div>

          {/* RBA */}
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="font-display text-lg font-bold text-foreground mb-1">RBA - Receita Bruta Acumulada</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Receita Bruta Acumulada dos últimos 12 meses anteriores ao Período de Apuração (R$):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {months.map((m) => {
                const key = toISODate(m);
                return (
                  <div key={`rba-${key}`}>
                    <label className="block text-sm font-bold text-foreground mb-1">
                      {formatMonth(m)}
                    </label>
                    <input
                      type="text"
                      value={rbaValues[key] || ""}
                      onChange={(e) => setRbaValues((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={(e) => {
                        const num = parseBRL(e.target.value);
                        setRbaValues((prev) => ({ ...prev, [key]: num > 0 ? formatBRL(num) : "" }));
                      }}
                      placeholder="0,00"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-right text-sm font-semibold text-foreground">
              Total: R$ {formatBRL(totalRba) || "0,00"}
            </div>
          </div>

          {/* Summary + Save */}
          <div className="flex items-center justify-between bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-xs text-muted-foreground">Fator R</p>
                <p className={`text-2xl font-bold ${fatorR >= 0.28 ? "text-success" : totalRba > 0 ? "text-warning" : "text-muted-foreground"}`}>
                  {totalRba > 0 ? `${(fatorR * 100).toFixed(2)}%` : "—"}
                </p>
              </div>
              {totalRba > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Enquadramento</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                    fatorR >= 0.28 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  }`}>
                    {fatorR >= 0.28 ? "Anexo III" : "Anexo V"}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Dados"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Abatimento;
