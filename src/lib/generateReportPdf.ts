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
  const size = 240;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.68;
  const startAngle = -Math.PI / 2;

  // Full ring - light gray
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = "#c8cdd3";
  ctx.fill();

  // Economy portion - steel blue
  const econAngle = (percentage / 100) * Math.PI * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, startAngle, startAngle + econAngle);
  ctx.arc(cx, cy, innerR, startAngle + econAngle, startAngle, true);
  ctx.closePath();
  ctx.fillStyle = "#4a90a8";
  ctx.fill();

  // Small green accent sliver at the junction
  const accentWidth = 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, startAngle + econAngle - accentWidth, startAngle + econAngle + accentWidth);
  ctx.arc(cx, cy, innerR, startAngle + econAngle + accentWidth, startAngle + econAngle - accentWidth, true);
  ctx.closePath();
  ctx.fillStyle = "#7cb950";
  ctx.fill();

  // Center text
  ctx.fillStyle = "#4a90a8";
  ctx.font = `bold ${size * 0.2}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(percentage)}%`, cx, cy);

  return canvas.toDataURL("image/png");
}

function createMoneyIcon(): string {
  const canvas = document.createElement("canvas");
  const size = 120;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Background circle
  ctx.fillStyle = "#e8f5e9";
  ctx.beginPath();
  ctx.arc(60, 60, 50, 0, Math.PI * 2);
  ctx.fill();

  // Hand (simplified palm)
  ctx.fillStyle = "#f0c28d";
  ctx.beginPath();
  ctx.moveTo(20, 75);
  ctx.quadraticCurveTo(30, 55, 60, 50);
  ctx.quadraticCurveTo(90, 55, 100, 75);
  ctx.quadraticCurveTo(90, 95, 60, 100);
  ctx.quadraticCurveTo(30, 95, 20, 75);
  ctx.fill();

  // Green coin
  ctx.fillStyle = "#43a047";
  ctx.beginPath();
  ctx.arc(60, 40, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2e7d32";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dollar sign on coin
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 60, 41);

  // Bills behind
  ctx.fillStyle = "#66bb6a";
  ctx.fillRect(15, 60, 30, 6);
  ctx.fillRect(75, 60, 30, 6);

  return canvas.toDataURL("image/png");
}

function generatePage(doc: jsPDF, data: ReportData) {
  const pw = doc.internal.pageSize.getWidth();
  const margin = 22;
  const cw = pw - margin * 2;

  // ===== HEADER: "Análise Fator R" =====
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(58, 130, 110);
  doc.text("Análise Fator R", pw / 2 + 20, 28, { align: "center" });

  // ===== DESCRIPTION =====
  let y = 48;
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const cnpjF = formatCNPJ(data.cnpj);
  const desc = `Através da análise tributária realizada, informamos que sua empresa ${data.razaoSocial} inscrita no CNPJ n° ${cnpjF} terá na competência ${data.competencia} uma economia de:`;
  const lines = doc.splitTextToSize(desc, cw);
  doc.text(lines, margin, y);
  y += lines.length * 5 + 8;

  // ===== CALCULATIONS =====
  const aliqIII = calcularAliquotaEfetiva(data.rbt12, true);
  const aliqV = calcularAliquotaEfetiva(data.rbt12, false);
  const valS3 = aliqIII !== null ? data.faturamentoMes * (aliqIII / 100) : 0;
  const valS5 = aliqV !== null ? data.faturamentoMes * (aliqV / 100) : 0;
  const proLabPct = data.faturamentoMes > 0 ? (data.folhaMes / data.faturamentoMes) * 100 : 0;
  const total3 = valS3 + data.folhaMes;
  const total3Pct = (aliqIII ?? 0) + proLabPct;
  const economia = valS5 - total3;
  const econPct = valS5 > 0 ? (economia / valS5) * 100 : 0;

  // ===== TABLE LAYOUT =====
  const lbl1W = 24;  // "Quanto Paguel" / "O que era pra pagar"
  const lbl2W = 24;  // "Anexo III" / "Anexo V"
  const rh = 8;      // row height
  const dataStartX = margin + lbl1W + lbl2W;
  const dataW = cw - lbl1W - lbl2W;
  const col1W = dataW * 0.38;  // description
  const col2W = dataW * 0.18;  // percentage
  const col3W = dataW * 0.10;  // "R$"
  const col4W = dataW * 0.34;  // value

  // ===== ANEXO III TABLE (3 rows) =====
  const t3rows = 3;
  const t3h = t3rows * rh;

  // Left label cells with borders
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, lbl1W, t3h);
  doc.rect(margin + lbl1W, y, lbl2W, t3h);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Quanto", margin + lbl1W / 2, y + t3h / 2 - 2.5, { align: "center" });
  doc.text("Paguel", margin + lbl1W / 2, y + t3h / 2 + 2.5, { align: "center" });

  doc.setFontSize(10);
  doc.text("Anexo III", margin + lbl1W + lbl2W / 2, y + t3h / 2, { align: "center" });

  // Data rows - only bottom borders (horizontal lines)
  const rows3 = [
    { desc: "Simples", pct: aliqIII !== null ? `${aliqIII.toFixed(2)}%` : "N/A", val: fmtCur(valS3), bold: false },
    { desc: "Gastos com Pró-labore", pct: `${proLabPct.toFixed(2)}%`, val: fmtCur(data.folhaMes), bold: false },
    { desc: "Total", pct: `${total3Pct.toFixed(2)}%`, val: fmtCur(total3), bold: true },
  ];

  rows3.forEach((row, i) => {
    const ry = y + i * rh;

    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);

    // Description
    doc.text(row.desc, dataStartX + 3, ry + rh / 2 + 1);
    // Percentage
    doc.text(row.pct, dataStartX + col1W + col2W - 2, ry + rh / 2 + 1, { align: "right" });
    // "R$"
    doc.text("R$", dataStartX + col1W + col2W + 3, ry + rh / 2 + 1);
    // Value
    doc.text(row.val, dataStartX + dataW - 3, ry + rh / 2 + 1, { align: "right" });

    // Bottom border line
    doc.setLineWidth(row.bold ? 0.5 : 0.2);
    doc.line(dataStartX, ry + rh, dataStartX + dataW, ry + rh);
  });

  y += t3h + 5;

  // ===== ANEXO V TABLE (2 rows) =====
  const t5rows = 2;
  const t5h = t5rows * rh;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, lbl1W, t5h);
  doc.rect(margin + lbl1W, y, lbl2W, t5h);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("O que era", margin + lbl1W / 2, y + t5h / 2 - 2.5, { align: "center" });
  doc.text("pra pagar", margin + lbl1W / 2, y + t5h / 2 + 2.5, { align: "center" });

  doc.setFontSize(10);
  doc.text("Anexo V", margin + lbl1W + lbl2W / 2, y + t5h / 2, { align: "center" });

  const rows5 = [
    { desc: "Simples", pct: aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", val: fmtCur(valS5), bold: false },
    { desc: "Total", pct: aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", val: fmtCur(valS5), bold: true },
  ];

  rows5.forEach((row, i) => {
    const ry = y + i * rh;
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);

    doc.text(row.desc, dataStartX + 3, ry + rh / 2 + 1);
    doc.text(row.pct, dataStartX + col1W + col2W - 2, ry + rh / 2 + 1, { align: "right" });
    doc.text("R$", dataStartX + col1W + col2W + 3, ry + rh / 2 + 1);
    doc.text(row.val, dataStartX + dataW - 3, ry + rh / 2 + 1, { align: "right" });

    doc.setLineWidth(row.bold ? 0.5 : 0.2);
    doc.line(dataStartX, ry + rh, dataStartX + dataW, ry + rh);
  });

  y += t5h + 10;

  // ===== ECONOMIA BOX =====
  const boxW = cw * 0.75;
  const boxX = margin + (cw - boxW) / 2;
  const boxH = 42;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect(boxX, y, boxW, boxH);

  // "Economia de:" title
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Economia de:", boxX + boxW / 2, y + 11, { align: "center" });

  // Thin line under title
  doc.setLineWidth(0.3);
  doc.setDrawColor(180, 180, 180);
  doc.line(boxX + 10, y + 15, boxX + boxW - 10, y + 15);

  // Money icon
  try {
    const iconImg = createMoneyIcon();
    doc.addImage(iconImg, "PNG", boxX + 8, y + 19, 14, 14);
  } catch (_) { /* skip */ }

  // Big economy value
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  const econStr = economia > 0 ? `R$ ${fmtCur(economia)}` : "R$ 0,00";
  doc.text(econStr, boxX + 26, y + 32);

  // Donut chart
  if (econPct > 0) {
    try {
      const donutImg = createDonutImage(Math.min(econPct, 100));
      doc.addImage(donutImg, "PNG", boxX + boxW - 38, y + 16, 28, 28);
    } catch (_) { /* skip */ }
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
