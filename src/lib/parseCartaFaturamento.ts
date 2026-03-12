import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

const monthNames: Record<string, string> = {
  janeiro: "01", fevereiro: "02", "março": "03", marco: "03",
  abril: "04", maio: "05", junho: "06", julho: "07",
  agosto: "08", setembro: "09", outubro: "10",
  novembro: "11", dezembro: "12",
};

const parseBRValue = (val: string): number => {
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

export interface CartaFaturamentoRow {
  mesReferencia: string; // "YYYY-MM-01"
  folhaSalarios: number;
  faturamento: number;
}

export interface CartaFaturamentoData {
  cnpj: string;
  rows: CartaFaturamentoRow[];
}

export const parseCartaFaturamento = async (file: File): Promise<CartaFaturamentoData> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ");
    fullText += pageText + "\n";
  }

  // Extract CNPJ
  const cnpjMatch = fullText.match(/CNPJ\s*:\s*([\d.\/\-]+)/i);
  const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : "";

  // Extract rows: "MêsNome/Ano  Salário12m  Faturamento12m  MédiaAnexoIII  Fat12mAnexoIII"
  // The PDF has 4 numeric columns per row. We want columns 1 (Salário 12 meses) and 2 (Faturamento 12 meses).
  const rows: CartaFaturamentoRow[] = [];

  // Match month/year followed by 4 BRL values (we capture the first two)
  const regex = new RegExp(
    `(${Object.keys(monthNames).join("|")})\\s*/\\s*(\\d{4})\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)`,
    "gi"
  );

  let match;
  while ((match = regex.exec(fullText)) !== null) {
    const monthName = match[1].toLowerCase();
    const year = match[2];
    const month = monthNames[monthName];
    if (!month) continue;

    // Column 1: Salário 12 meses → folhaSalarios
    // Column 2: Faturamento 12 meses → faturamento
    const folhaSalarios = parseBRValue(match[3]);
    const faturamento = parseBRValue(match[4]);

    rows.push({
      mesReferencia: `${year}-${month}-01`,
      folhaSalarios,
      faturamento,
    });
  }

  return { cnpj, rows };
};
