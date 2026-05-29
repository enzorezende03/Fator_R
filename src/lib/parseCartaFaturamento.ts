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
  razaoSocial: string;
  rows: CartaFaturamentoRow[];
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

type PdfTextContentItem = {
  str?: string;
  transform?: number[];
};

const companyNameLabels = [
  "Raz[ãa]o\\s*Social",
  "Nome\\s*Empresarial",
  "Nome\\s+da\\s+Empresa",
  "Contribuinte",
  "Empresa",
  "Cliente",
];

const companyNameStopLabels = [
  "CNPJ",
  "CPF\\s*/\\s*CNPJ",
  "Inscri[çc][ãa]o",
  "Compet[eê]ncia",
  "Per[ií]odo",
  "Endere[çc]o",
  "Telefone",
  "E-?mail",
  "Faturamento",
  "Folha",
  "M[eê]s",
  "Valor",
  "Total",
];

const cleanCompanyName = (value: string) => {
  const labelPattern = companyNameLabels.join("|");
  const stopPattern = companyNameStopLabels.join("|");
  const cleaned = value
    .replace(new RegExp(`^(?:${labelPattern})\\s*:?\\s*`, "i"), "")
    .replace(new RegExp(`\\s+(?:${stopPattern})\\s*:?[\\s\\S]*$`, "i"), "")
    .replace(/^[\s:;\-–—|]+|[\s:;\-–—|]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .toUpperCase();

  if (cleaned.length < 3) return "";
  if (/^(CARTA|FATURAMENTO|CNPJ|TOTAL|COMPET[EÊ]NCIA|M[EÊ]S)\b/.test(cleaned)) return "";
  if (!/[A-ZÀ-Ú]/.test(cleaned) || /^\d+$/.test(cleaned.replace(/\D/g, ""))) return "";
  return cleaned;
};

const extractCompanyName = (fullText: string, sortedRows: TextItem[][]) => {
  const labelPattern = companyNameLabels.join("|");
  const stopPattern = companyNameStopLabels.join("|");
  const normalizedText = fullText.replace(/\s+/g, " ");
  const labeledMatch = normalizedText.match(
    new RegExp(`(?:${labelPattern})\\s*:?\\s*(.+?)(?=\\s+(?:${stopPattern})\\s*:?|$)`, "i")
  );
  const fromFullText = labeledMatch?.[1] ? cleanCompanyName(labeledMatch[1]) : "";
  if (fromFullText) return fromFullText;

  const rowTexts = sortedRows.map((items) => items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim());
  const labelRegex = new RegExp(`(?:${labelPattern})`, "i");

  for (let i = 0; i < rowTexts.length; i++) {
    const rowText = rowTexts[i];
    if (!labelRegex.test(rowText)) continue;

    const sameLine = cleanCompanyName(rowText.replace(new RegExp(`^.*?(?:${labelPattern})\\s*:?\\s*`, "i"), ""));
    if (sameLine) return sameLine;

    const nextLine = cleanCompanyName(rowTexts[i + 1] || "");
    if (nextLine) return nextLine;
  }

  const cnpjLine = rowTexts.find((rowText) => /CNPJ/i.test(rowText));
  if (cnpjLine) {
    const beforeCnpj = cleanCompanyName(cnpjLine.split(/CNPJ/i)[0] || "");
    if (beforeCnpj) return beforeCnpj;
  }

  return "";
};

export const parseCartaFaturamento = async (file: File): Promise<CartaFaturamentoData> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Extract all text items with positions across all pages
  const allItems: TextItem[] = [];
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const textItems = content.items as PdfTextContentItem[];
    const pageItems = textItems
      .filter((item) => item.str && item.str.trim() && item.transform)
      .map((item) => ({
        str: item.str.trim(),
        x: item.transform![4],
        y: Math.round(item.transform![5]), // round Y to group items on same line
      }));
    allItems.push(...pageItems);
    fullText += textItems.map((item) => item.str || "").join(" ") + "\n";
  }

  // Extract CNPJ
  const cnpjMatch = fullText.match(new RegExp("CNPJ\\s*:?\\s*([\\d./-]+)", "i"));
  const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, "") : "";

  // Group items by Y position (same row) with tolerance
  const rowMap = new Map<number, TextItem[]>();
  allItems.forEach((item) => {
    // Find existing row within tolerance of 3 units
    let rowKey = item.y;
    for (const key of rowMap.keys()) {
      if (Math.abs(key - item.y) <= 3) {
        rowKey = key;
        break;
      }
    }
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(item);
  });

  // Sort each row's items by X position (left to right)
  const sortedRows: TextItem[][] = [];
  rowMap.forEach((items) => {
    items.sort((a, b) => a.x - b.x);
    sortedRows.push(items);
  });

  // Sort rows by Y position (top to bottom — PDF Y is inverted, higher Y = higher on page)
  sortedRows.sort((a, b) => b[0].y - a[0].y);

  const razaoSocial = extractCompanyName(fullText, sortedRows);

  // Find rows that start with a month name pattern
  const monthPattern = new RegExp(`^(${Object.keys(monthNames).join("|")})$`, "i");
  const rows: CartaFaturamentoRow[] = [];

  for (const rowItems of sortedRows) {
    // Combine adjacent text items to form the full row text tokens
    const tokens: string[] = [];
    let current = "";
    for (const item of rowItems) {
      if (current && item.x - (rowItems[rowItems.indexOf(item) - 1]?.x ?? 0) > 5) {
        if (current.trim()) tokens.push(current.trim());
        current = item.str;
      } else {
        current += (current ? " " : "") + item.str;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    // Rebuild row text from items sorted by X position
    const rowText = rowItems.map((it) => it.str).join(" ");

    // Look for pattern: MonthName / Year followed by numeric values
    const lineMatch = rowText.match(
      new RegExp(
        `(${Object.keys(monthNames).join("|")})\\s*/\\s*(\\d{4})`,
        "i"
      )
    );

    if (!lineMatch) continue;

    const monthName = lineMatch[1].toLowerCase();
    const year = lineMatch[2];
    const month = monthNames[monthName];
    if (!month) continue;

    // Skip "Total do Período" rows
    if (rowText.toLowerCase().includes("total")) continue;

    // Extract all numeric values from this row (after the month/year)
    const monthYearEnd = rowText.indexOf(lineMatch[0]) + lineMatch[0].length;
    const afterMonthYear = rowText.substring(monthYearEnd);
    const numericValues: number[] = [];
    const numRegex = /[\d.,]+/g;
    let numMatch;
    while ((numMatch = numRegex.exec(afterMonthYear)) !== null) {
      const val = parseBRValue(numMatch[0]);
      if (val > 0) numericValues.push(val);
    }

    // We expect at least 2 values: Salário 12 meses, Faturamento 12 meses
    if (numericValues.length >= 2) {
      rows.push({
        mesReferencia: `${year}-${month}-01`,
        folhaSalarios: numericValues[0],  // Salário 12 meses (1st column)
        faturamento: numericValues[1],     // Faturamento 12 meses (2nd column)
      });
    }
  }

  return { cnpj, razaoSocial, rows };
};
