import FatorRCalculator from "@/components/FatorRCalculator";

const infoCards = [
  {
    title: "O que é o Fator R?",
    text: "É a razão entre a folha de pagamento e o faturamento bruto dos últimos 12 meses. Esse percentual define em qual anexo do Simples Nacional sua empresa será tributada.",
  },
  {
    title: "Regra dos 28%",
    text: "Se o Fator R for ≥ 28%, a empresa é tributada pelo Anexo III (alíquotas a partir de 6%). Se for < 28%, vai para o Anexo V (a partir de 15,5%).",
  },
  {
    title: "Por que importa?",
    text: "A diferença entre os anexos pode representar uma economia significativa de impostos. O Fator R estimula a formalização da folha de pagamento e o pró-labore.",
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-xl text-primary">Fator R</span>
          <span className="text-xs text-muted-foreground">
            Simples Nacional
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 md:py-24 px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl text-foreground mb-4 leading-tight">
            Calculadora do Fator R
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Descubra se sua empresa será tributada pelo Anexo III ou Anexo V do
            Simples Nacional.
          </p>
        </div>

        <FatorRCalculator />
      </section>

      {/* Formula */}
      <section className="py-12 px-6 bg-card border-y border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-2xl text-foreground mb-6">
            Como é calculado?
          </h2>
          <div className="inline-block bg-secondary rounded-2xl px-8 py-6">
            <p className="text-sm text-muted-foreground mb-2">Fórmula</p>
            <p className="font-display text-xl md:text-2xl text-foreground">
              Fator R = (Folha de Salários ÷ Receita Bruta) × 100
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              Ambos referentes aos <strong>últimos 12 meses</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {infoCards.map((card) => (
            <div
              key={card.title}
              className="bg-card rounded-2xl border border-border p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="font-display text-lg text-foreground mb-3">
                {card.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {card.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-12 px-6 bg-card border-y border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-2xl text-foreground mb-6 text-center">
            Anexo III vs Anexo V
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary">
                  <th className="text-left px-6 py-3 font-semibold text-foreground">
                    Critério
                  </th>
                  <th className="text-center px-6 py-3 font-semibold text-success">
                    Anexo III
                  </th>
                  <th className="text-center px-6 py-3 font-semibold text-warning">
                    Anexo V
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-6 py-3 text-muted-foreground">Fator R</td>
                  <td className="px-6 py-3 text-center font-medium">≥ 28%</td>
                  <td className="px-6 py-3 text-center font-medium">{"< 28%"}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-6 py-3 text-muted-foreground">
                    Alíquota inicial
                  </td>
                  <td className="px-6 py-3 text-center font-medium text-success">
                    6%
                  </td>
                  <td className="px-6 py-3 text-center font-medium text-warning">
                    15,5%
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-6 py-3 text-muted-foreground">Vantagem</td>
                  <td className="px-6 py-3 text-center text-success font-medium">
                    Mais econômico
                  </td>
                  <td className="px-6 py-3 text-center text-warning font-medium">
                    Mais caro
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-xs text-muted-foreground">
        <p>
          Esta calculadora é apenas para fins informativos. Consulte seu
          contador para orientação fiscal.
        </p>
      </footer>
    </div>
  );
};

export default Index;
