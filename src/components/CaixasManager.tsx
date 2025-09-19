import React, { useContext, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Trash2, Plus, Edit, Wallet, PiggyBank, CreditCard, TrendingUp, Target, Percent, DollarSign, CheckCircle, Circle } from 'lucide-react';
import { FinanceiroContext, Caixa, Cofrinho, ReceitaPrevista } from '../App';

const tiposIcon = {
  conta_corrente: Wallet,
  poupanca: PiggyBank,
  carteira: Wallet,
  investimento: TrendingUp,
};

const tiposLabel = {
  conta_corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  investimento: 'Investimento',
};

export default function CaixasManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { 
    caixas, 
    setCaixas, 
    cofrinhos, 
    setCofrinhos, 
    receitasPrevistas, 
    setReceitasPrevistas, 
    saveReceitaPrevista, 
    deleteReceitaPrevista,
    saveCaixa,
    deleteCaixa,
    saveCofrinho,
    deleteCofrinho,
  } = context;
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCofrinhoDialogOpen, setIsCofrinhoDialogOpen] = useState(false);
  const [isReceitaDialogOpen, setIsReceitaDialogOpen] = useState(false);
  const [editingCaixa, setEditingCaixa] = useState<Caixa | null>(null);
  const [editingCofrinho, setEditingCofrinho] = useState<Cofrinho | null>(null);
  const [editingReceita, setEditingReceita] = useState<ReceitaPrevista | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    saldo: '',
    tipo: 'conta_corrente' as Caixa['tipo'],
  });
  const [cofrinhoFormData, setCofrinhoFormData] = useState({
    nome: '',
    saldo: '',
    objetivo: '',
    percentualCDI: '',
    cor: '#10b981',
  });
  const [receitaFormData, setReceitaFormData] = useState({
    descricao: '',
    valor: '',
    dataVencimento: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.saldo) return;

    const novaCaixa: Caixa = {
      id: editingCaixa?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      nome: formData.nome,
      saldo: parseFloat(formData.saldo),
      tipo: formData.tipo,
    };

    await saveCaixa(novaCaixa);
    // Atualização otimista da UI; o listener confirmará em seguida
    setCaixas(prev => {
      const index = prev.findIndex(c => c.id === novaCaixa.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = novaCaixa;
        return clone;
      }
      return [...prev, novaCaixa];
    });

    resetForm();
  };

  const resetForm = () => {
    setFormData({ nome: '', saldo: '', tipo: 'conta_corrente' });
    setEditingCaixa(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (caixa: Caixa) => {
    setEditingCaixa(caixa);
    setFormData({
      nome: caixa.nome,
      saldo: caixa.saldo.toString(),
      tipo: caixa.tipo,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta caixa?')) return;
    await deleteCaixa(id);
    // Atualização otimista da UI
    setCaixas(prev => prev.filter(c => c.id !== id));
  };

  // Funções para cofrinhos
  const handleCofrinhoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cofrinhoFormData.nome || !cofrinhoFormData.saldo || !cofrinhoFormData.percentualCDI) return;

    const cdiAtual = 10.75; // CDI atual em % a.a. (pode ser atualizado via API)
    const rendimentoAnual = (parseFloat(cofrinhoFormData.percentualCDI) / 100) * cdiAtual;
    const rendimentoMensal = (parseFloat(cofrinhoFormData.saldo) * rendimentoAnual) / 12 / 100;

    const novoCofrinho: Cofrinho = {
      id: editingCofrinho?.id || ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString()),
      nome: cofrinhoFormData.nome,
      saldo: parseFloat(cofrinhoFormData.saldo),
      objetivo: cofrinhoFormData.objetivo ? parseFloat(cofrinhoFormData.objetivo) : undefined,
      percentualCDI: parseFloat(cofrinhoFormData.percentualCDI),
      rendimentoMensal: rendimentoMensal,
      dataCriacao: editingCofrinho?.dataCriacao || new Date().toISOString().split('T')[0],
      cor: cofrinhoFormData.cor,
    };

    await saveCofrinho(novoCofrinho);
    setCofrinhos(prev => {
      const index = prev.findIndex(c => c.id === novoCofrinho.id);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = novoCofrinho;
        return clone;
      }
      return [...prev, novoCofrinho];
    });

    resetCofrinhoForm();
  };

  const resetCofrinhoForm = () => {
    setCofrinhoFormData({ nome: '', saldo: '', objetivo: '', percentualCDI: '', cor: '#10b981' });
    setEditingCofrinho(null);
    setIsCofrinhoDialogOpen(false);
  };

  const handleEditCofrinho = (cofrinho: Cofrinho) => {
    setEditingCofrinho(cofrinho);
    setCofrinhoFormData({
      nome: cofrinho.nome,
      saldo: cofrinho.saldo.toString(),
      objetivo: cofrinho.objetivo?.toString() || '',
      percentualCDI: cofrinho.percentualCDI.toString(),
      cor: cofrinho.cor,
    });
    setIsCofrinhoDialogOpen(true);
  };

  const handleDeleteCofrinho = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cofrinho?')) return;
    await deleteCofrinho(id);
    setCofrinhos(prev => prev.filter(c => c.id !== id));
  };

  // Funções para receitas previstas
  const handleReceitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receitaFormData.descricao || !receitaFormData.valor || !receitaFormData.dataVencimento) return;

    const novaReceita: ReceitaPrevista = {
      id: editingReceita?.id || Date.now().toString(),
      descricao: receitaFormData.descricao,
      valor: parseFloat(receitaFormData.valor),
      recebido: editingReceita?.recebido || false,
      dataVencimento: receitaFormData.dataVencimento,
    };

    await saveReceitaPrevista(novaReceita);
    resetReceitaForm();
  };

  const resetReceitaForm = () => {
    setReceitaFormData({ descricao: '', valor: '', dataVencimento: '' });
    setEditingReceita(null);
    setIsReceitaDialogOpen(false);
  };

  const handleEditReceita = (receita: ReceitaPrevista) => {
    setEditingReceita(receita);
    setReceitaFormData({
      descricao: receita.descricao,
      valor: receita.valor.toString(),
      dataVencimento: receita.dataVencimento,
    });
    setIsReceitaDialogOpen(true);
  };

  const handleDeleteReceita = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta receita prevista?')) {
      await deleteReceitaPrevista(id);
    }
  };

  const toggleReceitaRecebida = async (receita: ReceitaPrevista) => {
    const receitaAtualizada = { ...receita, recebido: !receita.recebido };
    await saveReceitaPrevista(receitaAtualizada);
  };

  const totalGeral = caixas.reduce((sum, caixa) => sum + caixa.saldo, 0);
  const totalReceitasPrevistas = receitasPrevistas.reduce((sum, receita) => sum + receita.valor, 0);
  const totalReceitasRecebidas = receitasPrevistas.filter(r => r.recebido).reduce((sum, receita) => sum + receita.valor, 0);
  const totalReceitasAReceber = totalReceitasPrevistas - totalReceitasRecebidas;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Caixas</h2>
          <p className="text-muted-foreground">
            Gerencie suas contas, carteiras e investimentos
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Caixa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCaixa ? 'Editar Caixa' : 'Nova Caixa'}
              </DialogTitle>
              <DialogDescription>
                {editingCaixa 
                  ? 'Edite as informações da caixa selecionada.'
                  : 'Adicione uma nova caixa para organizar seus recursos financeiros.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Caixa</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Conta Corrente, Carteira, etc."
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="saldo">Saldo Atual</Label>
                <Input
                  id="saldo"
                  type="number"
                  step="0.01"
                  value={formData.saldo}
                  onChange={(e) => setFormData(prev => ({ ...prev, saldo: e.target.value }))}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select 
                  value={formData.tipo} 
                  onValueChange={(value: Caixa['tipo']) => setFormData(prev => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conta_corrente">Conta Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingCaixa ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Card com total geral */}
      <Card>
        <CardHeader>
          <CardTitle>Total Geral</CardTitle>
          <CardDescription>Soma de todas as caixas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </CardContent>
      </Card>

      {/* Seção de Receitas Previstas */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Receitas Previstas
              </CardTitle>
              <CardDescription>Gerencie seus recebimentos mensais</CardDescription>
            </div>
            <Dialog open={isReceitaDialogOpen} onOpenChange={setIsReceitaDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetReceitaForm()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingReceita ? 'Editar Receita' : 'Nova Receita Prevista'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingReceita 
                      ? 'Edite as informações da receita selecionada.'
                      : 'Adicione uma nova receita prevista para controle de recebimentos.'}
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleReceitaSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="descricao-receita">Descrição</Label>
                    <Input
                      id="descricao-receita"
                      value={receitaFormData.descricao}
                      onChange={(e) => setReceitaFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Ex: Salário Principal, Freelance, etc."
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor-receita">Valor</Label>
                      <Input
                        id="valor-receita"
                        type="number"
                        step="0.01"
                        value={receitaFormData.valor}
                        onChange={(e) => setReceitaFormData(prev => ({ ...prev, valor: e.target.value }))}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="data-vencimento">Data de Vencimento</Label>
                      <Input
                        id="data-vencimento"
                        type="date"
                        value={receitaFormData.dataVencimento}
                        onChange={(e) => setReceitaFormData(prev => ({ ...prev, dataVencimento: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetReceitaForm}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingReceita ? 'Salvar' : 'Criar'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Previsto</p>
              <p className="text-xl font-bold text-blue-600">
                R$ {totalReceitasPrevistas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-xl font-bold text-green-600">
                R$ {totalReceitasRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-muted-foreground">A Receber</p>
              <p className="text-xl font-bold text-orange-600">
                R$ {totalReceitasAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {receitasPrevistas.map((receita) => (
              <div key={receita.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleReceitaRecebida(receita)}
                    className={`p-1 rounded-full ${receita.recebido 
                      ? 'text-green-600 hover:text-green-700' 
                      : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {receita.recebido ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div>
                    <p className={`font-medium ${receita.recebido ? 'line-through text-muted-foreground' : ''}`}>
                      {receita.descricao}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento: {new Date(receita.dataVencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`font-bold ${receita.recebido ? 'text-green-600' : 'text-blue-600'}`}>
                    R$ {receita.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditReceita(receita)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteReceita(receita.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {receitasPrevistas.length === 0 && (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma receita cadastrada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando suas receitas previstas para um melhor controle financeiro.
                </p>
                <Button onClick={() => setIsReceitaDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar primeira receita
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de caixas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {caixas.map((caixa) => {
          const IconComponent = tiposIcon[caixa.tipo];
          
          return (
            <Card key={caixa.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{caixa.nome}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {tiposLabel[caixa.tipo]}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo</p>
                    <p className={`text-2xl font-bold ${
                      caixa.saldo >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      R$ {caixa.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(caixa)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 md:mr-1" />
                      <span className="hidden md:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(caixa.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {caixas.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma caixa cadastrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando sua primeira caixa para organizar seus recursos financeiros.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira caixa
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* Seção de Cofrinhos */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Cofrinhos</h2>
            <p className="text-muted-foreground">
              Seus investimentos com rendimento automático (não somados ao total geral)
            </p>
          </div>
          
          <Dialog open={isCofrinhoDialogOpen} onOpenChange={setIsCofrinhoDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetCofrinhoForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cofrinho
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCofrinho ? 'Editar Cofrinho' : 'Novo Cofrinho'}
                </DialogTitle>
                <DialogDescription>
                  {editingCofrinho 
                    ? 'Edite as informações do cofrinho selecionado.'
                    : 'Crie um novo cofrinho com rendimento automático baseado no CDI.'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleCofrinhoSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome-cofrinho">Nome do Cofrinho</Label>
                  <Input
                    id="nome-cofrinho"
                    value={cofrinhoFormData.nome}
                    onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Emergência, Viagem, Casa..."
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="saldo-cofrinho">Saldo Inicial</Label>
                    <Input
                      id="saldo-cofrinho"
                      type="number"
                      step="0.01"
                      value={cofrinhoFormData.saldo}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, saldo: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="objetivo">Objetivo (opcional)</Label>
                    <Input
                      id="objetivo"
                      type="number"
                      step="0.01"
                      value={cofrinhoFormData.objetivo}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, objetivo: e.target.value }))}
                      placeholder="Meta a atingir"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentual-cdi">% do CDI</Label>
                    <Input
                      id="percentual-cdi"
                      type="number"
                      min="0"
                      max="200"
                      value={cofrinhoFormData.percentualCDI}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, percentualCDI: e.target.value }))}
                      placeholder="Ex: 100 (100% do CDI)"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cor">Cor</Label>
                    <Input
                      id="cor"
                      type="color"
                      value={cofrinhoFormData.cor}
                      onChange={(e) => setCofrinhoFormData(prev => ({ ...prev, cor: e.target.value }))}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetCofrinhoForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingCofrinho ? 'Salvar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de cofrinhos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {cofrinhos.map((cofrinho) => {
            const progressoObjetivo = cofrinho.objetivo 
              ? (cofrinho.saldo / cofrinho.objetivo) * 100 
              : 0;
            
            return (
              <Card key={cofrinho.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: cofrinho.cor }}
                      />
                      <CardTitle className="text-lg">{cofrinho.nome}</CardTitle>
                    </div>
                    <Badge variant="outline" className="flex items-center">
                      <Percent className="h-3 w-3 mr-1" />
                      {cofrinho.percentualCDI}% CDI
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Atual</p>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {cofrinho.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-muted-foreground">Rendimento Mensal</p>
                      <p className="text-sm font-medium text-green-600">
                        +R$ {cofrinho.rendimentoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    
                    {cofrinho.objetivo && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Objetivo</span>
                          <span className="font-medium">
                            R$ {cofrinho.objetivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <Progress value={Math.min(progressoObjetivo, 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                          {progressoObjetivo.toFixed(1)}% concluído
                        </p>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditCofrinho(cofrinho)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 md:mr-1" />
                        <span className="hidden md:inline">Editar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCofrinho(cofrinho.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {cofrinhos.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <PiggyBank className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum cofrinho cadastrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie cofrinhos para organizar seus investimentos com rendimento automático.
              </p>
              <Button onClick={() => setIsCofrinhoDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro cofrinho
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}