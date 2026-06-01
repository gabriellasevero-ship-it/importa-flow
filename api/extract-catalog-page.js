/**
 * Proxy same-origin para a Edge Function extract-catalog-page do Supabase.
 * Evita "Failed to fetch" quando extensões ou a rede bloqueiam chamadas diretas a *.supabase.co.
 */
export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" },
  },
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  const authHeader = req.headers.authorization;

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({
      error:
        "Servidor sem VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Configure na Vercel e faça redeploy.",
    });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  const target = new URL(`${supabaseUrl}/functions/v1/extract-catalog-page`);
  target.searchParams.set("forceFunctionRegion", "sa-east-1");

  try {
    const upstream = await fetch(target.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      console.error("extract-catalog-page upstream", upstream.status, text.slice(0, 500));
    }
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (text.trim()) {
      return res.end(text);
    }
    return res.end(
      JSON.stringify({
        error: upstream.ok
          ? "Resposta vazia do Supabase."
          : `Erro ${upstream.status} na Edge Function extract-catalog-page.`,
      }),
    );
  } catch (err) {
    console.error("extract-catalog-page proxy:", err);
    return res.status(502).json({
      error:
        "Não foi possível contactar o Supabase a partir do servidor. Tente novamente em instantes.",
    });
  }
}
