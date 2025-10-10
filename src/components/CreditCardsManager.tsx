import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Plus, CreditCard } from 'lucide-react';
import { FinanceiroContext, CartaoCredito, CompraCartao, GastoFixo } from '../App';

export default function CreditCardsManager() {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { cartoes, setCartoes, comprasCartao, setComprasCartao, saveCartao, saveCompraCartao } = context as any;

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const scrollBeforeDialogRef = useRef<number>(0);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [cardName, setCardName] = useState('');

  const [desc, setDesc] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [parcelas, setParcelas] = useState('1');
  const [valorParcela, setValorParcela] = useState('');
  const [startMonth, setStartMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const [dataCompra, setDataCompra] = useState(() => new Date().toISOString().slice(0,10));

  const selectedCard = useMemo(() => cartoes.find((c: CartaoCredito) => c.id === selectedCardId) || null, [selectedCardId, cartoes]);

  const recomputeParcela = (totalStr: string, parcelasStr: string) => {
    const total = parseFloat(totalStr || '0');
    const p = parseInt(parcelasStr || '1');
    if (!isFinite(total) || !isFinite(p) || p <= 0) return '';
    const base = Math.floor((total / p) * 100) / 100;
    return base.toFixed(2);
  };

  const ymToIndex = (year: number, month1to12: number) => year * 12 + (month1to12 - 1);
  const addMonths = (y: number, m1to12: number, add: number) => {
    const idx = ymToIndex(y, m1to12) + add;
    const ny = Math.floor(idx / 12);
    const nm = (idx % 12) + 1;
    return { y: ny, m: nm };
  };
  const getInstallmentValue = (total: number, parcelaBase: number, totalParcelas: number, index: number) => {
    const delta = Math.round(total * 100) - Math.round(parcelaBase * 100) * totalParcelas;
    const isLast = index === totalParcelas - 1;
    return parcelaBase + (isLast ? delta / 100 : 0);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim()) return;
    const card: CartaoCredito = { id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(), nome: cardName.trim() } as any;
    await saveCartao(card);
    setCartoes((prev: CartaoCredito[]) => [...prev, card]);
    setCardName('');
    setIsCardDialogOpen(false);
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !desc || !valorTotal || !valorParcela || !startMonth) return;
    const p: CompraCartao = {
      id: (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(),
      cardId: selectedCardId,
      descricao: desc,
      valorTotal: parseFloat(valorTotal),
      parcelas: parseInt(parcelas || '1'),
      valorParcela: parseFloat(valorParcela),
      startMonth,
      dataCompra,
      parcelasPagas: 0,
    } as any;
    await saveCompraCartao(p);
    setComprasCartao((prev: CompraCartao[]) => [...prev, p]);


    setIsPurchaseDialogOpen(false);
    setDesc(''); setValorTotal(''); setParcelas('1'); setValorParcela('');
  };

  // Totais da fatura por mês (exibe para o mês atual)
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  });
  const faturaDoMes = (cardId: string) => {
    return comprasCartao
      .filter((c: CompraCartao) => c.cardId === cardId)
      .reduce((sum: number, c: CompraCartao) => {
        const [sy, sm] = c.startMonth.split('-').map(Number);
        const [yy, ym] = mesSelecionado.split('-').map(Number);
        const idx = ymToIndex(yy, ym) - ymToIndex(sy, sm);
        if (idx < 0 || idx >= c.parcelas) return sum;
        return sum + getInstallmentValue(c.valorTotal, c.valorParcela, c.parcelas, idx);
      }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cartões de Crédito</h2>
          <p className="text-muted-foreground">Gerencie seus cartões e compras</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCardDialogOpen} onOpenChange={(o) => { setIsCardDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Novo Cartão
              </Button>
            </DialogTrigger>
            <DialogContent 
              className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}
              style={isMobile ? { maxHeight: '90vh', overflowY: 'scroll' } : {}}
            >
              <DialogHeader>
                <DialogTitle>Novo Cartão</DialogTitle>
                <DialogDescription>Informe o nome do cartão</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCard} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="card-name">Nome</Label>
                  <Input id="card-name" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank" required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCardDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isPurchaseDialogOpen} onOpenChange={(o) => { setIsPurchaseDialogOpen(o); if (!o) { try { setTimeout(() => window.scrollTo(0, scrollBeforeDialogRef.current || 0), 0); } catch {} } }}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Plus className="h-4 w-4 mr-2" /> Nova Compra
              </Button>
            </DialogTrigger>
            <DialogContent 
              className={isMobile ? "max-h-[90vh] overflow-y-auto overscroll-contain" : ""}
              style={isMobile ? { maxHeight: '90vh', overflowY: 'scroll' } : {}}
            >
              <DialogHeader>
                <DialogTitle>Nova Compra</DialogTitle>
                <DialogDescription>Adicione uma compra ao cartão selecionado</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreatePurchase} className="space-y-4">
                <div className="space-y-2">
                  <Label>Cartão</Label>
                  <select className="w-full border rounded h-9 px-2 bg-background" value={selectedCardId || ''} onChange={(e) => setSelectedCardId(e.target.value)} required>
                    <option value="" disabled>Selecione</option>
                    {cartoes.map((c: CartaoCredito) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor Total</Label>
                    <Input type="number" step="0.01" value={valorTotal} onChange={(e) => { setValorTotal(e.target.value); setValorParcela(recomputeParcela(e.target.value, parcelas)); }} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Input type="number" min="1" value={parcelas} onChange={(e) => { setParcelas(e.target.value); setValorParcela(recomputeParcela(valorTotal, e.target.value)); }} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor da Parcela</Label>
                  <Input type="number" step="0.01" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Começa a cobrar em</Label>
                    <Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Data da compra</Label>
                    <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsPurchaseDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">Adicionar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Mês</div>
        <Input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="w-[180px]" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cartões</CardTitle>
          <CardDescription>{cartoes.length} cartão(ões)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cartão</TableHead>
                <TableHead className="text-right">Fatura do mês</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cartoes.map((c: CartaoCredito) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> {c.nome}</TableCell>
                  <TableCell className="text-right font-medium">R$ {faturaDoMes(c.id).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


