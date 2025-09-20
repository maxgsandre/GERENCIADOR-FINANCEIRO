import React, { useState } from 'react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { LogOut, User, Moon, Sun, Lock, Pencil } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';

export default function UserMenu() {
  const { currentUser, logout, changePassword, updateName } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [name, setName] = useState(currentUser?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {currentUser?.displayName ? 
                getInitials(currentUser.displayName) : 
                <User className="h-4 w-4" />
              }
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser?.displayName || 'Usuário'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {currentUser?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsChangeOpen(true)}>
          <Lock className="mr-2 h-4 w-4" />
          <span>Alterar senha</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>Editar perfil</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
      {/* Dialog Alterar Senha Imediata */}
      <Dialog open={isChangeOpen} onOpenChange={setIsChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Informe sua senha atual e a nova senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="curr-pass">Senha atual</Label>
              <Input id="curr-pass" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-pass">Nova senha</Label>
              <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="conf-pass">Confirmar nova senha</Label>
              <Input id="conf-pass" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangeOpen(false)}>Cancelar</Button>
            <Button disabled={loading} onClick={async () => {
              setError('');
              if (!currentPassword || !newPassword || !confirmNewPassword) { setError('Preencha todos os campos.'); return; }
              if (newPassword !== confirmNewPassword) { setError('As senhas não coincidem.'); return; }
              if (newPassword.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
              try {
                setLoading(true);
                await changePassword(currentPassword, newPassword);
                setIsChangeOpen(false);
                alert('Senha alterada com sucesso.');
              } catch (e: any) {
                setError('Não foi possível alterar a senha.');
              } finally {
                setLoading(false);
              }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Editar Perfil */}
      <Dialog open={isEditOpen} onOpenChange={(o) => { setIsEditOpen(o); if (o) setName(currentUser?.displayName || ''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Atualize seu nome exibido.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button disabled={loading || !name.trim()} onClick={async () => {
              setError('');
              try {
                setLoading(true);
                await updateName(name.trim());
                setIsEditOpen(false);
                alert('Perfil atualizado.');
              } catch (e) {
                alert('Não foi possível atualizar o perfil.');
              } finally {
                setLoading(false);
              }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}