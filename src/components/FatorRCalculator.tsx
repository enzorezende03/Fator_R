import { useState } from "react";

const formatCurrency = (value: string) => {
  const num = value.replace(/\D/g, "");
  if (!num) return "";
  return (parseInt(num) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const parseCurrency = (value: string) => {
  const num = value.replace(/\D/g, "");
  return num ? parseInt(num) / 100 : 0;
};

const FatorRCalculator = () => {
  const [folha, setFolha] = useState("");
  const [receita, setReceita] = useState("");
  const [resultado, setResultado] = useState<null | {
    percentual: number;
    anexo: string;
    aliquota: string;
  }>(null);

  const calcular = () => {
    const folhaVal = parseCurrency(folha);
    const receitaVal = parseCurrency(receita);
    if (receitaVal === 0) return;

    const percentual = (folhaVal / receitaVal) * 100;
    const isAnexoIII = percentual >= 28;

    setResultado({
      percentual: Math.round(percentual * 100) / 100,
      anexo: isAnexoIII ? "Anexo III" : "Anexo V",
      aliquota: isAnexoIII ? "a partir de 6%" : "a partir de 15,5%",
    });
  };

  const limpar = () => {
    setFolha("");
    setReceita("");
    setResultado(null);
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
        <h2 className="font-display text-2xl text-foreground mb-6">
          Calcule seu Fator R
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Folha de Salários (últimos 12 meses)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={folha}
              onChange={(e) => setFolha(formatCurrency(e.target.value))}
              placeholder="R$ 0,00"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Receita Bruta (últimos 12 meses)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={receita}
              onChange={(e) => setReceita(formatCurrency(e.target.value))}
              placeholder="R$ 0,00"
              className="w-full px-4 py-3 rounded-xl border border-input bg-background text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={calcular}
              className="flex-1 bg-primary text-primary-foreground font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity text-lg"
            >
              Calcular
            </button>
            <button
              onClick={limpar}
              className="px-6 py-3 rounded-xl border border-border text-muted-foreground font-medium hover:bg-secondary transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {resultado && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div
              className={`rounded-xl p-6 border-2 ${
                resultado.percentual >= 28
                  ? "bg-success/10 border-success"
                  : "bg-warning/10 border-warning"
              }`}
            >
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  Seu Fator R é
                </p>
                <p className="text-5xl font-display text-foreground mb-3">
                  {resultado.percentual.toFixed(2).replace(".", ",")}%
                </p>
                <div
                  className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${
                    resultado.percentual >= 28
                      ? "bg-success text-success-foreground"
                      : "bg-warning text-warning-foreground"
                  }`}
                >
                  {resultado.anexo} — {resultado.aliquota}
                </div>
                <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto">
                  {resultado.percentual >= 28
                    ? "Ótima notícia! Sua empresa se enquadra no Anexo III, com tributação mais vantajosa."
                    : "Sua empresa se enquadra no Anexo V. Considere aumentar a folha de pagamento para atingir os 28%."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FatorRCalculator;
