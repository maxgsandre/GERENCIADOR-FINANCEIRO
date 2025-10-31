import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../lib/firebase';

export default function FinalizePassword() {
  const { finalizeSignUp, currentUser } = useAuth();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [email, setEmail] = useState<string>(() => localStorage.getItem('signup_email') || '');
  const [name, setName] = useState<string>(() => localStorage.getItem('signup_name') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se já estiver autenticado, pega o email do usuário autenticado
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
    
    // Verifica se é um link válido do Firebase (mesmo sem o mode na URL)
    const hasFirebaseLink = params.has('oobCode') || params.has('apiKey') || window.location.href.includes('mode=finalizeSignUp');
    const mode = params.get('mode');
    
    // Se não tiver o email e não for um link válido, pode ser um erro
    if (!email && !hasFirebaseLink && mode !== 'finalizeSignUp' && !currentUser) {
      setError('Link inválido. Por favor, solicite um novo link de cadastro.');
    }
  }, [params, email, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      
      // Se já estiver autenticado (Firebase processou o link), tenta vincular senha diretamente
      if (currentUser && currentUser.email === email) {
        const { EmailAuthProvider, linkWithCredential, updateProfile } = await import('firebase/auth');
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(currentUser, credential);
        if (name) {
          await updateProfile(currentUser, { displayName: name });
        }
      } else {
        // Caso contrário, usa o método padrão
        await finalizeSignUp(email, password, name || undefined);
      }
      
      // Limpa dados temporários
      localStorage.removeItem('signup_email');
      localStorage.removeItem('signup_name');
      
      // Redireciona para app (remove query)
      const url = new URL(window.location.href);
      url.search = '';
      window.location.href = url.toString();
    } catch (e: any) {
      console.error('Erro ao finalizar cadastro:', e);
      if (e.code === 'auth/credential-already-in-use') {
        setError('Esta senha já está vinculada a outra conta.');
      } else if (e.code === 'auth/invalid-action-code') {
        setError('Link inválido ou expirado. Solicite um novo link de cadastro.');
      } else {
        setError(e.message || 'Não foi possível finalizar o cadastro. O link pode ter expirado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Finalizar cadastro</CardTitle>
          <CardDescription className="text-center">
            Defina sua senha para concluir o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-muted/50"
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Finalizando...' : 'Finalizar cadastro'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


