import { supabase } from "@/integrations/supabase/client";

const normalizeCompanyName = (name?: string | null) =>
  (name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

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
  const current = normalizeCompanyName(currentName);
  const candidate = normalizeCompanyName(candidateName);

  if (!candidate || candidate.length < 3) return false;
  if (!current) return true;
  if (candidate === current) return false;
  if (isIncompleteCompanyName(current) && !isIncompleteCompanyName(candidate)) return true;
  return candidate.length > current.length;
};

export const lookupCompanyNameByCnpj = async (cnpj: string) => {
  const cnpjDigits = cnpj.replace(/\D/g, "");
  if (cnpjDigits.length !== 14) return "";

  try {
    const { data, error } = await supabase.functions.invoke("lookup-cnpj", {
      body: { cnpj: cnpjDigits },
    });

    if (!error) {
      const name = normalizeCompanyName(data?.razao_social || data?.nome_fantasia || data?.nome_socio);
      if (name) return name;
    }
  } catch {
    // Fallback abaixo para manter a importação funcionando se a função estiver indisponível.
  }

  try {
    const response = await fetch(`https://minhareceita.org/${cnpjDigits}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return "";

    const data = await response.json();
    return normalizeCompanyName(data.razao_social || data.nome_fantasia || data.qsa?.[0]?.nome_socio);
  } catch {
    return "";
  }
};

export const resolveBestCompanyName = async (cnpj: string, parsedName?: string | null, currentName?: string | null) => {
  const parsed = normalizeCompanyName(parsedName);
  const current = normalizeCompanyName(currentName);

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