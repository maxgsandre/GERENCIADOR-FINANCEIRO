import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Eye, EyeOff, Mail, Lock, User, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';

interface RegisterProps {
  onToggleMode: () => void;
}

export default function Register({ onToggleMode }: RegisterProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { sendSignUpLink } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !lastName || !email) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      // Se já existir senha para este email, orientar login/esqueci senha
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods && methods.includes('password')) {
        setError('Este email já possui cadastro. Use Entrar ou Esqueci minha senha.');
        return;
      }
      // Guarda nome localmente para usar na finalização
      localStorage.setItem('signup_name', `${name} ${lastName}`.trim());
      localStorage.setItem('signup_email', email);
      await sendSignUpLink(email);
    } catch (error: any) {
      console.error('Erro no registro:', error);
      
      if (error.code) {
        // Erros do Firebase
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('Este email já está sendo usado.');
            break;
          case 'auth/invalid-email':
            setError('Email inválido.');
            break;
          default:
            setError('Erro ao enviar link. Tente novamente.');
        }
      } else {
        setError(error.message || 'Erro ao enviar link. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Criar Conta</CardTitle>
          <CardDescription className="text-center">
            Informe seu nome e email. Enviaremos um link para finalizar seu cadastro.
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
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Seu sobrenome"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
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
            
            {/* Senha será definida após o link */}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Enviando link...' : 'Enviar link de cadastro'}
            </Button>
          </form>
          
          <Separator />
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={onToggleMode}
              >
                Fazer login
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}