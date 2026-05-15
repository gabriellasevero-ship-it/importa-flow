import React, { useState } from 'react';
import { Package, Lock, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';

export const Login: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              {supabaseReady
                ? 'Use o e-mail e a senha da sua conta.'
                : 'Supabase não configurado: use e-mail e senha (modo demo) ou configure o projeto.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 [&_input::placeholder]:text-muted-foreground/50">
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

            <Button
              onClick={() => void handleLogin()}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>

            <div className="flex flex-col gap-2 text-sm text-center">
              <button
                type="button"
                onClick={() => void handleForgotPassword()}
                className="text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
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
