import * as pdfjsLib from "pdfjs-dist";

// Use CDN worker to avoid bundling issues
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;

export interface PgdasData {
  cnpj: string; // digits only (basic or full)
  cnpjFull: string; // formatted
  razaoSocial: string;
  periodoApuracao: string; // MM/YYYY
  numeroRecibo: string;
  numeroDeclaracao: string;
  dataTransmissao: string;
  receitaPa: number; // Receita Bruta do PA
  rbt12: number; // Receita Bruta dos 12 meses anteriores
  rba: number; // Receita Bruta Acumulada no ano
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

  // Extract CNPJ - try Matriz, Estabelecimento, then Básico
  let cnpjFull = "";
  const cnpjMatrizMatch = fullText.match(/CNPJ\s*Matriz\s*:?\s*([\d.\/\-]+)/i);
  const cnpjEstMatch = fullText.match(/CNPJ\s*(?:Estabelecimento|do Estabelecimento)\s*:?\s*([\d.\/\-]+)/i);
  const cnpjBasicoMatch = fullText.match(/CNPJ\s*B[aá]sico\s*:?\s*([\d.]+)/i);

  if (cnpjMatrizMatch) cnpjFull = cnpjMatrizMatch[1].trim();
  else if (cnpjEstMatch) cnpjFull = cnpjEstMatch[1].trim();
  else if (cnpjBasicoMatch) cnpjFull = cnpjBasicoMatch[1].trim();

  const cnpj = cnpjFull.replace(/\D/g, "");

  // Razão social ("Nome empresarial:")
  const nomeMatch = fullText.match(/Nome\s+empresarial\s*:?\s*([^\n]+?)(?:\s+Data\s+de\s+abertura|\s{3,}|\n)/i);
  const razaoSocial = nomeMatch ? nomeMatch[1].trim() : "";

  // Período de Apuração - aceita "(PA): MM/YYYY" ou "DD/MM/YYYY a DD/MM/YYYY"
  let periodoApuracao = "";
  const paRangeMatch = fullText.match(/Per[ií]odo\s*de\s*Apura[çc][aã]o\s*:?\s*\d{2}\/(\d{2})\/(\d{4})\s*a\s*\d{2}\/\d{2}\/\d{4}/i);
  const paShortMatch = fullText.match(/Per[ií]odo\s*de\s*Apura[çc][aã]o\s*\(PA\)\s*:?\s*(\d{2}\/\d{4})/i);
  if (paRangeMatch) periodoApuracao = `${paRangeMatch[1]}/${paRangeMatch[2]}`;
  else if (paShortMatch) periodoApuracao = paShortMatch[1];

  // Número do Recibo
  const reciboMatch = fullText.match(/N[úu]mero\s*do\s*Recibo\s*:?\s*([\d.\-]+)/i);
  const numeroRecibo = reciboMatch ? reciboMatch[1].trim() : "";

  // Número da Declaração
  const declMatch = fullText.match(/N[ºo]\s*da\s*Declara[çc][aã]o\s*:?\s*(\d+)/i) ||
    fullText.match(/N[úu]mero\s*da\s*Declara[çc][aã]o\s*:?\s*(\d+)/i);
  const numeroDeclaracao = declMatch ? declMatch[1].trim() : "";

  // Data de transmissão
  const transmMatch = fullText.match(/transmiss[aã]o\s*da\s*Declara[çc][aã]o\s*:?\s*(\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}:\d{2})?)/i);
  const dataTransmissao = transmMatch ? transmMatch[1].trim() : "";

  // Receita Bruta do PA (RPA) — tenta múltiplos padrões
  let receitaPa = 0;
  const rpaPatterns = [
    /\(RPA\)[^\d\-]*([\d.,]+)/i,
    /Receita\s*Bruta\s*do\s*PA\s*\(RPA\)[^\d\-]*([\d.,]+)/i,
    /Receita\s*Bruta\s*do\s*PA[^\d\-]*([\d.,]+)/i,
    /RPA\s*[:\-]?\s*R?\$?\s*([\d.,]+)/i,
  ];
  for (const pat of rpaPatterns) {
    const m = fullText.match(pat);
    if (m) {
      const v = parseBRValue(m[1]);
      if (v > 0) { receitaPa = v; break; }
    }
  }

  // RBT12
  const rbt12Match = fullText.match(/\(RBT12\)[^\d]*([\d.,]+)/i);
  const rbt12 = rbt12Match ? parseBRValue(rbt12Match[1]) : 0;

  // RBA
  const rbaMatch = fullText.match(/\(RBA\)[^\d]*([\d.,]+)/i);
  const rba = rbaMatch ? parseBRValue(rbaMatch[1]) : 0;

  // Receitas Brutas Anteriores - 2.2.1 Mercado Interno
  const receitasSection = fullText.match(
    /2\.2\.1\)?\s*Mercado\s*Interno([\s\S]*?)(?:2\.2\.2\)|2\.3\))/i
  );

  // Folha de Salários Anteriores - 2.3
  const folhaSection = fullText.match(
    /2\.3\)?\s*Folha\s*de\s*Sal[aá]rios\s*Anteriores([\s\S]*?)(?:2\.3\.1\)|2\.4\))/i
  );

  const receitasMensais = receitasSection
    ? extractMonthValues(receitasSection[1])
    : {};

  const folhaMensais = folhaSection
    ? extractMonthValues(folhaSection[1])
    : {};

  // Adiciona a receita do PA atual ao mapa mensal
  if (periodoApuracao && receitaPa > 0) {
    const [mm, yyyy] = periodoApuracao.split("/");
    receitasMensais[`${yyyy}-${mm}-01`] = receitaPa;
  }

  return {
    cnpj,
    cnpjFull,
    razaoSocial,
    periodoApuracao,
    numeroRecibo,
    numeroDeclaracao,
    dataTransmissao,
    receitaPa,
    rbt12,
    rba,
    receitasMensais,
    folhaMensais,
  };
};
