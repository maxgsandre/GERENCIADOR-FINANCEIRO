import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Separator } from './ui/separator';
import { Trash2, Plus, ArrowUp, ArrowDown, Filter, Tag, Edit } from 'lucide-react';
import { FinanceiroContext, Transacao } from '../App';
import CategoriasManager from './CategoriasManager';

export default function TransacoesManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { caixas, setCaixas, transacoes, setTransacoes, categorias, setCategorias, saveCaixa, saveTransacao, deleteTransacao, saveCategoria } = context;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<Transacao | null>(null);
  const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [filtroMes, setFiltroMes] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [formData, setFormData] = useState({
    caixaId: '',
    tipo: 'entrada' as 'entrada' | 'saida',
    valor: '',
    descricao: '',
    categoria: '',
    data: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.caixaId || !formData.valor || !formData.descricao || !formData.categoria) return;

    const novaTransacao: Transacao = {
      id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
      caixaId: formData.caixaId,
      tipo: formData.tipo,
      valor: parseFloat(formData.valor),
      descricao: formData.descricao,
      categoria: formData.categoria,
      data: formData.data,
      hora: formData.hora,
    };

    const caixaAtual = caixas.find(c => c.id === formData.caixaId);
    if (caixaAtual) {
      const novoSaldo = formData.tipo === 'entrada' 
        ? caixaAtual.saldo + novaTransacao.valor
        : caixaAtual.saldo - novaTransacao.valor;
      await saveCaixa({ ...caixaAtual, saldo: novoSaldo });
    }

    await saveTransacao(novaTransacao);
    setTransacoes(prev => [...prev, novaTransacao]);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      caixaId: '',
      tipo: 'entrada',
      valor: '',
      descricao: '',
      categoria: '',
      data: new Date().toISOString().split('T')[0],
      hora: new Date().toTimeString().slice(0, 5),
    });
    setIsDialogOpen(false);
    setEditingTransacao(null);
  };

  const handleAdicionarCategoria = async () => {
    if (novaCategoria.trim() && !categorias.some(cat => cat.nome.toLowerCase() === novaCategoria.trim().toLowerCase())) {
      const novaId = (Math.max(...categorias.map(c => parseInt(c.id))) + 1).toString();
      await saveCategoria({ id: novaId, nome: novaCategoria.trim() });
      setFormData(prev => ({ ...prev, categoria: novaCategoria.trim() }));
      setNovaCategoria('');
      setIsCategoriaDialogOpen(false);
    }
  };

  const handleDelete = async (transacao: Transacao) => {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    const caixaAtual = caixas.find(c => c.id === transacao.caixaId);
    if (caixaAtual) {
      const novoSaldo = transacao.tipo === 'entrada' 
        ? caixaAtual.saldo - transacao.valor
        : caixaAtual.saldo + transacao.valor;
      await saveCaixa({ ...caixaAtual, saldo: novoSaldo });
    }
    await deleteTransacao(transacao.id);
    setTransacoes(prev => prev.filter(t => t.id !== transacao.id));
  };

  const openEdit = (transacao: Transacao) => {
    setEditingTransacao(transacao);
    setFormData({
      caixaId: transacao.caixaId,
      tipo: transacao.tipo,
      valor: transacao.valor.toString(),
      descricao: transacao.descricao,
      categoria: transacao.categoria,
      data: transacao.data,
      hora: transacao.hora,
    });
    setIsDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransacao) return;
    if (!formData.caixaId || !formData.valor || !formData.descricao || !formData.categoria) return;

    const transacaoAtualizada: Transacao = {
      id: editingTransacao.id,
      caixaId: formData.caixaId,
      tipo: formData.tipo,
      valor: parseFloat(formData.valor),
      descricao: formData.descricao,
      categoria: formData.categoria,
      data: formData.data,
      hora: formData.hora,
    };

    const caixaAntiga = caixas.find(c => c.id === editingTransacao.caixaId);
    if (caixaAntiga) {
      const saldoRevertido = editingTransacao.tipo === 'entrada' 
        ? caixaAntiga.saldo - editingTransacao.valor
        : caixaAntiga.saldo + editingTransacao.valor;
      await saveCaixa({ ...caixaAntiga, saldo: saldoRevertido });
    }

    const caixaNova = caixas.find(c => c.id === transacaoAtualizada.caixaId);
    if (caixaNova) {
      const saldoAplicado = transacaoAtualizada.tipo === 'entrada' 
        ? caixaNova.saldo + transacaoAtualizada.valor
        : caixaNova.saldo - transacaoAtualizada.valor;
      await saveCaixa({ ...caixaNova, saldo: saldoAplicado });
    }

    await saveTransacao(transacaoAtualizada);
    setTransacoes(prev => prev.map(t => t.id === transacaoAtualizada.id ? transacaoAtualizada : t));
    resetForm();
  };

  // Filtrar transações
  const transacoesFiltradas = transacoes.filter(transacao => {
    const passaTipoFiltro = filtroTipo === 'todos' || transacao.tipo === filtroTipo;
    
    let passaMesFiltro = true;
    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-');
      const dataTransacao = new Date(transacao.data);
      passaMesFiltro = dataTransacao.getFullYear() === parseInt(ano) && 
                       dataTransacao.getMonth() === parseInt(mes) - 1;
    }
    
    return passaTipoFiltro && passaMesFiltro;
  });

  // Ordenar por data e hora (mais recentes primeiro)
  const transacoesOrdenadas = transacoesFiltradas.sort((a, b) => {
    const dataHoraA = new Date(`${a.data}T${a.hora}`);
    const dataHoraB = new Date(`${b.data}T${b.hora}`);
    return dataHoraB.getTime() - dataHoraA.getTime();
  });

  const totalEntradas = transacoesFiltradas
    .filter(t => t.tipo === 'entrada')
    .reduce((sum, t) => sum + t.valor, 0);

  const totalSaidas = transacoesFiltradas
    .filter(t => t.tipo === 'saida')
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transações</h2>
          <p className="text-muted-foreground">
            Gerencie suas entradas e saídas
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTransacao ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
              <DialogDescription>
                Registre uma nova entrada ou saída de dinheiro.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={editingTransacao ? handleUpdate : handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select 
                    value={formData.tipo} 
                    onValueChange={(value: 'entrada' | 'saida') => setFormData(prev => ({ ...prev, tipo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="caixa">Caixa</Label>
                  <Select 
                    value={formData.caixaId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, caixaId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a caixa" />
                    </SelectTrigger>
                    <SelectContent>
                      {caixas.map(caixa => (
                        <SelectItem key={caixa.id} value={caixa.id}>
                          {caixa.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Compra no supermercado, Salário, etc."
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="categoria">Categoria</Label>
                    <div className="flex items-center space-x-2">
                      <Dialog open={isCategoriaDialogOpen} onOpenChange={setIsCategoriaDialogOpen}>
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Nova
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Nova Categoria</DialogTitle>
                            <DialogDescription>
                              Crie uma nova categoria personalizada para suas transações.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="nova-categoria">Nome da Categoria</Label>
                              <Input
                                id="nova-categoria"
                                value={novaCategoria}
                                onChange={(e) => setNovaCategoria(e.target.value)}
                                placeholder="Ex: Pets, Presentes, Hobbies..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAdicionarCategoria();
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => {
                                setNovaCategoria('');
                                setIsCategoriaDialogOpen(false);
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="button" 
                              onClick={handleAdicionarCategoria}
                              disabled={!novaCategoria.trim()}
                            >
                              <Tag className="h-4 w-4 mr-2" />
                              Criar Categoria
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <CategoriasManager onCategoriaSelect={(categoria) => setFormData(prev => ({ ...prev, categoria }))} />
                    </div>
                  </div>
                  <Select 
                    value={formData.categoria} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.sort((a, b) => a.nome.localeCompare(b.nome)).map(categoria => (
                        <SelectItem key={categoria.id} value={categoria.nome}>
                          {categoria.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hora">Hora</Label>
                  <Input
                    id="hora"
                    type="time"
                    value={formData.hora}
                    onChange={(e) => setFormData(prev => ({ ...prev, hora: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Entradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Saídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              (totalEntradas - totalSaidas) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              R$ {(totalEntradas - totalSaidas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-3 md:gap-4">
          <Select value={filtroTipo} onValueChange={(value: 'todos' | 'entrada' | 'saida') => setFiltroTipo(value)}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          
          <Input
            type="month"
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="w-full md:w-40"
            placeholder="Filtrar por mês"
          />
          
          <Button 
            variant="outline" 
            onClick={() => {
              setFiltroTipo('todos');
              setFiltroMes('');
            }}
            className="w-full md:w-auto"
          >
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Lista de transações */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>
            {transacoesOrdenadas.length} transação(ões) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {transacoesOrdenadas.map((transacao) => {
              const caixa = caixas.find(c => c.id === transacao.caixaId);
              
              return (
                <div key={transacao.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-medium">{transacao.descricao}</p>
                      <p className="text-sm text-muted-foreground">{transacao.categoria}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(transacao)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={transacao.tipo === 'entrada' ? 'default' : 'destructive'}
                        className="flex items-center"
                      >
                        {transacao.tipo === 'entrada' ? (
                          <ArrowUp className="h-3 w-3 mr-1" />
                        ) : (
                          <ArrowDown className="h-3 w-3 mr-1" />
                        )}
                        {transacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(transacao.data).toLocaleDateString('pt-BR')} às {transacao.hora}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      <p className={`font-medium ${
                        transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        R$ {transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {caixa?.nome || 'Caixa não encontrada'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Versão desktop - Tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Caixa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transacoesOrdenadas.map((transacao) => {
                  const caixa = caixas.find(c => c.id === transacao.caixaId);
                  
                  return (
                    <TableRow key={transacao.id}>
                      <TableCell>
                        <div>
                          <div>{new Date(transacao.data).toLocaleDateString('pt-BR')}</div>
                          <div className="text-sm text-muted-foreground">{transacao.hora}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={transacao.tipo === 'entrada' ? 'default' : 'destructive'}
                          className="flex items-center w-fit"
                        >
                          {transacao.tipo === 'entrada' ? (
                            <ArrowUp className="h-3 w-3 mr-1" />
                          ) : (
                            <ArrowDown className="h-3 w-3 mr-1" />
                          )}
                          {transacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell>{transacao.descricao}</TableCell>
                      <TableCell>{transacao.categoria}</TableCell>
                      <TableCell>{caixa?.nome || 'Caixa não encontrada'}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        transacao.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        R$ {transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(transacao)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {transacoesOrdenadas.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma transação encontrada.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}