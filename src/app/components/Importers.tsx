import React, { useState } from 'react';
import { Plus, Building2, Package, Calendar, MoreVertical, Pencil, Trash2, Search, AlertCircle, Eye } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { ImporterDetail } from '@/app/components/ImporterDetail';

interface Importer {
  id: string;
  name: string;
  productsCount: number;
  lastUpdate: string;
  contactEmail: string;
  contactPhone: string;
  cnpj?: string;
}

// Mock data
const mockImporters: Importer[] = [
  {
    id: '1',
    name: 'Importadora Global Mix',
    productsCount: 1247,
    lastUpdate: '2025-01-15',
    contactEmail: 'contato@globalmix.com.br',
    contactPhone: '(11) 98765-4321',
    cnpj: '12.345.678/0001-90',
  },
  {
    id: '2',
    name: 'Brasil Import Trading',
    productsCount: 892,
    lastUpdate: '2025-01-10',
    contactEmail: 'vendas@brasilimport.com.br',
    contactPhone: '(21) 97654-3210',
    cnpj: '23.456.789/0001-81',
  },
  {
    id: '3',
    name: 'Mega Importações LTDA',
    productsCount: 2103,
    lastUpdate: '2025-01-18',
    contactEmail: 'comercial@megaimport.com.br',
    contactPhone: '(11) 99876-5432',
    cnpj: '34.567.890/0001-72',
  },
  {
    id: '4',
    name: 'Internacional Express',
    productsCount: 567,
    lastUpdate: '2025-01-12',
    contactEmail: 'info@intexpress.com.br',
    contactPhone: '(41) 98765-1234',
    cnpj: '45.678.901/0001-63',
  },
];

export const Importers: React.FC = () => {
  const [importers, setImporters] = useState<Importer[]>(mockImporters);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingImporter, setEditingImporter] = useState<Importer | null>(null);
  const [deletingImporter, setDeletingImporter] = useState<Importer | null>(null);
  const [viewingImporter, setViewingImporter] = useState<Importer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    cnpj: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    cnpj: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors = {
      name: '',
      contactEmail: '',
      contactPhone: '',
      cnpj: '',
    };

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Email é obrigatório';
    } else if (!validateEmail(formData.contactEmail)) {
      newErrors.contactEmail = 'Email inválido';
    }

    if (!formData.contactPhone.trim()) {
      newErrors.contactPhone = 'Telefone é obrigatório';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== '');
  };

  const handleAddImporter = () => {
    if (!validateForm()) return;

    const newImporter: Importer = {
      id: Date.now().toString(),
      name: formData.name,
      productsCount: 0,
      lastUpdate: new Date().toISOString().split('T')[0],
      contactEmail: formData.contactEmail,
      contactPhone: formData.contactPhone,
      cnpj: formData.cnpj,
    };

    setImporters([...importers, newImporter]);
    toast.success('Importadora adicionada com sucesso!');
    closeDialog();
  };

  const handleEditImporter = (importer: Importer) => {
    setEditingImporter(importer);
    setFormData({
      name: importer.name,
      contactEmail: importer.contactEmail,
      contactPhone: importer.contactPhone,
      cnpj: importer.cnpj || '',
    });
    setShowAddDialog(true);
  };

  const handleUpdateImporter = () => {
    if (!validateForm() || !editingImporter) return;

    setImporters(
      importers.map((imp) =>
        imp.id === editingImporter.id
          ? {
              ...imp,
              name: formData.name,
              contactEmail: formData.contactEmail,
              contactPhone: formData.contactPhone,
              cnpj: formData.cnpj,
            }
          : imp
      )
    );

    toast.success('Importadora atualizada com sucesso!');
    closeDialog();
  };

  const confirmDeleteImporter = (importer: Importer) => {
    setDeletingImporter(importer);
    setShowDeleteDialog(true);
  };

  const handleDeleteImporter = () => {
    if (!deletingImporter) return;

    setImporters(importers.filter((imp) => imp.id !== deletingImporter.id));
    toast.success('Importadora excluída com sucesso!');
    setShowDeleteDialog(false);
    setDeletingImporter(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingImporter(null);
    setFormData({ name: '', contactEmail: '', contactPhone: '', cnpj: '' });
    setErrors({ name: '', contactEmail: '', contactPhone: '', cnpj: '' });
  };

  const filteredImporters = importers.filter((importer) =>
    importer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    importer.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    importer.cnpj?.includes(searchTerm)
  );

  // Se estiver visualizando uma importadora, mostrar a página de detalhes
  if (viewingImporter) {
    return (
      <ImporterDetail
        importer={viewingImporter}
        onBack={() => setViewingImporter(null)}
        onUpdate={(updatedImporter) => {
          setImporters(
            importers.map((imp) =>
              imp.id === updatedImporter.id ? updatedImporter : imp
            )
          );
          setViewingImporter(updatedImporter);
        }}
        onDelete={(importerId) => {
          setImporters(importers.filter((imp) => imp.id !== importerId));
          toast.success('Importadora excluída com sucesso!');
          setViewingImporter(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="mb-1">Importadoras</h2>
          <p className="text-muted-foreground">
            Gerencie as importadoras cadastradas na plataforma
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Importadora
        </Button>
      </div>

      {/* Busca */}
      {importers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou CNPJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Lista de Importadoras */}
      {filteredImporters.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredImporters.map((importer) => (
            <Card 
              key={importer.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setViewingImporter(importer)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg truncate">{importer.name}</CardTitle>
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {importer.productsCount.toLocaleString('pt-BR')} produtos cadastrados
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Última atualização: {formatDate(importer.lastUpdate)}
                  </span>
                </div>
                <div className="pt-2 border-t space-y-1">
                  {importer.cnpj && (
                    <p className="text-xs text-muted-foreground">
                      CNPJ: {importer.cnpj}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Email: {importer.contactEmail}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Telefone: {importer.contactPhone}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : importers.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg">Nenhuma importadora cadastrada</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Comece adicionando sua primeira importadora para gerenciar catálogos e produtos.
            </p>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="bg-primary hover:bg-primary/90 mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Primeira Importadora
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg">Nenhuma importadora encontrada</h3>
            <p className="text-muted-foreground">
              Tente buscar com outros termos
            </p>
          </div>
        </Card>
      )}

      {/* Dialog de Adicionar/Editar */}
      <Dialog open={showAddDialog} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingImporter ? 'Editar Importadora' : 'Nova Importadora'}
            </DialogTitle>
            <DialogDescription>
              {editingImporter
                ? 'Atualize as informações da importadora'
                : 'Adicione uma nova importadora ao sistema'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm">Nome da Importadora *</label>
              <Input
                placeholder="Ex: Importadora Global Mix"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setErrors({ ...errors, name: '' });
                }}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm">CNPJ</label>
              <Input
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => {
                  setFormData({ ...formData, cnpj: e.target.value });
                  setErrors({ ...errors, cnpj: '' });
                }}
              />
              {errors.cnpj && (
                <p className="text-xs text-destructive">{errors.cnpj}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Email de Contato *</label>
              <Input
                type="email"
                placeholder="contato@importadora.com.br"
                value={formData.contactEmail}
                onChange={(e) => {
                  setFormData({ ...formData, contactEmail: e.target.value });
                  setErrors({ ...errors, contactEmail: '' });
                }}
              />
              {errors.contactEmail && (
                <p className="text-xs text-destructive">{errors.contactEmail}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Telefone *</label>
              <Input
                placeholder="(11) 98765-4321"
                value={formData.contactPhone}
                onChange={(e) => {
                  setFormData({ ...formData, contactPhone: e.target.value });
                  setErrors({ ...errors, contactPhone: '' });
                }}
              />
              {errors.contactPhone && (
                <p className="text-xs text-destructive">{errors.contactPhone}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button
              onClick={editingImporter ? handleUpdateImporter : handleAddImporter}
              className="bg-primary hover:bg-primary/90"
            >
              {editingImporter ? 'Atualizar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
              </div>
            </div>
            <DialogDescription>
              Tem certeza que deseja excluir esta importadora? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir a importadora{' '}
              <span className="font-semibold text-foreground">
                {deletingImporter?.name}
              </span>
              ? Todos os produtos e dados relacionados serão mantidos, mas a associação será removida.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteImporter}
              variant="destructive"
            >
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};