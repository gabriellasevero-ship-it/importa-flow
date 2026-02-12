import React, { useState } from 'react';
import { Plus, Building2, Package, Calendar, Search, AlertCircle, Eye } from 'lucide-react';
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
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { toast } from 'sonner';
import { ImporterDetail } from '@/app/components/ImporterDetail';
import { useImportadoras, useProducts } from '@/hooks/useData';
import {
  createImportadora,
  updateImportadora,
  deleteImportadora,
} from '@/services/importadoras';
import type { Importadora } from '@/types';

/** Formato esperado pelo ImporterDetail (compatível com dados reais + campos opcionais) */
interface ImporterView {
  id: string;
  name: string;
  productsCount: number;
  lastUpdate: string;
  contactEmail: string;
  contactPhone: string;
  cnpj?: string;
}

function toImporterView(imp: Importadora, productsCount: number): ImporterView {
  return {
    id: imp.id,
    name: imp.name,
    productsCount,
    lastUpdate: imp.createdAt.toISOString().split('T')[0],
    contactEmail: '',
    contactPhone: '',
    cnpj: imp.cnpj,
  };
}

export const Importers: React.FC = () => {
  const { importadoras, loading, refetch } = useImportadoras();
  const { products } = useProducts();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingImporter, setEditingImporter] = useState<Importadora | null>(null);
  const [deletingImporter, setDeletingImporter] = useState<ImporterView | null>(null);
  const [viewingImporter, setViewingImporter] = useState<ImporterView | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    active: true,
  });
  const [errors, setErrors] = useState({ name: '', cnpj: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getProductsCount = (importadoraId: string) =>
    products.filter((p) => p.importadoraId === importadoraId).length;

  const importersView: ImporterView[] = importadoras.map((imp) =>
    toImporterView(imp, getProductsCount(imp.id))
  );

  const validateForm = () => {
    const newErrors = { name: '', cnpj: '' };
    if (!formData.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!formData.cnpj.trim()) newErrors.cnpj = 'CNPJ é obrigatório';
    setErrors(newErrors);
    return !Object.values(newErrors).some((e) => e !== '');
  };

  const handleAddImporter = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await createImportadora({
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim(),
        active: formData.active,
      });
      await refetch();
      toast.success('Importadora adicionada com sucesso!');
      closeDialog();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível adicionar a importadora.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditImporter = (importer: ImporterView) => {
    const imp = importadoras.find((i) => i.id === importer.id);
    if (!imp) return;
    setEditingImporter(imp);
    setFormData({
      name: imp.name,
      cnpj: imp.cnpj,
      active: imp.active,
    });
    setShowAddDialog(true);
  };

  const handleUpdateImporter = async () => {
    if (!validateForm() || !editingImporter) return;
    setSaving(true);
    try {
      await updateImportadora(editingImporter.id, {
        name: formData.name.trim(),
        cnpj: formData.cnpj.trim(),
        active: formData.active,
      });
      await refetch();
      toast.success('Importadora atualizada com sucesso!');
      closeDialog();
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível atualizar a importadora.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteImporter = (importer: ImporterView) => {
    setDeletingImporter(importer);
    setShowDeleteDialog(true);
  };

  const handleDeleteImporter = async () => {
    if (!deletingImporter) return;
    setDeleting(true);
    try {
      await deleteImportadora(deletingImporter.id);
      await refetch();
      toast.success('Importadora excluída com sucesso!');
      setShowDeleteDialog(false);
      setDeletingImporter(null);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir a importadora.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setEditingImporter(null);
    setFormData({ name: '', cnpj: '', active: true });
    setErrors({ name: '', cnpj: '' });
  };

  const filteredImporters = importersView.filter(
    (importer) =>
      importer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      importer.cnpj?.includes(searchTerm)
  );

  if (viewingImporter) {
    return (
      <ImporterDetail
        importer={viewingImporter}
        onBack={() => setViewingImporter(null)}
        onUpdate={(updatedImporter) => {
          refetch();
          setViewingImporter({
            ...updatedImporter,
            productsCount: getProductsCount(updatedImporter.id),
          });
        }}
        onDelete={async (importerId) => {
          try {
            await deleteImportadora(importerId);
            await refetch();
            toast.success('Importadora excluída com sucesso!');
            setViewingImporter(null);
          } catch (e) {
            console.error(e);
            toast.error('Não foi possível excluir a importadora.');
          }
        }}
      />
    );
  }

  if (loading && importadoras.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="mb-1">Importadoras</h2>
            <p className="text-muted-foreground">
              Gerencie as importadoras cadastradas na plataforma
            </p>
          </div>
        </div>
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            Carregando importadoras...
          </div>
        </Card>
      </div>
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
      {importadoras.length > 0 && (
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : importadoras.length === 0 && !loading ? (
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
              <Label>Nome da Importadora *</Label>
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
              <Label>CNPJ *</Label>
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
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Importadoras inativas não aparecem nas listagens.
                </p>
              </div>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={editingImporter ? handleUpdateImporter : handleAddImporter}
              className="bg-primary hover:bg-primary/90"
              disabled={saving}
            >
              {saving ? 'Salvando...' : editingImporter ? 'Atualizar' : 'Adicionar'}
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
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteImporter}
              variant="destructive"
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};