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

function drawDonut(percentage: number): string {
  const canvas = document.createElement("canvas");
  const s = 300;
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext("2d")!;
  const cx = s / 2, cy = s / 2;
  const oR = s / 2 - 10;
  const iR = oR * 0.66;
  const start = -Math.PI / 2;
  const angle = (percentage / 100) * Math.PI * 2;

  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, oR, 0, Math.PI * 2);
  ctx.arc(cx, cy, iR, Math.PI * 2, 0, true);
  ctx.closePath();
  ctx.fillStyle = "#bfc5cb";
  ctx.fill();

  // Main arc (steel blue)
  ctx.beginPath();
  ctx.arc(cx, cy, oR, start, start + angle);
  ctx.arc(cx, cy, iR, start + angle, start, true);
  ctx.closePath();
  ctx.fillStyle = "#5ba0b5";
  ctx.fill();

  // Green sliver at junction
  ctx.beginPath();
  ctx.arc(cx, cy, oR, start + angle - 0.04, start + angle + 0.06);
  ctx.arc(cx, cy, iR, start + angle + 0.06, start + angle - 0.04, true);
  ctx.closePath();
  ctx.fillStyle = "#8cc152";
  ctx.fill();

  // Percentage text in center
  ctx.fillStyle = "#5ba0b5";
  ctx.font = `bold ${s * 0.22}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.round(percentage)}%`, cx, cy);

  return canvas.toDataURL("image/png");
}

function drawMoneyIcon(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 150;
  canvas.height = 150;
  const ctx = canvas.getContext("2d")!;

  // Green bills
  ctx.fillStyle = "#4caf50";
  ctx.beginPath();
  ctx.roundRect(20, 50, 110, 55, 6);
  ctx.fill();
  ctx.fillStyle = "#388e3c";
  ctx.beginPath();
  ctx.roundRect(30, 55, 90, 45, 4);
  ctx.fill();

  // Dollar
  ctx.fillStyle = "#fff";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 75, 78);

  // Coin
  ctx.fillStyle = "#ffc107";
  ctx.beginPath();
  ctx.arc(95, 45, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f9a825";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.fillText("$", 95, 46);

  return canvas.toDataURL("image/png");
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const resp = await fetch("/images/logo-2msaude.png");
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function generatePage(doc: jsPDF, data: ReportData, logoBase64: string | null) {
  const pw = 210; // A4 width mm
  const m = 20;   // margin
  const cw = pw - m * 2; // content width = 170

  // === CALCULATIONS ===
  const aliqIII = calcularAliquotaEfetiva(data.rbt12, true);
  const aliqV = calcularAliquotaEfetiva(data.rbt12, false);
  const valS3 = aliqIII !== null ? data.faturamentoMes * (aliqIII / 100) : 0;
  const valS5 = aliqV !== null ? data.faturamentoMes * (aliqV / 100) : 0;
  const proLabPct = data.faturamentoMes > 0 ? (data.folhaMes / data.faturamentoMes) * 100 : 0;
  const total3Val = valS3 + data.folhaMes;
  const total3Pct = (aliqIII ?? 0) + proLabPct;
  const economia = valS5 - total3Val;
  const econPct = valS5 > 0 ? (economia / valS5) * 100 : 0;

  // === HEADER ===
  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", m, 15, 45, 18);
    } catch (_) { /* skip */ }
  }

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 140, 115);
  doc.text("Análise Fator R", pw / 2 + 20, 28, { align: "center" });

  // === DESCRIPTION ===
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const cnpjF = formatCNPJ(data.cnpj);
  const txt = `Através da análise tributária realizada, informamos que sua empresa ${data.razaoSocial} inscrita no CNPJ n° ${cnpjF} terá na competência ${data.competencia} uma economia de:`;
  const lines = doc.splitTextToSize(txt, cw);
  doc.text(lines, m, 50);

  let y = 50 + lines.length * 4.5 + 6;

  // === TABLE CONFIG ===
  const c1 = 22;  // label 1 width
  const c2 = 22;  // label 2 width (Anexo)
  const dX = m + c1 + c2; // data start X
  const dW = cw - c1 - c2; // data total width
  const rh = 7.5; // row height

  // Column boundaries within data area (4 columns: desc | pct | rs | val)
  const colDescW = dW * 0.40;
  const colPctW = dW * 0.15;
  const colRsW = dW * 0.10;
  const colValW = dW * 0.35;
  const colPctX = dX + colDescW;          // start of pct column
  const colRsX = colPctX + colPctW;       // start of R$ column
  const colValX = colRsX + colRsW;        // start of value column

  // === ANEXO III ===
  const r3data = 2; // data rows
  const h3data = r3data * rh;
  const h3full = h3data + rh; // includes total row

  // Label cell 1: "Quanto Paguei" (spans full height, no horizontal separator)
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(m, y, c1, h3full);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Quanto", m + c1 / 2, y + h3full / 2 - 2, { align: "center" });
  doc.text("Paguei", m + c1 / 2, y + h3full / 2 + 2, { align: "center" });

  // Label cell 2: "Anexo III" on top, "Total" on bottom
  doc.rect(m + c1, y, c2, h3full);
  doc.setFontSize(9);
  doc.text("Anexo III", m + c1 + c2 / 2, y + h3data / 2, { align: "center" });

  // Horizontal line separating Anexo III from Total in cell 2 only
  doc.setLineWidth(0.35);
  doc.line(m + c1, y + h3data, m + c1 + c2, y + h3data);

  // "Total" text in cell 2
  doc.setFontSize(9);
  doc.text("Total", m + c1 + c2 / 2, y + h3data + rh / 2, { align: "center" });

  // Data rows (Simples + Pró-labore)
  const data3rows = [
    { d: "Simples", p: aliqIII !== null ? `${aliqIII.toFixed(2)}%` : "N/A", v: fmtCur(valS3) },
    { d: "Gastos com Pró-labore", p: `${proLabPct.toFixed(2)}%`, v: fmtCur(data.folhaMes) },
  ];

  data3rows.forEach((row, i) => {
    const ry = y + i * rh;
    const ty = ry + rh / 2 + 1;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0);

    doc.text(row.d, dX + 3, ty);
    doc.text(row.p, colPctX + colPctW - 3, ty, { align: "right" });
    doc.text("R$", colRsX + 2, ty);
    doc.text(row.v, dX + dW - 3, ty, { align: "right" });

    doc.setLineWidth(0.25);
    doc.setDrawColor(0);
    doc.line(dX, ry + rh, dX + dW, ry + rh);
  });

  // Outer borders + column vertical borders for data area
  doc.setLineWidth(0.35);
  doc.setDrawColor(0);
  doc.line(dX, y, dX + dW, y);                    // top
  doc.line(dX, y, dX, y + h3full);                 // left (full height)
  doc.line(dX + dW, y, dX + dW, y + h3full);       // right (full height)
  doc.line(colPctX, y, colPctX, y + h3full);        // desc | pct (full height)
  doc.line(colRsX, y, colRsX, y + h3full);          // pct | R$ (full height)

  // Total row
  const totalY3 = y + h3data;
  const ty3 = totalY3 + rh / 2 + 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Total", dX + 3, ty3);
  doc.text(`${total3Pct.toFixed(2)}%`, colPctX + colPctW - 3, ty3, { align: "right" });
  doc.text("R$", colRsX + 2, ty3);
  doc.text(fmtCur(total3Val), dX + dW - 3, ty3, { align: "right" });

  // Total row horizontal separator in data area
  doc.setLineWidth(0.35);
  doc.line(dX, totalY3, dX + dW, totalY3);
  // Bottom border
  doc.line(dX, totalY3 + rh, dX + dW, totalY3 + rh);

  y = totalY3 + rh + 4;

  // === ANEXO V ===
  const r5data = 1;
  const h5data = r5data * rh;
  const h5full = h5data + rh; // includes total row

  // Label cell 1: "O que era pra pagar" (spans full height including total)
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(m, y, c1, h5full);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("O que era", m + c1 / 2, y + h5data / 2 - 2, { align: "center" });
  doc.text("pra pagar", m + c1 / 2, y + h5data / 2 + 2, { align: "center" });

  // Label cell 2: "Anexo V" (spans full height including total)
  doc.rect(m + c1, y, c2, h5full);
  doc.setFontSize(9);
  doc.text("Anexo V", m + c1 + c2 / 2, y + h5data / 2, { align: "center" });

  // Horizontal line separating data from total inside label cells
  doc.setLineWidth(0.35);
  doc.line(m, y + h5data, m + c1 + c2, y + h5data);

  // Data row (Simples only)
  const ry5 = y;
  const ty5 = ry5 + rh / 2 + 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Simples", dX + 3, ty5);
  doc.text(aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", colPctX + colPctW - 3, ty5, { align: "right" });
  doc.text("R$", colRsX + 2, ty5);
  doc.text(fmtCur(valS5), dX + dW - 3, ty5, { align: "right" });

  // Outer borders + column vertical borders for data area (full height)
  doc.setLineWidth(0.35);
  doc.setDrawColor(0);
  doc.line(dX, y, dX + dW, y);                    // top
  doc.line(dX, y, dX, y + h5full);                 // left
  doc.line(dX + dW, y, dX + dW, y + h5full);       // right
  doc.line(colPctX, y, colPctX, y + h5full);        // desc | pct
  doc.line(colRsX, y, colRsX, y + h5full);          // pct | R$

  // Total row
  const totalY5 = y + h5data;
  const tty5 = totalY5 + rh / 2 + 1;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Total", dX + 3, tty5);
  doc.text(aliqV !== null ? `${aliqV.toFixed(2)}%` : "N/A", colPctX + colPctW - 3, tty5, { align: "right" });
  doc.text("R$", colRsX + 2, tty5);
  doc.text(fmtCur(valS5), dX + dW - 3, tty5, { align: "right" });

  // Total row horizontal separators
  doc.setLineWidth(0.35);
  doc.line(dX, totalY5, dX + dW, totalY5);            // top separator
  doc.line(dX, totalY5 + rh, dX + dW, totalY5 + rh);  // bottom

  y = totalY5 + rh + 12;

  // === ECONOMIA BOX ===
  const boxW = cw * 0.72;
  const boxX = m + (cw - boxW) / 2;
  const boxH = 45;

  doc.setDrawColor(0);
  doc.setLineWidth(1);
  doc.rect(boxX, y, boxW, boxH);

  // "Economia de:" title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Economia de:", boxX + boxW / 2, y + 12, { align: "center" });

  // Underline
  const titleW = doc.getTextWidth("Economia de:");
  doc.setLineWidth(0.4);
  doc.setDrawColor(0);
  doc.line(boxX + boxW / 2 - titleW / 2, y + 14, boxX + boxW / 2 + titleW / 2, y + 14);

  // Money icon
  try {
    const iconImg = drawMoneyIcon();
    doc.addImage(iconImg, "PNG", boxX + 8, y + 20, 16, 16);
  } catch (_) { /* skip */ }

  // Economy value
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  const econStr = economia > 0 ? `R$ ${fmtCur(economia)}` : "R$ 0,00";
  doc.text(econStr, boxX + 28, y + 34);

  // Donut chart
  if (econPct > 0) {
    try {
      const donutImg = drawDonut(Math.min(Math.abs(econPct), 100));
      doc.addImage(donutImg, "PNG", boxX + boxW - 38, y + 16, 30, 30);
    } catch (_) { /* skip */ }
  } else {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("0%", boxX + boxW - 23, y + 32, { align: "center" });
  }
}

export async function generateReportPdf(data: ReportData): Promise<jsPDF> {
  const logo = await loadLogoBase64();
  const doc = new jsPDF("p", "mm", "a4");
  generatePage(doc, data, logo);
  return doc;
}

export async function generateBatchReportPdf(dataList: ReportData[]): Promise<jsPDF | null> {
  if (dataList.length === 0) return null;
  const logo = await loadLogoBase64();
  const doc = new jsPDF("p", "mm", "a4");
  dataList.forEach((data, idx) => {
    if (idx > 0) doc.addPage();
    generatePage(doc, data, logo);
  });
  return doc;
}
