import React, { useContext, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Settings, Plus, Edit, Trash2, Tag } from 'lucide-react';
import { FinanceiroContext, Categoria } from '../App';

interface CategoriasManagerProps {
  onCategoriaSelect?: (categoria: string) => void;
}

export default function CategoriasManager({ onCategoriaSelect }: CategoriasManagerProps) {
  const context = useContext(FinanceiroContext);
  if (!context) return null;

  const { categorias, setCategorias, saveCategoria, deleteCategoria } = context;
  
  const [isMainDialogOpen, setIsMainDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState('');

  const handleAdicionarCategoria = async () => {
    if (novaCategoria.trim() && !categorias.some(cat => cat.nome.toLowerCase() === novaCategoria.trim().toLowerCase())) {
      const novaId = ((typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : (Math.max(...categorias.map(c => parseInt(c.id))) + 1).toString());
      await saveCategoria({ id: novaId, nome: novaCategoria.trim() });
      if (onCategoriaSelect) {
        onCategoriaSelect(novaCategoria.trim());
      }
      setNovaCategoria('');
      setIsAddDialogOpen(false);
    }
  };

  const handleEditarCategoria = async () => {
    if (editandoCategoria && nomeEdicao.trim() && 
        !categorias.some(cat => cat.nome.toLowerCase() === nomeEdicao.trim().toLowerCase() && cat.id !== editandoCategoria.id)) {
      await saveCategoria({ ...editandoCategoria, nome: nomeEdicao.trim() });
      setEditandoCategoria(null);
      setNomeEdicao('');
      setIsEditDialogOpen(false);
    }
  };

  const handleExcluirCategoria = async (categoria: Categoria) => {
    if (confirm(`Tem certeza que deseja excluir a categoria "${categoria.nome}"?`)) {
      await deleteCategoria(categoria.id);
    }
  };

  const iniciarEdicao = (categoria: Categoria) => {
    setEditandoCategoria(categoria);
    setNomeEdicao(categoria.nome);
    setIsEditDialogOpen(true);
  };

  const categoriasOrdenadas = categorias.sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <>
      {/* Botão principal para abrir gerenciador */}
      <Dialog open={isMainDialogOpen} onOpenChange={setIsMainDialogOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2"
          >
            <Settings className="h-3 w-3 mr-1" />
            Gerenciar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Adicione, edite ou exclua suas categorias personalizadas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Botão para adicionar nova categoria */}
            <div className="flex justify-end">
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nova Categoria</DialogTitle>
                    <DialogDescription>
                      Crie uma nova categoria personalizada.
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
                        setIsAddDialogOpen(false);
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
                      Criar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Lista de categorias */}
            <div className="max-h-96 overflow-auto">
              <div className="grid gap-2">
                {categoriasOrdenadas.map((categoria) => (
                  <div 
                    key={categoria.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                  >
                    <div className="flex items-center space-x-3">
                      <Badge variant="secondary">
                        {categoria.nome}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => iniciarEdicao(categoria)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExcluirCategoria(categoria)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsMainDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar categoria */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>
              Modifique o nome da categoria selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editar-categoria">Nome da Categoria</Label>
              <Input
                id="editar-categoria"
                value={nomeEdicao}
                onChange={(e) => setNomeEdicao(e.target.value)}
                placeholder="Nome da categoria..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleEditarCategoria();
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
                setEditandoCategoria(null);
                setNomeEdicao('');
                setIsEditDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleEditarCategoria}
              disabled={!nomeEdicao.trim()}
            >
              <Edit className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}