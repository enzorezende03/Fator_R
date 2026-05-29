const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const normalize = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 Lovable CNPJ Lookup",
    },
  });

  if (!response.ok) throw new Error(`Consulta CNPJ falhou: ${response.status}`);
  return response.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    const cnpjDigits = String(cnpj || "").replace(/\D/g, "");

    if (cnpjDigits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: Record<string, unknown> | null = null;
    for (const url of [
      `https://minhareceita.org/${cnpjDigits}`,
      `https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`,
    ]) {
      try {
        data = await fetchJson(url);
        break;
      } catch {
        data = null;
      }
    }

    if (!data) {
      return new Response(JSON.stringify({ error: "CNPJ não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qsa = Array.isArray(data.qsa) ? data.qsa : [];
    const firstPartner = qsa[0] as Record<string, unknown> | undefined;

    return new Response(
      JSON.stringify({
        cnpj: cnpjDigits,
        razao_social: normalize(data.razao_social),
        nome_fantasia: normalize(data.nome_fantasia),
        nome_socio: normalize(firstPartner?.nome_socio),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});