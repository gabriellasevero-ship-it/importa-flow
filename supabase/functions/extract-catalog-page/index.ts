import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-region",
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Modelos candidatos (do preferido ao fallback). Se um devolver 404 (modelo
 * indisponível para a chave/projeto), tentamos o próximo. Pode forçar um modelo
 * específico definindo o segredo GEMINI_MODEL.
 */
const GEMINI_MODEL_CANDIDATES: string[] = (() => {
  const override = Deno.env.get("GEMINI_MODEL")?.trim();
  const defaults = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
  if (override) return [override, ...defaults.filter((m) => m !== override)];
  return defaults;
})();

type ExtractBody = {
  imageBase64?: string;
  mimeType?: string;
  nativeText?: string;
  categoryNames?: string[];
  catalogContext?: string;
};

type GeminiBox = { ymin: number; xmin: number; ymax: number; xmax: number };

type GeminiProduct = {
  code?: string;
  name?: string;
  description?: string;
  price?: number;
  boxQty?: number;
  dimensions?: string;
  material?: string;
  category?: string;
  box?: GeminiBox;
};

/** Box de foto em frações 0–1 da página (left/top/right/bottom), pronta para cropImageBlobRect. */
type NormalizedBox = { left: number; top: number; right: number; bottom: number };

type ExtractedProduct = {
  code: string;
  name: string;
  description: string;
  price: number;
  minOrder: number;
  dimensions: string;
  material: string;
  category: string;
  box: NormalizedBox | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const GEMINI_COORD_MAX = 1000;

/** Converte a box do Gemini (0–1000, [ymin,xmin,ymax,xmax]) para frações 0–1 ordenadas. */
function normalizeBox(box: GeminiBox | undefined): NormalizedBox | null {
  if (!box) return null;
  const toFrac = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, n / GEMINI_COORD_MAX));
  };
  const top = toFrac(box.ymin);
  const left = toFrac(box.xmin);
  const bottom = toFrac(box.ymax);
  const right = toFrac(box.xmax);
  if (top == null || left == null || bottom == null || right == null) return null;
  const t = Math.min(top, bottom);
  const b = Math.max(top, bottom);
  const l = Math.min(left, right);
  const r = Math.max(left, right);
  if (r - l < 0.02 || b - t < 0.02) return null;
  return { left: l, top: t, right: r, bottom: b };
}

function buildPrompt(
  nativeText: string,
  categoryNames: string[],
  catalogContext: string,
): string {
  const cats = categoryNames.length
    ? categoryNames.map((c) => `"${c}"`).join(", ")
    : "(nenhuma cadastrada)";
  const text = nativeText.trim().slice(0, 12_000);
  const context = catalogContext.trim().slice(0, 2_000);
  return [
    "Você é um extrator de catálogos de produtos importados.",
    "A imagem é UMA página de um catálogo de produtos.",
    "Abaixo está o texto extraído nativamente do PDF desta página (mais confiável que a imagem para ler textos, códigos e preços):",
    "<TEXTO_DA_PAGINA>",
    text || "(sem texto selecionável)",
    "</TEXTO_DA_PAGINA>",
    "",
    "Contexto do catálogo (texto da capa/divisórias). A CATEGORIA/tema dos produtos costuma estar aqui (ex.: no título da capa):",
    "<CONTEXTO_DO_CATALOGO>",
    context || "(sem contexto)",
    "</CONTEXTO_DO_CATALOGO>",
    "",
    "Identifique TODOS os produtos distintos visíveis nesta página e retorne um objeto JSON.",
    "Para cada produto preencha:",
    '- code: o código/REF do produto (ex.: "DT-100"). NÃO inclua o prefixo "REF:".',
    "- name: o título curto do produto (sem código nem preço). Use capitalização normal",
    '  (ex.: "Jogo de Quebra-Cabeça"), NUNCA tudo em CAIXA ALTA, mesmo que no catálogo esteja em maiúsculas.',
    "- description: TODO o restante das informações do produto que NÃO sejam código, preço,",
    "  título, quantidade por caixa, material e dimensões. Ex.: características, composição,",
    "  cores, itens inclusos, modo de uso, observações. Junte em um texto. Se não houver, use string vazia.",
    "- price: o preço unitário como número (ponto decimal, ex.: 12.9). Use 0 se não houver.",
    '- boxQty: quantidade de peças por caixa (ex.: "CAIXA: 48 PÇS" => 48). Use 1 se não houver.',
    '- dimensions: as medidas, se houver (ex.: "18x18cm").',
    "- material: o material, se mencionado; senão string vazia.",
    "- category: a categoria do produto. Use o tema indicado no CONTEXTO_DO_CATALOGO (título da capa)",
    "  ou em títulos de seção visíveis na página.",
    `  Se houver uma categoria equivalente nesta lista, retorne EXATAMENTE o nome dela: [${cats}].`,
    "  Caso contrário, retorne a categoria identificada no catálogo (ex.: o título da capa). Nunca deixe vazio se houver um tema claro.",
    "- box: a bounding box da FOTO do produto (não do texto) em coordenadas inteiras de 0 a 1000",
    "  no formato { ymin, xmin, ymax, xmax }, relativas à imagem enviada (0,0 = canto superior esquerdo).",
    "Se um produto não tiver foto identificável, omita o campo box.",
    "Não invente produtos: retorne apenas os que realmente aparecem na página.",
  ].join("\n");
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    products: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          code: { type: "STRING" },
          name: { type: "STRING" },
          description: { type: "STRING" },
          price: { type: "NUMBER" },
          boxQty: { type: "INTEGER" },
          dimensions: { type: "STRING" },
          material: { type: "STRING" },
          category: { type: "STRING" },
          box: {
            type: "OBJECT",
            properties: {
              ymin: { type: "NUMBER" },
              xmin: { type: "NUMBER" },
              ymax: { type: "NUMBER" },
              xmax: { type: "NUMBER" },
            },
            required: ["ymin", "xmin", "ymax", "xmax"],
          },
        },
        required: ["code", "name", "price"],
      },
    },
  },
  required: ["products"],
};

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/** Se o título vier TODO em maiúsculas, converte para capitalização de título (proteção extra). */
function fixAllCapsTitle(name: string): string {
  if (!name || /[a-zà-ÿ]/.test(name)) return name;
  return name
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|[\s\-/(])(\p{L})/gu,
      (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}

function toExtractedProduct(p: GeminiProduct): ExtractedProduct {
  const price = typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0
    ? p.price
    : 0;
  const boxQty = typeof p.boxQty === "number" && Number.isFinite(p.boxQty) && p.boxQty > 0
    ? Math.round(p.boxQty)
    : 1;
  return {
    code: sanitizeText(p.code, 60),
    name: fixAllCapsTitle(sanitizeText(p.name, 200)) || "Produto importado",
    description: sanitizeText(p.description, 4000),
    price,
    minOrder: boxQty,
    dimensions: sanitizeText(p.dimensions, 120),
    material: sanitizeText(p.material, 80),
    category: sanitizeText(p.category, 120),
    box: normalizeBox(p.box),
  };
}

/** Erro de limite de uso (429): o cliente NÃO deve cair no fallback em massa, só aguardar. */
class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiRateLimitError";
  }
}

const GEMINI_MAX_ATTEMPTS = 4;
const GEMINI_BASE_BACKOFF_MS = 2_000;

function parseRetryAfterMs(detail: string): number | null {
  // A API do Gemini devolve RetryInfo com algo como "retryDelay": "27s".
  const m = detail.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (m) {
    const secs = Number(m[1]);
    if (Number.isFinite(secs)) return Math.ceil(secs * 1000);
  }
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<GeminiProduct[]> {
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let lastNotFoundDetail = "";
  for (const model of GEMINI_MODEL_CANDIDATES) {
    const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let res: Response | null = null;
    let modelUnavailable = false;

    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });

      if (res.ok) break;

      const detail = await res.text();
      console.error(`Gemini ${model} (tentativa ${attempt})`, res.status, detail.slice(0, 500));

      if (res.status === 404) {
        lastNotFoundDetail = detail.slice(0, 300);
        modelUnavailable = true;
        break;
      }

      const isRetryable = res.status === 429 || res.status === 503;
      if (!isRetryable) {
        throw new Error(`Falha na IA (HTTP ${res.status}).`);
      }
      if (attempt >= GEMINI_MAX_ATTEMPTS) {
        throw new GeminiRateLimitError(
          "Limite de uso da IA atingido (HTTP 429). Aguarde alguns instantes e tente novamente; " +
            "se persistir, verifique a cota/billing da sua chave do Gemini no Google AI Studio.",
        );
      }
      const retryAfter = parseRetryAfterMs(detail);
      const backoff = retryAfter ?? GEMINI_BASE_BACKOFF_MS * 2 ** (attempt - 1);
      await sleep(backoff);
    }

    if (modelUnavailable) continue;
    if (!res || !res.ok) throw new Error("Falha na IA (resposta inválida).");

    const data = await res.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!raw) return [];

    let parsed: { products?: GeminiProduct[] };
    try {
      parsed = JSON.parse(raw) as { products?: GeminiProduct[] };
    } catch {
      console.error("Gemini retornou JSON inválido:", raw.slice(0, 500));
      throw new Error("A IA retornou um formato inesperado.");
    }
    return Array.isArray(parsed.products) ? parsed.products : [];
  }

  throw new Error(
    `Nenhum modelo de IA disponível para esta chave (tentados: ${GEMINI_MODEL_CANDIDATES.join(", ")}). ` +
      "Verifique no Google AI Studio quais modelos sua chave acessa, ou defina o segredo GEMINI_MODEL. " +
      (lastNotFoundDetail ? `Detalhe: ${lastNotFoundDetail}` : ""),
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
    }
    if (!geminiApiKey) {
      return jsonResponse(
        { error: "GEMINI_API_KEY não configurada na função extract-catalog-page." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    let body: ExtractBody;
    try {
      body = (await req.json()) as ExtractBody;
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const imageBase64 = body.imageBase64?.trim();
    const mimeType = body.mimeType?.trim() || "image/jpeg";
    if (!imageBase64) {
      return jsonResponse({ error: "imageBase64 é obrigatório." }, 400);
    }
    const nativeText = typeof body.nativeText === "string" ? body.nativeText : "";
    const catalogContext = typeof body.catalogContext === "string" ? body.catalogContext : "";
    const categoryNames = Array.isArray(body.categoryNames)
      ? body.categoryNames.filter((c): c is string => typeof c === "string")
      : [];

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller) {
      return jsonResponse({ error: "Sessão inválida." }, 401);
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .maybeSingle();
    if (profileErr) {
      console.error(profileErr);
      return jsonResponse({ error: "Não foi possível validar seu perfil." }, 500);
    }
    const role = profile?.role as string | undefined;
    if (role !== "admin" && role !== "backoffice") {
      return jsonResponse(
        { error: "Apenas administradores podem processar catálogos." },
        403,
      );
    }

    const prompt = buildPrompt(nativeText, categoryNames, catalogContext);
    const rawProducts = await callGemini(geminiApiKey, imageBase64, mimeType, prompt);
    const products = rawProducts.map(toExtractedProduct);

    return jsonResponse({ products });
  } catch (err) {
    console.error("extract-catalog-page:", err);
    if (err instanceof GeminiRateLimitError) {
      return jsonResponse({ error: err.message, rateLimited: true }, 429);
    }
    const message = err instanceof Error ? err.message : "Erro interno na função.";
    return jsonResponse({ error: message }, 500);
  }
});
