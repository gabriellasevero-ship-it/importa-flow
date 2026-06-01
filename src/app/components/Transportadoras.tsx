import React, { useState } from 'react';
import { Truck, Plus, Edit, Trash2, Search, MapPin, Phone, Building2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { useTransportadoras } from '@/hooks/useData';
import { toast } from 'sonner';
import { Transportadora } from '@/types';

type ViewMode = 'list' | 'form';

export const Transportadoras: React.FC = () => {
  const { transportadoras } = useTransportadoras();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransportadora, setSelectedTransportadora] = useState<Transportadora | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transportadoraToDelete, setTransportadoraToDelete] = useState<Transportadora | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    phone: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

  // Filtrar transportadoras
  const filteredTransportadoras = transportadoras.filter(transportadora =>
    transportadora.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transportadora.cnpj.includes(searchTerm) ||
    transportadora.phone.includes(searchTerm)
  );

  const handleAddNew = () => {
    setSelectedTransportadora(null);
    setFormData({
      name: '',
      cnpj: '',
      phone: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
    });
    setViewMode('form');
  };

  const handleEdit = (transportadora: Transportadora) => {
    setSelectedTransportadora(transportadora);
    setFormData({
      name: transportadora.name,
      cnpj: transportadora.cnpj,
      phone: transportadora.phone,
      cep: transportadora.cep,
      street: transportadora.street,
      number: transportadora.number,
      complement: transportadora.complement,
      neighborhood: transportadora.neighborhood,
      city: transportadora.city,
      state: transportadora.state,
    });
    setViewMode('form');
  };

  const handleDeleteClick = (transportadora: Transportadora) => {
    setTransportadoraToDelete(transportadora);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (transportadoraToDelete) {
      toast.success(`Transportadora "${transportadoraToDelete.name}" excluída com sucesso!`);
      setShowDeleteDialog(false);
      setTransportadoraToDelete(null);
      // Em produção, aqui faria a chamada ao backend
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.cnpj || !formData.phone || !formData.street || !formData.number || !formData.city || !formData.state) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (selectedTransportadora) {
      toast.success(`Transportadora "${formData.name}" atualizada com sucesso!`);
    } else {
      toast.success(`Transportadora "${formData.name}" cadastrada com sucesso!`);
    }

    setViewMode('list');
    // Em produção, aqui faria a chamada ao backend
  };

  const formatCNPJ = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 14) {
      return cleaned
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4,5})(\d{4})$/, '$1-$2');
    }
    return value;
  };

  const formatCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 8) {
      return cleaned.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

  const getFullAddress = (transportadora: Transportadora) => {
    const parts = [
      transportadora.street,
      transportadora.number,
      transportadora.complement,
      transportadora.neighborhood,
      transportadora.city,
      transportadora.state,
      `CEP: ${transportadora.cep}`
    ];
    return parts.filter(Boolean).join(', ');
  };

  return (
    <div className="space-y-4">
      {viewMode === 'list' && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2>Transportadoras</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie as transportadoras cadastradas
              </p>
            </div>

            <Button
              onClick={handleAddNew}
              className="bg-primary hover:bg-primary/90 flex-shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Transportadora
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Transportadoras List */}
          <div className="grid gap-3">
            {filteredTransportadoras.map(transportadora => (
              <Card key={transportadora.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-secondary/10">
                          <Truck className="w-5 h-5 text-secondary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{transportadora.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Cadastrado em {transportadora.createdAt.toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">CNPJ</p>
                            <p className="font-medium">{transportadora.cnpj}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">Telefone</p>
                            <p className="font-medium">{transportadora.phone}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 md:col-span-2">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Endereço</p>
                            <p className="font-medium">{getFullAddress(transportadora)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(transportadora)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(transportadora)}
                        className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredTransportadoras.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma transportadora encontrada</p>
            </div>
          )}
        </>
      )}

      {viewMode === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('list')}
              className="mb-4"
            >
              ← Voltar
            </Button>

            <h2>{selectedTransportadora ? 'Editar Transportadora' : 'Nova Transportadora'}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedTransportadora 
                ? 'Atualize as informações da transportadora' 
                : 'Preencha os dados da nova transportadora'}
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Nome da Transportadora *
                </label>
                <Input
                  placeholder="Ex: Transportadora Rápida Express"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    CNPJ *
                  </label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: formatCNPJ(e.target.value) })}
                    maxLength={18}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Telefone *
                  </label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    maxLength={15}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Endereço Completo
                </label>
                
                <div className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="CEP *"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: formatCEP(e.target.value) })}
                        maxLength={9}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-3">
                    <div className="md:col-span-3">
                      <Input
                        placeholder="Rua/Avenida *"
                        value={formData.street}
                        onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Número *"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Input
                        placeholder="Complemento (opcional)"
                        value={formData.complement}
                        onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Bairro *"
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Input
                        placeholder="Cidade *"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Input
                        placeholder="Estado (UF) *"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                        maxLength={2}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMode('list')}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary">
              {selectedTransportadora ? 'Salvar Alterações' : 'Cadastrar Transportadora'}
            </Button>
          </div>
        </form>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Transportadora</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a transportadora "{transportadoraToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};