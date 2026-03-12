import { Download, FileText, Info, ChevronDown } from "lucide-react";

const empresasData = [
  {
    nome: "2M SAUDE – CONTABILIDADE PARA PROFISSIONAIS DA SAUDE LTDA",
    cnpj: "(41681819000149)",
    mesRef: "01/2026",
    rba: "R$ 2.998.198,48",
    folha: "R$ 0,00",
    fatorR: "Não se aplica",
    ultimoPA: "",
  },
  {
    nome: "A E J SERVICOS DE SAUDE LTDA",
    cnpj: "(19446793000103)",
    mesRef: "01/2026",
    rba: "R$ 943.897,00",
    folha: "R$ 272.337,92",
    fatorR: "0.29 Anexo III",
    ultimoPA: "",
  },
  {
    nome: "ALATERE URGENCIA ODONTOLOGICA 24 HORAS LTDA",
    cnpj: "(38323669000197)",
    mesRef: "01/2026",
    rba: "R$ 68.000,32",
    folha: "R$ 0,00",
    fatorR: "Não se aplica",
    ultimoPA: "",
  },
];

const Index = () => {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            Fator R
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            O fator R é o cálculo utilizado para determinar em qual Anexo do regime tributário Simples Nacional uma empresa se enquadra.
          </p>
        </div>
        <div className="flex items-center gap-2 border-2 border-primary rounded-full px-5 py-3 text-sm shrink-0">
          <Info className="w-4 h-4 text-primary" />
          <div className="text-right">
            <p className="font-semibold text-foreground">Período de atualização mensal</p>
            <p className="text-muted-foreground">Entre os dias 10 e 15 de cada mês</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-0 mb-8">
        <div className="bg-accent/15 border border-accent/30 rounded-l-xl p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            Empresas igual ou maior que 0,28%
          </p>
          <p className="text-2xl font-bold text-foreground">134</p>
        </div>
        <div className="bg-card border-y border-border p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            Empresas menor que 0,28%
          </p>
          <p className="text-2xl font-bold text-foreground">3</p>
        </div>
        <div className="bg-card border border-border rounded-r-xl p-5">
          <p className="text-sm font-medium text-foreground mb-1">
            Empresas que não se aplica
          </p>
          <p className="text-2xl font-bold text-foreground">48</p>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between mb-6">
        <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
          Adicionar filtro
          <ChevronDown className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" />
            Baixar Todos
          </button>
          <button className="flex items-center gap-2 border border-primary text-primary px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors">
            <FileText className="w-4 h-4" />
            Exportar Todos
          </button>
        </div>
      </div>

      <hr className="border-border mb-6" />

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-4 pr-4 font-semibold text-foreground">Empresa</th>
              <th className="pb-4 px-4 font-semibold text-foreground">Mês de ref.</th>
              <th className="pb-4 px-4 font-semibold text-foreground">
                <div>RBA</div>
                <div className="text-xs font-normal text-muted-foreground">12 MESES</div>
              </th>
              <th className="pb-4 px-4 font-semibold text-foreground">
                <div>Folha</div>
                <div className="text-xs font-normal text-muted-foreground">11 MESES</div>
              </th>
              <th className="pb-4 px-4 font-semibold text-foreground">
                <div>Fator R</div>
                <div className="text-xs font-normal text-muted-foreground">ÚLTIMO MÊS</div>
              </th>
              <th className="pb-4 px-4 font-semibold text-foreground">
                <div>Último PA</div>
                <div className="text-xs font-normal text-muted-foreground">DECLARAÇÕES</div>
              </th>
              <th className="pb-4 pl-4 font-semibold text-foreground">Calcular</th>
            </tr>
          </thead>
          <tbody>
            {empresasData.map((empresa, index) => (
              <tr key={index} className="border-t border-border">
                <td className="py-5 pr-4">
                  <div className="font-medium text-foreground text-sm">{empresa.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{empresa.cnpj}</div>
                </td>
                <td className="py-5 px-4 text-foreground">{empresa.mesRef}</td>
                <td className="py-5 px-4 text-foreground">{empresa.rba}</td>
                <td className="py-5 px-4 text-foreground">{empresa.folha}</td>
                <td className="py-5 px-4 text-foreground">{empresa.fatorR}</td>
                <td className="py-5 px-4 text-foreground">{empresa.ultimoPA}</td>
                <td className="py-5 pl-4">
                  <div className="flex items-center gap-2">
                    <button className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="w-10 h-10 rounded-lg border border-border text-muted-foreground flex items-center justify-center hover:bg-secondary transition-colors">
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Index;
