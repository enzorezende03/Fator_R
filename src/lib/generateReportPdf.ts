import jsPDF from "jspdf";
import { calcularAliquotaEfetiva } from "./aliquotaEfetiva";

interface ReportData {
  razaoSocial: string;
  cnpj: string;
  competencia: string; // "MM/YYYY"
  rbt12: number;
  faturamentoMes: number;
  folhaMes: number;
}

const formatCNPJ = (cnpj: string) =>
  cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function drawDonutChart(doc: jsPDF, x: number, y: number, radius: number, percentage: number) {
  // Create off-screen canvas for the donut chart
  const canvas = document.createElement("canvas");
  const size = radius * 4;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.65;

  // Background circle (light gray)
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerR, Math.PI * 2, 0, true);
  ctx.fillStyle = "#e5e7eb";
  ctx.fill();

  // Economy arc (accent color)
  const economyAngle = (percentage / 100) * Math.PI * 2;
  const startAngle = -Math.PI / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, startAngle, startAngle + economyAngle);
  ctx.arc(cx, cy, innerR, startAngle + economyAngle, startAngle, true);
  ctx.fillStyle = "#2a9d6e";
  ctx.fill();

  // Center text
  ctx.fillStyle = "#1a2744";
  ctx.font = `bold ${size * 0.18}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(percentage)}%`, cx, cy);

  const imgData = canvas.toDataURL("image/png");
  const imgSize = radius * 2;
  doc.addImage(imgData, "PNG", x - imgSize / 2, y - imgSize / 2, imgSize, imgSize);
}

function drawTable(
  doc: jsPDF,
  startX: number,
  startY: number,
  rows: { cells: string[]; bold?: boolean }[],
  colWidths: number[],
  headerBg?: string
) {
  const rowHeight = 10;
  const fontSize = 10;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  rows.forEach((row, rowIdx) => {
    const y = startY + rowIdx * rowHeight;

    // Row background
    if (row.bold) {
      doc.setFillColor(240, 240, 240);
      doc.rect(startX, y, totalWidth, rowHeight, "F");
    }

    // Cell borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    let cx = startX;
    colWidths.forEach((w) => {
      doc.rect(cx, y, w, rowHeight);
      cx += w;
    });

    // Cell text
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", row.bold ? "bold" : "normal");
    doc.setTextColor(30, 30, 30);

    cx = startX;
    row.cells.forEach((cell, ci) => {
      const textX = ci >= 2 ? cx + colWidths[ci] - 3 : cx + 3;
      const align = ci >= 2 ? "right" : "left";
      doc.text(cell, textX, y + rowHeight / 2 + 1, { align });
      cx += colWidths[ci];
    });
  });

  return startY + rows.length * rowHeight;
}

export function generateReportPdf(data: ReportData): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ---- Header ----
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(42, 157, 110); // accent green
  doc.text("Análise Fator R", pageWidth / 2, 30, { align: "center" });

  doc.setDrawColor(42, 157, 110);
  doc.setLineWidth(0.8);
  doc.line(margin, 36, pageWidth - margin, 36);

  // ---- Description text ----
  const aliqIII = calcularAliquotaEfetiva(data.rbt12, true);
  const aliqV = calcularAliquotaEfetiva(data.rbt12, false);

  const valorSimples3 = aliqIII !== null ? data.faturamentoMes * (aliqIII / 100) : 0;
  const valorSimples5 = aliqV !== null ? data.faturamentoMes * (aliqV / 100) : 0;
  const proLaborePercent = data.faturamentoMes > 0 ? (data.folhaMes / data.faturamentoMes) * 100 : 0;
  const totalAnexo3 = valorSimples3 + data.folhaMes;
  const totalAnexo3Percent = (aliqIII ?? 0) + proLaborePercent;
  const economia = valorSimples5 - totalAnexo3;
  const economiaPercent = valorSimples5 > 0 ? (economia / valorSimples5) * 100 : 0;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  const cnpjFormatado = formatCNPJ(data.cnpj);
  const descText = `Através da análise tributária realizada, informamos que a empresa ${data.razaoSocial} inscrita no CNPJ n° ${cnpjFormatado} terá na competência ${data.competencia} uma economia de:`;

  const lines = doc.splitTextToSize(descText, contentWidth);
  doc.text(lines, margin, 48);

  let currentY = 48 + lines.length * 6 + 8;

  // ---- Anexo III table ("Quanto Paguei") ----
  const labelColW = 28;
  const anexoColW = 22;
  const descColW = 45;
  const percColW = 22;
  const valColW = contentWidth - labelColW - anexoColW - descColW - percColW;

  // Section label
  doc.setFillColor(26, 39, 68); // primary dark
  doc.rect(margin, currentY, labelColW + anexoColW, 10 * 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Quanto", margin + (labelColW + anexoColW) / 2, currentY + 12, { align: "center" });
  doc.text("Paguei", margin + (labelColW + anexoColW) / 2, currentY + 19, { align: "center" });

  // Anexo III badge
  doc.setFillColor(42, 157, 110);
  doc.roundedRect(margin + 3, currentY + 3, labelColW + anexoColW - 6, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("Anexo III", margin + (labelColW + anexoColW) / 2, currentY + 8.5, { align: "center" });

  // Table rows for Anexo III
  const tableX = margin + labelColW + anexoColW;
  const colWidths3 = [descColW, percColW, valColW];

  const endY3 = drawTable(doc, tableX, currentY, [
    { cells: ["Simples", aliqIII !== null ? `${aliqIII.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples3)}`] },
    { cells: ["Gastos com Pró-labore", `${proLaborePercent.toFixed(2)}%`, `R$ ${formatCurrency(data.folhaMes)}`] },
    { cells: ["Total", `${totalAnexo3Percent.toFixed(2)}%`, `R$ ${formatCurrency(totalAnexo3)}`], bold: true },
  ], colWidths3);

  currentY = endY3 + 6;

  // ---- Anexo V table ("O que era pra pagar") ----
  doc.setFillColor(26, 39, 68);
  doc.rect(margin, currentY, labelColW + anexoColW, 10 * 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("O que era", margin + (labelColW + anexoColW) / 2, currentY + 7, { align: "center" });
  doc.text("pra pagar", margin + (labelColW + anexoColW) / 2, currentY + 14, { align: "center" });

  const colWidths5 = [descColW, percColW, valColW];
  const endY5 = drawTable(doc, tableX, currentY, [
    { cells: ["Simples", aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples5)}`] },
    { cells: ["Total", aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples5)}`], bold: true },
  ], colWidths5);

  currentY = endY5 + 10;

  // ---- Economy section ----
  const economyBoxH = 50;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, currentY, contentWidth, economyBoxH, 4, 4, "F");
  doc.setDrawColor(42, 157, 110);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, economyBoxH, 4, 4, "S");

  // "Economia de:" title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Economia de:", margin + contentWidth / 2 - 15, currentY + 12, { align: "center" });

  // Money icon placeholder + value
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(42, 157, 110);
  const economiaStr = economia > 0 ? `R$ ${formatCurrency(economia)}` : `R$ 0,00`;
  doc.text(economiaStr, margin + 15, currentY + 35);

  // Donut chart
  if (economiaPercent > 0) {
    drawDonutChart(doc, margin + contentWidth - 30, currentY + economyBoxH / 2, 18, Math.min(economiaPercent, 100));
  }

  // ---- Footer ----
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Relatório gerado automaticamente pelo sistema Fator R", pageWidth / 2, 285, { align: "center" });

  return doc;
}

export function generateBatchReportPdf(dataList: ReportData[]): jsPDF | null {
  if (dataList.length === 0) return null;

  const firstDoc = generateReportPdf(dataList[0]);

  for (let i = 1; i < dataList.length; i++) {
    const tempDoc = generateReportPdf(dataList[i]);
    // Get the first page of the temp doc and add to main doc
    firstDoc.addPage();
    // We need to regenerate on the existing doc instead
  }

  // Better approach: generate all pages in one doc
  const doc = new jsPDF("p", "mm", "a4");
  
  dataList.forEach((data, idx) => {
    if (idx > 0) doc.addPage();
    generatePageContent(doc, data);
  });

  return doc;
}

function generatePageContent(doc: jsPDF, data: ReportData) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const aliqIII = calcularAliquotaEfetiva(data.rbt12, true);
  const aliqV = calcularAliquotaEfetiva(data.rbt12, false);

  const valorSimples3 = aliqIII !== null ? data.faturamentoMes * (aliqIII / 100) : 0;
  const valorSimples5 = aliqV !== null ? data.faturamentoMes * (aliqV / 100) : 0;
  const proLaborePercent = data.faturamentoMes > 0 ? (data.folhaMes / data.faturamentoMes) * 100 : 0;
  const totalAnexo3 = valorSimples3 + data.folhaMes;
  const totalAnexo3Percent = (aliqIII ?? 0) + proLaborePercent;
  const economia = valorSimples5 - totalAnexo3;
  const economiaPercent = valorSimples5 > 0 ? (economia / valorSimples5) * 100 : 0;

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(42, 157, 110);
  doc.text("Análise Fator R", pageWidth / 2, 30, { align: "center" });

  doc.setDrawColor(42, 157, 110);
  doc.setLineWidth(0.8);
  doc.line(margin, 36, pageWidth - margin, 36);

  // Description
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const cnpjFormatado = formatCNPJ(data.cnpj);
  const descText = `Através da análise tributária realizada, informamos que a empresa ${data.razaoSocial} inscrita no CNPJ n° ${cnpjFormatado} terá na competência ${data.competencia} uma economia de:`;
  const lines = doc.splitTextToSize(descText, contentWidth);
  doc.text(lines, margin, 48);

  let currentY = 48 + lines.length * 6 + 8;

  // Anexo III section
  const labelColW = 50;
  const descColW = 45;
  const percColW = 22;
  const valColW = contentWidth - labelColW - descColW - percColW;
  const tableX = margin + labelColW;

  doc.setFillColor(26, 39, 68);
  doc.rect(margin, currentY, labelColW, 10 * 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Quanto", margin + labelColW / 2, currentY + 8, { align: "center" });
  doc.setFontSize(9);
  doc.text("Paguei", margin + labelColW / 2, currentY + 14, { align: "center" });
  doc.setFillColor(42, 157, 110);
  doc.roundedRect(margin + 5, currentY + 18, labelColW - 10, 8, 2, 2, "F");
  doc.setFontSize(9);
  doc.text("Anexo III", margin + labelColW / 2, currentY + 23.5, { align: "center" });

  drawTable(doc, tableX, currentY, [
    { cells: ["Simples", aliqIII !== null ? `${aliqIII.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples3)}`] },
    { cells: ["Gastos com Pró-labore", `${proLaborePercent.toFixed(2)}%`, `R$ ${formatCurrency(data.folhaMes)}`] },
    { cells: ["Total", `${totalAnexo3Percent.toFixed(2)}%`, `R$ ${formatCurrency(totalAnexo3)}`], bold: true },
  ], [descColW, percColW, valColW]);

  currentY += 30 + 6;

  // Anexo V section
  doc.setFillColor(26, 39, 68);
  doc.rect(margin, currentY, labelColW, 10 * 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("O que era", margin + labelColW / 2, currentY + 7, { align: "center" });
  doc.setFontSize(9);
  doc.text("pra pagar", margin + labelColW / 2, currentY + 14, { align: "center" });

  drawTable(doc, tableX, currentY, [
    { cells: ["Simples", aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples5)}`] },
    { cells: ["Total", aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", `R$ ${formatCurrency(valorSimples5)}`], bold: true },
  ], [descColW, percColW, valColW]);

  currentY += 20 + 10;

  // Economy box
  const economyBoxH = 50;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, currentY, contentWidth, economyBoxH, 4, 4, "F");
  doc.setDrawColor(42, 157, 110);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, economyBoxH, 4, 4, "S");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("Economia de:", margin + contentWidth / 2 - 15, currentY + 12, { align: "center" });

  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(42, 157, 110);
  const economiaStr = economia > 0 ? `R$ ${formatCurrency(economia)}` : `R$ 0,00`;
  doc.text(economiaStr, margin + 15, currentY + 35);

  if (economiaPercent > 0) {
    drawDonutChart(doc, margin + contentWidth - 30, currentY + economyBoxH / 2, 18, Math.min(economiaPercent, 100));
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text("Relatório gerado automaticamente pelo sistema Fator R", pageWidth / 2, 285, { align: "center" });
}

export type { ReportData };
