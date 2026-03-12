import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

export interface PgdasData {
  cnpj: string; // digits only (basic or full)
  cnpjFull: string; // formatted
  periodoApuracao: string; // MM/YYYY
  receitasMensais: Record<string, number>; // "YYYY-MM-01" -> value
  folhaMensais: Record<string, number>; // "YYYY-MM-01" -> value
}

const parseBRValue = (val: string): number => {
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

const monthMap: Record<string, string> = {
  "01": "01", "02": "02", "03": "03", "04": "04",
  "05": "05", "06": "06", "07": "07", "08": "08",
  "09": "09", "10": "10", "11": "11", "12": "12",
};

/**
 * Parse month/value pairs from text like:
 * "01/2025 | 80.909,00 | 02/2025 | 82.005,00 ..."
 * or from lines like "01/2025 80.909,00 02/2025 82.005,00"
 */
const extractMonthValues = (text: string): Record<string, number> => {
  const result: Record<string, number> = {};
  // Match patterns like "MM/YYYY" followed by a BRL number
  const regex = /(\d{2})\/(\d{4})\s*\|?\s*([\d.,]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const month = match[1];
    const year = match[2];
    const value = parseBRValue(match[3]);
    if (monthMap[month] && value >= 0) {
      const key = `${year}-${month}-01`;
      result[key] = value;
    }
  }
  return result;
};

export const parsePgdasPdf = async (file: File): Promise<PgdasData> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  // Extract CNPJ - look for "CNPJ Básico:" or "CNPJ Estabelecimento:"
  let cnpjFull = "";
  const cnpjEstMatch = fullText.match(/CNPJ\s*(?:Estabelecimento|do Estabelecimento)\s*:?\s*([\d.\/\-]+)/i);
  const cnpjBasicoMatch = fullText.match(/CNPJ\s*B[aá]sico\s*:?\s*([\d.]+)/i);
  
  if (cnpjEstMatch) {
    cnpjFull = cnpjEstMatch[1].trim();
  } else if (cnpjBasicoMatch) {
    cnpjFull = cnpjBasicoMatch[1].trim();
  }

  const cnpj = cnpjFull.replace(/\D/g, "");

  // Extract PA (Período de Apuração)
  const paMatch = fullText.match(/Per[ií]odo\s*de\s*Apura[çc][aã]o\s*\(PA\)\s*:?\s*(\d{2}\/\d{4})/i);
  const periodoApuracao = paMatch ? paMatch[1] : "";

  // Split text into sections
  // Find "Receitas Brutas Anteriores" section (2.2.1 Mercado Interno)
  const receitasSection = fullText.match(
    /2\.2\.1\)\s*Mercado\s*Interno([\s\S]*?)(?:2\.2\.2\)|2\.3\))/i
  );
  
  // Find "Folha de Salários Anteriores" section (2.3)
  const folhaSection = fullText.match(
    /2\.3\)\s*Folha\s*de\s*Sal[aá]rios\s*Anteriores([\s\S]*?)(?:2\.3\.1\)|2\.4\))/i
  );

  const receitasMensais = receitasSection
    ? extractMonthValues(receitasSection[1])
    : {};

  const folhaMensais = folhaSection
    ? extractMonthValues(folhaSection[1])
    : {};

  return {
    cnpj,
    cnpjFull,
    periodoApuracao,
    receitasMensais,
    folhaMensais,
  };
};
