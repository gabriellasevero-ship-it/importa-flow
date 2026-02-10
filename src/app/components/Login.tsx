import React, { useState } from 'react';
import { Package, Lock, Mail } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

        <Tabs defaultValue="representante" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="representante">Representante</TabsTrigger>
            <TabsTrigger value="admin">Backoffice</TabsTrigger>
          </TabsList>

          <TabsContent value="representante">
            <Card>
              <CardHeader>
                <CardTitle>Login Representante</CardTitle>
                <CardDescription>
                  Acesse seu catálogo e gerencie suas vendas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Use seu email e senha cadastrados no Supabase
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin">
            <Card>
              <CardHeader>
                <CardTitle>Login Backoffice</CardTitle>
                <CardDescription>
                  Acesso administrativo à plataforma (mesmo login; role vem do perfil)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="admin@importaflow.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {loading ? 'Entrando...' : 'Entrar como Admin'}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Use seu email e senha cadastrados no Supabase
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};