import jsPDF from "jspdf";
import { calcularAliquotaEfetiva } from "./aliquotaEfetiva";

export interface ReportData {
  razaoSocial: string;
  cnpj: string;
  competencia: string;
  rbt12: number;
  faturamentoMes: number;
  folhaMes: number;
}

const formatCNPJ = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

const fmtCur = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function createDonutImage(percentage: number): string {
  const canvas = document.createElement("canvas");
  const size = 200;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.7;
  const startAngle = -Math.PI / 2;

  // Full ring - light gray
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.fillStyle = "#d1d5db";
  ctx.fill();

  // Economy portion - teal/blue
  const econAngle = (percentage / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, startAngle, startAngle + econAngle);
  ctx.arc(cx, cy, innerR, startAngle + econAngle, startAngle, true);
  ctx.closePath();
  ctx.fillStyle = "#3b82a0";
  ctx.fill();

  // Small green accent at the border between portions
  const accentStart = startAngle + econAngle - 0.05;
  const accentEnd = startAngle + econAngle + 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, accentStart, accentEnd);
  ctx.arc(cx, cy, innerR, accentEnd, accentStart, true);
  ctx.closePath();
  ctx.fillStyle = "#86c067";
  ctx.fill();

  // Center text
  ctx.fillStyle = "#3b82a0";
  ctx.font = `bold ${size * 0.22}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(percentage)}%`, cx, cy);

  return canvas.toDataURL("image/png");
}

function createMoneyIcon(): string {
  const canvas = document.createElement("canvas");
  const size = 100;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Hand shape (simplified)
  ctx.fillStyle = "#e8a87c";
  ctx.beginPath();
  ctx.ellipse(50, 65, 35, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Coin circle
  ctx.fillStyle = "#4caf50";
  ctx.beginPath();
  ctx.arc(50, 35, 22, 0, Math.PI * 2);
  ctx.fill();

  // Dollar sign
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 50, 36);

  return canvas.toDataURL("image/png");
}

function generatePage(doc: jsPDF, data: ReportData) {
  const pw = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 25;
  const cw = pw - margin * 2; // content width

  // ===== HEADER =====
  // "Análise Fator R" in teal, centered-ish
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(58, 130, 110); // teal green matching the PDF
  doc.text("Análise Fator R", pw / 2, 32, { align: "center" });

  // ===== DESCRIPTION TEXT =====
  let y = 52;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const cnpjF = formatCNPJ(data.cnpj);
  const desc = `Através da análise tributária realizada, informamos que sua empresa ${data.razaoSocial} inscrita no CNPJ n° ${cnpjF} terá na competência ${data.competencia} uma economia de:`;
  const lines = doc.splitTextToSize(desc, cw);
  doc.text(lines, margin, y);
  y += lines.length * 5.5 + 10;

  // ===== CALCULATIONS =====
  const aliqIII = calcularAliquotaEfetiva(data.rbt12, true);
  const aliqV = calcularAliquotaEfetiva(data.rbt12, false);
  const valSimples3 = aliqIII !== null ? data.faturamentoMes * (aliqIII / 100) : 0;
  const valSimples5 = aliqV !== null ? data.faturamentoMes * (aliqV / 100) : 0;
  const proLabPct = data.faturamentoMes > 0 ? (data.folhaMes / data.faturamentoMes) * 100 : 0;
  const total3 = valSimples3 + data.folhaMes;
  const total3Pct = (aliqIII ?? 0) + proLabPct;
  const economia = valSimples5 - total3;
  const econPct = valSimples5 > 0 ? (economia / valSimples5) * 100 : 0;

  // ===== TABLE DIMENSIONS =====
  const labelW1 = 26; // "Quanto Paguei" / "O que era pra pagar"
  const labelW2 = 26; // "Anexo III" / "Anexo V"
  const descW = 42;
  const pctW = 20;
  const rsW = 12;
  const valW = cw - labelW1 - labelW2 - descW - pctW - rsW;
  const rh = 9; // row height
  const tableX = margin;

  // ===== ANEXO III TABLE =====
  const rows3 = 3;
  const t3h = rows3 * rh;

  // Left label cells - "Quanto Paguei"
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(tableX, y, labelW1, t3h);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Quanto", tableX + labelW1 / 2, y + t3h / 2 - 3, { align: "center" });
  doc.text("Paguei", tableX + labelW1 / 2, y + t3h / 2 + 3, { align: "center" });

  // "Anexo III" label
  doc.rect(tableX + labelW1, y, labelW2, t3h);
  doc.setFontSize(11);
  doc.text("Anexo III", tableX + labelW1 + labelW2 / 2, y + t3h / 2, { align: "center" });

  // Data rows
  const dataX = tableX + labelW1 + labelW2;
  const dataRows3 = [
    { desc: "Simples", pct: aliqIII !== null ? `${aliqIII.toFixed(2)}%` : "N/A", val: fmtCur(valSimples3), bold: false },
    { desc: "Gastos com Pró-labore", pct: `${proLabPct.toFixed(2)}%`, val: fmtCur(data.folhaMes), bold: false },
    { desc: "Total", pct: `${total3Pct.toFixed(2)}%`, val: fmtCur(total3), bold: true },
  ];

  dataRows3.forEach((row, i) => {
    const ry = y + i * rh;
    // Bottom border for each row
    doc.setLineWidth(0.2);
    doc.line(dataX, ry + rh, dataX + descW + pctW + rsW + valW, ry + rh);

    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    // Description
    doc.text(row.desc, dataX + 3, ry + rh / 2 + 1);
    // Percentage - right aligned
    doc.text(row.pct, dataX + descW + pctW - 2, ry + rh / 2 + 1, { align: "right" });
    // "R$"
    doc.text("R$", dataX + descW + pctW + 2, ry + rh / 2 + 1);
    // Value - right aligned
    doc.text(row.val, dataX + descW + pctW + rsW + valW - 2, ry + rh / 2 + 1, { align: "right" });
  });

  y += t3h + 6;

  // ===== ANEXO V TABLE =====
  const rows5 = 2;
  const t5h = rows5 * rh;

  // "O que era pra pagar"
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(tableX, y, labelW1, t5h);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("O que era", tableX + labelW1 / 2, y + t5h / 2 - 3, { align: "center" });
  doc.text("pra pagar", tableX + labelW1 / 2, y + t5h / 2 + 3, { align: "center" });

  // "Anexo V"
  doc.rect(tableX + labelW1, y, labelW2, t5h);
  doc.setFontSize(11);
  doc.text("Anexo V", tableX + labelW1 + labelW2 / 2, y + t5h / 2, { align: "center" });

  const dataRows5 = [
    { desc: "Simples", pct: aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", val: fmtCur(valSimples5), bold: false },
    { desc: "Total", pct: aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", val: fmtCur(valSimples5), bold: true },
  ];

  dataRows5.forEach((row, i) => {
    const ry = y + i * rh;
    doc.setLineWidth(0.2);
    doc.line(dataX, ry + rh, dataX + descW + pctW + rsW + valW, ry + rh);

    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);

    doc.text(row.desc, dataX + 3, ry + rh / 2 + 1);
    doc.text(row.pct, dataX + descW + pctW - 2, ry + rh / 2 + 1, { align: "right" });
    doc.text("R$", dataX + descW + pctW + 2, ry + rh / 2 + 1);
    doc.text(row.val, dataX + descW + pctW + rsW + valW - 2, ry + rh / 2 + 1, { align: "right" });
  });

  y += t5h + 12;

  // ===== ECONOMIA BOX =====
  const boxH = 45;
  doc.setFillColor(230, 235, 240);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, cw, boxH, 3, 3, "FD");

  // "Economia de:" title centered
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Economia de:", margin + cw / 2, y + 14, { align: "center" });

  // Money icon
  try {
    const iconImg = createMoneyIcon();
    doc.addImage(iconImg, "PNG", margin + 10, y + 20, 14, 14);
  } catch (e) {
    // skip icon if fails
  }

  // Big value
  doc.setFontSize(30);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  const econStr = economia > 0 ? `R$ ${fmtCur(economia)}` : "R$ 0,00";
  doc.text(econStr, margin + 30, y + 35);

  // Donut chart
  if (econPct > 0) {
    try {
      const donutImg = createDonutImage(Math.min(econPct, 100));
      doc.addImage(donutImg, "PNG", margin + cw - 42, y + 6, 34, 34);
    } catch (e) {
      // skip chart if fails
    }
  }
}

export function generateReportPdf(data: ReportData): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  generatePage(doc, data);
  return doc;
}

export function generateBatchReportPdf(dataList: ReportData[]): jsPDF | null {
  if (dataList.length === 0) return null;
  const doc = new jsPDF("p", "mm", "a4");
  dataList.forEach((data, idx) => {
    if (idx > 0) doc.addPage();
    generatePage(doc, data);
  });
  return doc;
}
