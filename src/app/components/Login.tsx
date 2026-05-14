import React, { useState } from 'react';
import { Package, Lock, Mail, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/app/components/ui/utils';

export const Login: React.FC = () => {
  const {
    login,
    signInWithMagicLink,
    signInWithOAuthProvider,
    registerRepresentative,
    resetPassword,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleMagicLink = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setErrorMessage('Informe seu e-mail.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setErrorMessage('Informe seu nome completo.');
      return;
    }
    setLoading(true);
    try {
      await signInWithMagicLink(email, mode === 'register' ? 'register' : 'login', {
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setInfoMessage(
        mode === 'register'
          ? 'Enviamos um link para seu e-mail. Abra-o para concluir o cadastro e entrar na plataforma.'
          : 'Enviamos um link para seu e-mail. Abra-o para entrar na plataforma.'
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Falha ao enviar o link. Tente novamente.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (mode === 'register' && !name.trim()) {
      setErrorMessage('Informe seu nome completo antes de usar o login social.');
      return;
    }
    setLoading(true);
    try {
      const pending =
        mode === 'register'
          ? {
              mode: 'self_register' as const,
              name: name.trim(),
              email: email.trim() || undefined,
              phone: phone.trim() || undefined,
            }
          : null;
      await signInWithOAuthProvider(provider, pending);
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Falha ao abrir o login social. Tente novamente.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Falha ao entrar. Tente novamente.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setInfoMessage(null);

    if (!name || !email || !password || !confirmPassword) {
      setErrorMessage('Preencha nome, e-mail e senha.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('As senhas não conferem.');
      return;
    }

    setLoading(true);
    try {
      await registerRepresentative({
        name,
        email,
        password,
        phone: phone || undefined,
      });
      setInfoMessage(
        'Cadastro enviado para aprovação. Assim que o backoffice aprovar, você poderá acessar com seu e-mail e senha.'
      );
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Falha ao cadastrar. Tente novamente.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    if (!email) {
      setErrorMessage('Informe o e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setInfoMessage(
        'Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.'
      );
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : 'Falha ao enviar e-mail de recuperação.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl mb-2 text-primary">Importa Flow</h1>
          <p className="text-muted-foreground font-bold">O fluxo que acelera suas vendas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{mode === 'login' ? 'Entrar' : 'Criar conta como representante'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Use o link mágico no e-mail ou uma conta Google, Facebook ou Apple. Senha é opcional.'
                : 'Cadastre-se com link no e-mail ou rede social. Você também pode usar senha abaixo.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 [&_input::placeholder]:text-muted-foreground/50">
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm">Nome completo</label>
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
            {mode === 'register' && (
              <div className="space-y-2">
                <label className="text-sm">Telefone (opcional)</label>
                <Input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
            )}

            {supabaseReady ? (
              <>
                <Button
                  onClick={() => void handleMagicLink()}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {loading ? 'Enviando…' : 'Enviar link mágico por e-mail'}
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void handleOAuth('google')}
                  >
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void handleOAuth('facebook')}
                  >
                    Facebook
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void handleOAuth('apple')}
                  >
                    Apple
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Supabase não configurado: use e-mail e senha abaixo (modo demo) ou configure o projeto.
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setShowPasswordSection((v) => !v);
                setErrorMessage(null);
                setInfoMessage(null);
              }}
              className="flex w-full items-center justify-center gap-2 text-sm text-primary hover:underline py-1"
            >
              {showPasswordSection ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Ocultar login com senha
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Entrar ou cadastrar com e-mail e senha
                </>
              )}
            </button>

            <div
              className={cn(
                'space-y-4 overflow-hidden transition-all',
                showPasswordSection ? 'max-h-[2000px] opacity-100 pt-2' : 'max-h-0 opacity-0'
              )}
            >
              <div className="space-y-2">
                <label className="text-sm">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {mode === 'register' && (
                <div className="space-y-2">
                  <label className="text-sm">Confirmar senha</label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {mode === 'login' ? (
                <>
                  <Button
                    onClick={() => void handleLogin()}
                    disabled={loading}
                    variant="secondary"
                    className="w-full"
                  >
                    {loading ? 'Entrando…' : 'Entrar com senha'}
                  </Button>
                  <div className="flex flex-col gap-2 text-sm text-center">
                    <button
                      type="button"
                      onClick={() => void handleForgotPassword()}
                      className="text-primary hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('register');
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className="text-primary hover:underline"
                    >
                      Me cadastrar com senha
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => void handleRegister()}
                    disabled={loading}
                    variant="secondary"
                    className="w-full"
                  >
                    {loading ? 'Enviando cadastro…' : 'Cadastrar com senha'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMessage(null);
                      setInfoMessage(null);
                    }}
                    className="block w-full text-sm text-center text-primary hover:underline"
                  >
                    Já tenho conta • Voltar para login
                  </button>
                </>
              )}
            </div>

            {errorMessage && (
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
            )}
            {infoMessage && !errorMessage && (
              <p className="text-sm text-center text-emerald-600">{infoMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
