import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Separator } from './ui/separator';
import { Trash2, Plus, Edit, Calendar, AlertCircle, Tag } from 'lucide-react';
import { FinanceiroContext, GastoFixo } from '../App';
import CategoriasManager from './CategoriasManager';

export default function GastosFixosManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { gastosFixos, setGastosFixos, categorias, setCategorias, saveGastoFixo, deleteGastoFixo, saveCategoria } = context;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoriaDialogOpen, setIsCategoriaDialogOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoFixo | null>(null);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    categoria: '',
    diaVencimento: '',
    pago: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.descricao || !formData.valor || !formData.categoria || !formData.diaVencimento) return;

    const novoGasto: GastoFixo = {
      id: editingGasto?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      categoria: formData.categoria,
      diaVencimento: parseInt(formData.diaVencimento),
      pago: formData.pago,
    };

    await saveGastoFixo(novoGasto);
    setGastosFixos(prev => {
      const index = prev.findIndex(g => g.id === novoGasto.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = novoGasto;
        return clone;
      }
      return [...prev, novoGasto];
    });

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      valor: '',
      categoria: '',
      diaVencimento: '',
      pago: false,
    });
    setEditingGasto(null);
    setIsDialogOpen(false);
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

  const handleEdit = (gasto: GastoFixo) => {
    setEditingGasto(gasto);
    setFormData({
      descricao: gasto.descricao,
      valor: gasto.valor.toString(),
      categoria: gasto.categoria,
      diaVencimento: gasto.diaVencimento.toString(),
      pago: gasto.pago,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este gasto fixo?')) return;
    await deleteGastoFixo(id);
    setGastosFixos(prev => prev.filter(g => g.id !== id));
  };

  const togglePago = (id: string) => {
    setGastosFixos(prev => prev.map(g => 
      g.id === id ? { ...g, pago: !g.pago } : g
    ));
  };

  // Calcular totais
  const totalPagos = gastosFixos
    .filter(g => g.pago)
    .reduce((sum, g) => sum + g.valor, 0);

  const totalPendentes = gastosFixos
    .filter(g => !g.pago)
    .reduce((sum, g) => sum + g.valor, 0);

  // Verificar vencimentos próximos (próximos 7 dias) que ainda não foram pagos
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  const proximosVencimentos = gastosFixos
    .filter(g => !g.pago)
    .filter(g => {
      const diasAteVencimento = g.diaVencimento - diaAtual;
      return diasAteVencimento >= 0 && diasAteVencimento <= 7;
    })
    .sort((a, b) => a.diaVencimento - b.diaVencimento);

  // Gastos por categoria (todos os gastos)
  const gastosPorCategoria = gastosFixos
    .reduce((acc, gasto) => {
      acc[gasto.categoria] = (acc[gasto.categoria] || 0) + gasto.valor;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gastos Fixos</h2>
          <p className="text-muted-foreground">
            Gerencie seus gastos recorrentes mensais
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Gasto Fixo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGasto ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}
              </DialogTitle>
              <DialogDescription>
                {editingGasto 
                  ? 'Edite as informações do gasto fixo selecionado.'
                  : 'Adicione um novo gasto que se repete mensalmente.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Ex: Aluguel, Internet, Academia, etc."
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
                  <Label htmlFor="diaVencimento">Dia do Vencimento</Label>
                  <Input
                    id="diaVencimento"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.diaVencimento}
                    onChange={(e) => setFormData(prev => ({ ...prev, diaVencimento: e.target.value }))}
                    placeholder="Ex: 5, 15, 30"
                    required
                  />
                </div>
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
                            Crie uma nova categoria personalizada para seus gastos fixos.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="nova-categoria-gasto">Nome da Categoria</Label>
                            <Input
                              id="nova-categoria-gasto"
                              value={novaCategoria}
                              onChange={(e) => setNovaCategoria(e.target.value)}
                              placeholder="Ex: Pets, Presentes, Streaming..."
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
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="pago"
                  checked={formData.pago}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pago: checked }))}
                />
                <Label htmlFor="pago">Gasto já pago neste mês</Label>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingGasto ? 'Salvar' : 'Criar'}
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
            <CardTitle className="text-sm">Total Gastos Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalPagos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {gastosFixos.filter(g => g.pago).length} gasto(s) pago(s)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Gastos Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalPendentes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {gastosFixos.filter(g => !g.pago).length} gasto(s) pendente(s)
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {proximosVencimentos.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              nos próximos 7 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de vencimento próximo */}
      {proximosVencimentos.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertCircle className="h-4 w-4 mr-2" />
              Vencimentos Próximos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {proximosVencimentos.map(gasto => (
                <div key={gasto.id} className="flex justify-between items-center">
                  <span className="text-orange-800">{gasto.descricao}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-orange-800 border-orange-300">
                      Dia {gasto.diaVencimento}
                    </Badge>
                    <span className="font-medium text-orange-800">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo por categoria */}
      {Object.keys(gastosPorCategoria).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoria</CardTitle>
            <CardDescription>Distribuição dos gastos mensais</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(gastosPorCategoria)
                .sort(([,a], [,b]) => b - a)
                .map(([categoria, valor]) => (
                  <div key={categoria} className="flex justify-between items-center">
                    <span>{categoria}</span>
                    <span className="font-medium">
                      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de gastos fixos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos Fixos</CardTitle>
          <CardDescription>
            {gastosFixos.length} gasto(s) cadastrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Versão mobile - Lista de cards */}
          <div className="md:hidden space-y-3">
            {gastosFixos.map((gasto) => (
              <div key={gasto.id} className={`border rounded-lg p-3 space-y-3 ${gasto.pago ? 'bg-green-50 border-green-200' : ''}`}>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <p className="font-medium">{gasto.descricao}</p>
                    <p className="text-sm text-muted-foreground">{gasto.categoria}</p>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      Dia {gasto.diaVencimento}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={gasto.pago}
                      onCheckedChange={() => togglePago(gasto.id)}
                      size="sm"
                    />
                    <span className="text-sm">
                      {gasto.pago ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(gasto)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(gasto.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Versão desktop - Tabela */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gastosFixos.map((gasto) => (
                  <TableRow key={gasto.id} className={gasto.pago ? 'bg-green-50' : ''}>
                    <TableCell className="font-medium">{gasto.descricao}</TableCell>
                    <TableCell>{gasto.categoria}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                        Dia {gasto.diaVencimento}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      R$ {gasto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={gasto.pago}
                          onCheckedChange={() => togglePago(gasto.id)}
                        />
                        <span className="text-sm">
                          {gasto.pago ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(gasto)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(gasto.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {gastosFixos.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum gasto fixo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando seus gastos mensais recorrentes.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro gasto
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}