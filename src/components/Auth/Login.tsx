import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Eye, EyeOff, Mail, Lock, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';

interface LoginProps {
  onToggleMode: () => void;
}

export default function Login({ onToggleMode }: LoginProps) {
  const logo = new URL('../../assets/logo.png', import.meta.url).href;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, resetPassword } = useAuth();
  const [sendingReset, setSendingReset] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email, password);
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      if (error.code) {
        // Erros do Firebase ou mock com códigos
        switch (error.code) {
          case 'auth/user-not-found':
            setError('Usuário não encontrado. Verifique o email.');
            break;
          case 'auth/wrong-password':
            setError('Senha incorreta. Tente novamente.');
            break;
          case 'auth/invalid-email':
            setError('Email inválido.');
            break;
          case 'auth/too-many-requests':
            setError('Muitas tentativas falharam. Tente novamente mais tarde.');
            break;
          default:
            setError('Erro ao fazer login. Tente novamente.');
        }
      } else {
        const message = error.message || 'Erro ao fazer login. Tente novamente.';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <img src={logo} alt="Gerenciador Financeiro" className="mx-auto h-16 mb-2" />
          <CardTitle className="text-2xl text-center">Entrar</CardTitle>
          <CardDescription className="text-center">
            Entre com sua conta para acessar seu controle financeiro
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
                  className="pl-10"
                  required
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
                  placeholder="Sua senha"
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
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <div className="text-right">
              <Dialog open={isForgotOpen} onOpenChange={(o) => {
                setIsForgotOpen(o);
                if (o) {
                  setForgotEmail(email);
                  setForgotError('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-sm"
                  >
                    Esqueci minha senha
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Redefinir senha</DialogTitle>
                    <DialogDescription>
                      Informe seu email para enviarmos um link de redefinição.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    {forgotError && (
                      <p className="text-sm text-destructive">{forgotError}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">Você criará a nova senha na próxima tela.</p>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsForgotOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={sendingReset || !forgotEmail}
                      onClick={async () => {
                        setForgotError('');
                        try {
                          setSendingReset(true);
                          await resetPassword(forgotEmail);
                          setIsForgotOpen(false);
                          alert('Enviamos um link para ' + forgotEmail);
                        } catch (e: any) {
                          setForgotError('Não foi possível enviar o email.');
                        } finally {
                          setSendingReset(false);
                        }
                      }}
                    >
                      Enviar link
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </form>
          
          <Separator />
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={onToggleMode}
              >
                Criar conta
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}