import React, { useEffect, useState } from 'react';
import { Package, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  establishSessionFromAuthLink,
  hasPendingAuthLinkParams,
} from '@/lib/authRecoveryLink';
import { linkRepresentanteByEmailIfUnlinked } from '@/services/representantes';

export const SetPassword: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmingLink, setConfirmingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkHint, setLinkHint] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true);
      setHasSession(false);
      return;
    }

    let cancelled = false;

    const sync = async () => {
      const pendingLink = hasPendingAuthLinkParams();

      if (pendingLink) {
        if (!cancelled) {
          setNeedsConfirmation(true);
          setHasSession(false);
          setReady(true);
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id && session.user.email) {
        try {
          await linkRepresentanteByEmailIfUnlinked(session.user.id, session.user.email);
        } catch (err) {
          console.warn('Vínculo representante no convite:', err);
        }
      }

      if (!cancelled) {
        setHasSession(!!session);
        setNeedsConfirmation(false);
        setReady(true);
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
        setHasSession(true);
        setNeedsConfirmation(false);
        setLinkError(null);
        setLinkHint(null);
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleConfirmLink = async () => {
    setConfirmingLink(true);
    setLinkError(null);
    setLinkHint(null);

    const linkResult = await establishSessionFromAuthLink();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user?.id && session.user.email) {
      try {
        await linkRepresentanteByEmailIfUnlinked(session.user.id, session.user.email);
      } catch (err) {
        console.warn('Vínculo representante no convite:', err);
      }
    }

    if (session) {
      setHasSession(true);
      setNeedsConfirmation(false);
      if (!linkResult.ok) {
        setLinkError(null);
        setLinkHint(null);
      }
    } else {
      setHasSession(false);
      if (!linkResult.ok) {
        setLinkError(linkResult.message);
        setLinkHint(linkResult.hint ?? null);
      } else {
        setLinkError('Não foi possível validar o link.');
        setLinkHint('Solicite um novo e-mail de recuperação.');
      }
    }
    setConfirmingLink(false);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!password || !confirm) {
      setErrorMessage('Preencha a nova senha e a confirmação.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      window.location.replace('/');
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : 'Não foi possível definir a senha. Tente novamente.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <p className="text-muted-foreground text-center">
          Supabase não está configurado. Não é possível definir senha neste ambiente.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (needsConfirmation) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Confirmar redefinição de senha</CardTitle>
              <CardDescription>
                Por segurança, clique no botão abaixo para ativar o link do e-mail. Isso evita que
                filtros de e-mail (Outlook, Gmail corporativo) consumam o link antes de você.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkError && (
                <>
                  <p className="text-sm text-destructive">{linkError}</p>
                  {linkHint && <p className="text-sm text-muted-foreground">{linkHint}</p>}
                </>
              )}
              <Button
                className="w-full"
                onClick={() => void handleConfirmLink()}
                disabled={confirmingLink}
              >
                {confirmingLink ? 'Validando…' : 'Continuar para definir nova senha'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.replace('/');
                }}
              >
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mx-auto">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Link inválido ou expirado</h1>
          <p className="text-muted-foreground text-sm">{linkError ?? 'Este link não pode mais ser usado.'}</p>
          {linkHint && <p className="text-muted-foreground text-sm">{linkHint}</p>}
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => {
              window.location.replace('/');
            }}
          >
            Voltar ao login e pedir novo e-mail
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl mb-2 text-primary">Importa Flow</h1>
          <p className="text-muted-foreground font-bold">Criar senha de acesso</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Defina sua senha</CardTitle>
            <CardDescription>
              Escolha uma senha segura para acessar a plataforma com seu e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            )}
            <div className="space-y-2">
              <label className="text-sm">Nova senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm">Confirmar senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showConfirm ? 'text' : 'password'}
                  className="pl-10 pr-10"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={() => void handleSubmit()} disabled={loading}>
              {loading ? 'Salvando…' : 'Salvar senha e entrar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
