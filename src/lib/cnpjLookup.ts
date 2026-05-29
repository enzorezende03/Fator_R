const isIncompleteCompanyName = (name: string) => {
  const normalized = name.trim().toUpperCase().replace(/\s+/g, " ");
  const words = normalized.split(" ").filter(Boolean);

  return (
    !normalized ||
    words.length <= 2 ||
    /^(DR|DRA|DR\.|DRA\.|CLIENTE|EMPRESA)\b/.test(normalized)
  );
};

export const shouldReplaceCompanyName = (currentName?: string | null, candidateName?: string | null) => {
  const current = (currentName || "").trim().toUpperCase().replace(/\s+/g, " ");
  const candidate = (candidateName || "").trim().toUpperCase().replace(/\s+/g, " ");

  if (!candidate || candidate.length < 3) return false;
  if (!current) return true;
  if (candidate === current) return false;
  return candidate.length > current.length;
};

export const lookupCompanyNameByCnpj = async (cnpj: string) => {
  const cnpjDigits = cnpj.replace(/\D/g, "");
  if (cnpjDigits.length !== 14) return "";

  try {
    const response = await fetch(`https://minhareceita.org/${cnpjDigits}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return "";

    const data = await response.json();
    return String(data.razao_social || data.nome_fantasia || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  } catch {
    return "";
  }
};

export const resolveBestCompanyName = async (cnpj: string, parsedName?: string | null, currentName?: string | null) => {
  const parsed = (parsedName || "").trim().toUpperCase().replace(/\s+/g, " ");
  const current = (currentName || "").trim().toUpperCase().replace(/\s+/g, " ");

  if (parsed && !isIncompleteCompanyName(parsed) && parsed.length >= current.length) {
    return parsed;
  }

  const official = await lookupCompanyNameByCnpj(cnpj);
  if (official && shouldReplaceCompanyName(current || parsed, official)) {
    return official;
  }

  if (shouldReplaceCompanyName(current, parsed)) {
    return parsed;
  }

  return current || parsed;
};