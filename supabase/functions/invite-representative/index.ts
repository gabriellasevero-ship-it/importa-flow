import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_VERSION = "2024-01-01";

type InviteBody = {
  representativeId?: string;
  siteUrl?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendMagicLinkEmail(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  email: string;
  redirectTo: string;
  data: Record<string, string>;
  createUser: boolean;
}): Promise<{ error?: string }> {
  const base = params.supabaseUrl.replace(/\/+$/, "");
  const otpUrl = new URL(`${base}/auth/v1/otp`);
  otpUrl.searchParams.set("redirect_to", params.redirectTo);

  const res = await fetch(otpUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: params.serviceRoleKey,
      Authorization: `Bearer ${params.serviceRoleKey}`,
      "X-Supabase-Api-Version": API_VERSION,
    },
    body: JSON.stringify({
      email: params.email,
      data: params.data,
      create_user: params.createUser,
      gotrue_meta_security: {},
    }),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as {
        msg?: string;
        error_description?: string;
        error?: string;
        message?: string;
      };
      msg =
        j.msg ||
        j.error_description ||
        j.message ||
        j.error ||
        JSON.stringify(j);
    } catch {
      try {
        msg = await res.text();
      } catch {
        /* ignore */
      }
    }
    return { error: msg };
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  const jwt = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  let body: InviteBody;
  try {
    body = (await req.json()) as InviteBody;
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  const representativeId = body.representativeId?.trim();
  const siteUrlRaw = body.siteUrl?.trim();
  if (!representativeId?.length) {
    return jsonResponse({ error: "representativeId é obrigatório." }, 400);
  }
  if (!siteUrlRaw?.length) {
    return jsonResponse({ error: "siteUrl é obrigatório." }, 400);
  }

  let siteUrl: string;
  try {
    const u = new URL(siteUrlRaw);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return jsonResponse({ error: "siteUrl inválido." }, 400);
    }
    siteUrl = `${u.origin}`;
  } catch {
    return jsonResponse({ error: "siteUrl inválido." }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: caller },
    error: callerErr,
  } = await admin.auth.getUser(jwt);
  if (callerErr || !caller) {
    return jsonResponse({ error: "Sessão inválida." }, 401);
  }

  const { data: adminProfile, error: profileErr } = await admin
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr) {
    console.error(profileErr);
    return jsonResponse({ error: "Não foi possível validar seu perfil." }, 500);
  }

  const role = adminProfile?.role as string | undefined;
  if (role !== "admin" && role !== "backoffice") {
    return jsonResponse({ error: "Apenas administradores podem enviar convites." }, 403);
  }

  const { data: rep, error: repErr } = await admin
    .from("representantes")
    .select("id, email, name, phone, user_id")
    .eq("id", representativeId)
    .maybeSingle();

  if (repErr) {
    console.error(repErr);
    return jsonResponse({ error: "Erro ao buscar representante." }, 500);
  }
  if (!rep) {
    return jsonResponse({ error: "Representante não encontrado." }, 404);
  }

  if (rep.user_id) {
    return jsonResponse(
      {
        error:
          "Este representante já está vinculado a uma conta. Ela pode entrar com magic link ou senha na tela de login.",
      },
      409
    );
  }

  const email = String(rep.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonResponse({ error: "E-mail do representante inválido." }, 400);
  }

  const redirectTo = siteUrl.replace(/\/+$/, "");
  const meta = {
    name: rep.name,
    full_name: rep.name,
  };

  let send = await sendMagicLinkEmail({
    supabaseUrl,
    serviceRoleKey,
    email,
    redirectTo,
    data: meta,
    createUser: true,
  });

  if (send.error) {
    const low = send.error.toLowerCase();
    const exists =
      low.includes("already") ||
      low.includes("registered") ||
      low.includes("exists") ||
      low.includes("user already");
    if (exists) {
      send = await sendMagicLinkEmail({
        supabaseUrl,
        serviceRoleKey,
        email,
        redirectTo,
        data: meta,
        createUser: false,
      });
    }
  }

  if (send.error) {
    const low = send.error.toLowerCase();
    if (
      low.includes("already") ||
      low.includes("registered") ||
      low.includes("exists")
    ) {
      return jsonResponse(
        {
          error:
            "Já existe uma conta com este e-mail. Enviamos orientação: use \"Entrar com link\" na tela de login ou \"Esqueci minha senha\" se tiver senha.",
        },
        409
      );
    }
    console.error(send.error);
    return jsonResponse({ error: send.error }, 500);
  }

  return jsonResponse({ ok: true });
});
