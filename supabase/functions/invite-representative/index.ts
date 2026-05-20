import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

type AdminClient = ReturnType<typeof createClient>;

function isExistingUserError(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("already") ||
    low.includes("registered") ||
    low.includes("exists") ||
    low.includes("user already")
  );
}

function isInvalidCredentialsError(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("invalid login credentials") ||
    low.includes("invalid_credentials") ||
    low.includes("invalid credentials")
  );
}

function otpConfigErrorMessage(): string {
  return (
    "Não foi possível enviar o link de acesso. No Supabase: Authentication → Providers → Email (habilitado); " +
    "URL Configuration → Redirect URLs com a URL do app; e templates Invite user / Magic link configurados."
  );
}

type PublicAuthClient = ReturnType<typeof createClient>;

function createPublicAuthClient(supabaseUrl: string, anonKey: string): PublicAuthClient {
  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      flowType: "implicit",
    },
  });
}

async function authUserExistsForEmail(
  admin: AdminClient,
  email: string,
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserByEmail(email);
  if (error) {
    const low = (error.message ?? "").toLowerCase();
    if (low.includes("not found") || low.includes("no user")) {
      return false;
    }
    console.error("getUserByEmail:", error.message);
    return false;
  }
  return !!data?.user;
}

async function sendMagicLinkOtp(
  publicClient: PublicAuthClient,
  email: string,
  redirectTo: string,
  data: Record<string, string>,
  shouldCreateUser: boolean,
): Promise<{ error?: string }> {
  const { error: otpError } = await publicClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser,
      emailRedirectTo: redirectTo,
      data,
    },
  });

  if (!otpError) {
    return {};
  }
  if (isInvalidCredentialsError(otpError.message)) {
    return { error: otpConfigErrorMessage() };
  }
  if (isExistingUserError(otpError.message) && shouldCreateUser) {
    return sendMagicLinkOtp(publicClient, email, redirectTo, data, false);
  }
  return { error: otpError.message };
}

/**
 * Pré-cadastro no backoffice (sem conta Auth): inviteUserByEmail ou magic link com criação de usuário.
 * E-mail já existente no Auth: apenas magic link (shouldCreateUser: false).
 */
async function sendRepresentativeAccessEmail(
  admin: AdminClient,
  supabaseUrl: string,
  anonKey: string,
  email: string,
  redirectTo: string,
  data: Record<string, string>,
): Promise<{ error?: string }> {
  const publicClient = createPublicAuthClient(supabaseUrl, anonKey);
  const userExists = await authUserExistsForEmail(admin, email);

  if (userExists) {
    return sendMagicLinkOtp(publicClient, email, redirectTo, data, false);
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data,
  });

  if (!inviteError) {
    return {};
  }

  if (isExistingUserError(inviteError.message)) {
    return sendMagicLinkOtp(publicClient, email, redirectTo, data, false);
  }

  console.warn(
    "inviteUserByEmail falhou, tentando magic link com criação de usuário:",
    inviteError.message,
  );

  const otp = await sendMagicLinkOtp(
    publicClient,
    email,
    redirectTo,
    data,
    true,
  );
  if (!otp.error) {
    return {};
  }

  if (isInvalidCredentialsError(inviteError.message)) {
    return { error: otp.error };
  }

  return { error: inviteError.message || otp.error };
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
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
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
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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
      409,
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

  const send = await sendRepresentativeAccessEmail(
    admin,
    supabaseUrl,
    anonKey,
    email,
    redirectTo,
    meta,
  );

  if (send.error) {
    const low = send.error.toLowerCase();
    if (isExistingUserError(send.error)) {
      return jsonResponse(
        {
          error:
            "Já existe uma conta com este e-mail. Peça para usar \"Entrar com link\" na tela de login ou \"Esqueci minha senha\" se tiver senha.",
        },
        409,
      );
    }
    console.error(send.error);
    return jsonResponse({ error: send.error }, 500);
  }

  return jsonResponse({ ok: true });
});
