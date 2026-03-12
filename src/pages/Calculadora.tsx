import FatorRCalculator from "@/components/FatorRCalculator";

const Calculadora = () => {
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">
        Calculadora do Fator R
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-2xl">
        Descubra se sua empresa será tributada pelo Anexo III ou Anexo V do Simples Nacional.
      </p>
      <FatorRCalculator />
    </div>
  );
};

export default Calculadora;
