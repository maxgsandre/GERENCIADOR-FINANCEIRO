import React, { useState } from 'react';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { LogOut, User, Moon, Sun, Lock, Pencil, Download, HardDrive, Upload, FileDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useContext, useMemo, useRef } from 'react';
import { FinanceiroContext } from '../App';
import { exportMonthToXlsx } from '../utils/exportXlsx';
import * as firebaseService from '../services/firebaseService';

export default function UserMenu() {
  const { currentUser, logout, changePassword, updateName } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isBackupExportOpen, setIsBackupExportOpen] = useState(false);
  const [backupPeriodoInicio, setBackupPeriodoInicio] = useState<string>('');
  const [backupPeriodoFim, setBackupPeriodoFim] = useState<string>('');
  const [backupTipo, setBackupTipo] = useState<'todos' | 'periodo'>('todos');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [name, setName] = useState(currentUser?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const ctx = useContext(FinanceiroContext);
  const todayDefault = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [exportMonth, setExportMonth] = useState<string>(todayDefault);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      console.error('Erro ao fazer logout');
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
        <DropdownMenuItem onClick={() => setIsExportOpen(true)}>
          <Download className="mr-2 h-4 w-4" />
          <span>Exportar Dados</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <HardDrive className="mr-2 h-4 w-4" />
            <span>Backup</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setIsBackupExportOpen(true)}>
              <FileDown className="mr-2 h-4 w-4" />
              <span>Exportar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              fileInputRef.current?.click();
            }}>
              <Upload className="mr-2 h-4 w-4" />
              <span>Importar</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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

      {/* Dialog Exportar Dados */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Dados</DialogTitle>
            <DialogDescription>Selecione o mês para gerar o arquivo .xlsx</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="export-month">Mês</Label>
              <Input id="export-month" type="month" value={exportMonth}
                     onChange={(e) => setExportMonth(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (!ctx) return;
              const { caixas, transacoes, dividas, receitasPrevistas, comprasCartao, cartoes, gastosFixos, cofrinhos } = ctx as any;
              const month = exportMonth || todayDefault;
              exportMonthToXlsx(month, { caixas, transacoes, dividas, receitasPrevistas, comprasCartao, cartoes, gastosFixos, cofrinhos });
              setIsExportOpen(false);
            }}>Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Backup - Exportar */}
      <Dialog open={isBackupExportOpen} onOpenChange={setIsBackupExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Backup</DialogTitle>
            <DialogDescription>Escolha se deseja exportar todo o histórico ou um período específico</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Escopo da exportação</Label>
              <div className="flex flex-col space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="backupTipo"
                    value="todos"
                    checked={backupTipo === 'todos'}
                    onChange={(e) => setBackupTipo(e.target.value as 'todos' | 'periodo')}
                    className="w-4 h-4"
                  />
                  <span>Todo o histórico</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="backupTipo"
                    value="periodo"
                    checked={backupTipo === 'periodo'}
                    onChange={(e) => setBackupTipo(e.target.value as 'todos' | 'periodo')}
                    className="w-4 h-4"
                  />
                  <span>Período específico</span>
                </label>
              </div>
            </div>
            {backupTipo === 'periodo' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="backup-inicio">Período início (YYYY-MM)</Label>
                  <Input
                    id="backup-inicio"
                    type="month"
                    value={backupPeriodoInicio}
                    onChange={(e) => setBackupPeriodoInicio(e.target.value)}
                    placeholder="2025-01"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="backup-fim">Período fim (YYYY-MM)</Label>
                  <Input
                    id="backup-fim"
                    type="month"
                    value={backupPeriodoFim}
                    onChange={(e) => setBackupPeriodoFim(e.target.value)}
                    placeholder="2025-12"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsBackupExportOpen(false);
              setBackupTipo('todos');
              setBackupPeriodoInicio('');
              setBackupPeriodoFim('');
            }}>Cancelar</Button>
            <Button disabled={loading} onClick={async () => {
              if (!currentUser) return;
              setLoading(true);
              setError('');
              try {
                const options: any = {
                  incluirTodos: backupTipo === 'todos',
                };
                if (backupTipo === 'periodo') {
                  if (!backupPeriodoInicio || !backupPeriodoFim) {
                    setError('Preencha os períodos de início e fim.');
                    setLoading(false);
                    return;
                  }
                  options.periodoInicio = backupPeriodoInicio;
                  options.periodoFim = backupPeriodoFim;
                }
                const backupData = await firebaseService.exportUserData(currentUser.uid, options);
                const jsonStr = JSON.stringify(backupData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const fileName = `backup-${backupData.exportDate.split('T')[0]}.json`;
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setIsBackupExportOpen(false);
                setBackupTipo('todos');
                setBackupPeriodoInicio('');
                setBackupPeriodoFim('');
                alert('Backup exportado com sucesso!');
              } catch (e) {
                setError('Erro ao exportar backup.');
                console.error(e);
              } finally {
                setLoading(false);
              }
            }}>Exportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Input oculto para importar backup */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !currentUser) return;
          
          setLoading(true);
          setError('');
          
          try {
            const text = await file.text();
            const backupData = JSON.parse(text) as firebaseService.BackupData;
            
            // Validar estrutura básica
            if (!backupData.version || !backupData.exportDate) {
              throw new Error('Arquivo de backup inválido.');
            }
            
            // Confirmar importação
            const confirmar = window.confirm(
              'Esta operação irá restaurar todos os dados do backup. ' +
              'Dados existentes com mesmos IDs serão substituídos. Deseja continuar?'
            );
            
            if (!confirmar) {
              setLoading(false);
              return;
            }
            
            await firebaseService.importUserData(currentUser.uid, backupData, {
              substituirExistentes: true
            });
            
            alert('Backup importado com sucesso! Recarregue a página para ver as alterações.');
            
            // Limpar input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } catch (e: any) {
            setError(e.message || 'Erro ao importar backup.');
            console.error(e);
            alert('Erro ao importar backup: ' + (e.message || 'Arquivo inválido.'));
          } finally {
            setLoading(false);
          }
        }}
      />
    </DropdownMenu>
  );
}