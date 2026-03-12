type Faixa = { limite: number; aliquota: number; deducao: number };

const ANEXO_III: Faixa[] = [
  { limite: 180000, aliquota: 0.06, deducao: 0 },
  { limite: 360000, aliquota: 0.112, deducao: 9360 },
  { limite: 720000, aliquota: 0.135, deducao: 17640 },
  { limite: 1800000, aliquota: 0.16, deducao: 35640 },
  { limite: 3600000, aliquota: 0.21, deducao: 125640 },
  { limite: 4800000, aliquota: 0.33, deducao: 648000 },
];

const ANEXO_V: Faixa[] = [
  { limite: 180000, aliquota: 0.155, deducao: 0 },
  { limite: 360000, aliquota: 0.18, deducao: 4500 },
  { limite: 720000, aliquota: 0.195, deducao: 9900 },
  { limite: 1800000, aliquota: 0.205, deducao: 17100 },
  { limite: 3600000, aliquota: 0.23, deducao: 62100 },
  { limite: 4800000, aliquota: 0.305, deducao: 540000 },
];

function getFaixa(rbt12: number, faixas: Faixa[]): Faixa | null {
  for (const f of faixas) {
    if (rbt12 <= f.limite) return f;
  }
  return null;
}

export function calcularAliquotaEfetiva(rbt12: number, isAnexoIII: boolean): number | null {
  if (rbt12 <= 0) return null;
  const faixas = isAnexoIII ? ANEXO_III : ANEXO_V;
  const faixa = getFaixa(rbt12, faixas);
  if (!faixa) return null;
  return ((rbt12 * faixa.aliquota - faixa.deducao) / rbt12) * 100;
}
