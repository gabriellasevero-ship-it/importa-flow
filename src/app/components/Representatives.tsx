import React, { useState } from 'react';
import { Search, Plus, UserCheck, UserX, Clock, Building2, Mail, Phone, FileText, User, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/app/components/ui/utils';

type RepresentativeStatus = 'active' | 'pending' | 'suspended';

interface Representative {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cnpj?: string;
  company?: string;
  importerId?: string;
  status: RepresentativeStatus;
  createdAt: string;
  totalSales?: number;
}

const mockRepresentatives: Representative[] = [
  {
    id: '1',
    name: 'Ana Silva',
    email: 'ana.silva@email.com',
    phone: '(11) 98765-4321',
    cpf: '123.456.789-00',
    cnpj: '12.345.678/0001-90',
    company: 'AS Representações',
    status: 'active',
    createdAt: '2024-01-15',
    totalSales: 45000,
  },
  {
    id: '2',
    name: 'Carlos Mendes',
    email: 'carlos.mendes@email.com',
    phone: '(21) 99876-5432',
    cpf: '987.654.321-00',
    status: 'active',
    createdAt: '2024-02-10',
    totalSales: 32000,
  },
  {
    id: '3',
    name: 'Mariana Costa',
    email: 'mariana.costa@email.com',
    phone: '(31) 97654-3210',
    cpf: '456.789.123-00',
    cnpj: '98.765.432/0001-10',
    company: 'MC Vendas',
    status: 'pending',
    createdAt: '2024-03-20',
  },
  {
    id: '4',
    name: 'Roberto Santos',
    email: 'roberto.santos@email.com',
    phone: '(41) 96543-2109',
    cpf: '789.123.456-00',
    status: 'suspended',
    createdAt: '2023-11-05',
    totalSales: 12000,
  },
];

// Mock de importadoras disponíveis
const mockImporters = [
  { id: '1', name: 'Importadora Global Mix' },
  { id: '2', name: 'Brasil Import Trading' },
  { id: '3', name: 'Mega Importações LTDA' },
  { id: '4', name: 'Internacional Express' },
];

const statusConfig = {
  active: {
    label: 'Ativa',
    color: 'bg-green-600',
    icon: UserCheck,
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  pending: {
    label: 'Pendente',
    color: 'bg-yellow-600',
    icon: Clock,
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
  },
  suspended: {
    label: 'Suspensa',
    color: 'bg-red-600',
    icon: UserX,
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
  },
};

export const Representatives: React.FC = () => {
  const [representatives, setRepresentatives] = useState<Representative[]>(mockRepresentatives);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RepresentativeStatus | 'all'>('all');
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingRepresentative, setEditingRepresentative] = useState<Representative | null>(null);
  const [deletingRepresentative, setDeletingRepresentative] = useState<Representative | null>(null);
  const [openImporterCombobox, setOpenImporterCombobox] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    cnpj: '',
    company: '',
    importerId: '',
    status: 'pending' as RepresentativeStatus,
  });

  const handleAdd = () => {
    setEditingRepresentative(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      cpf: '',
      cnpj: '',
      company: '',
      importerId: '',
      status: 'pending',
    });
    setShowDialog(true);
  };

  const handleEdit = (representative: Representative) => {
    setEditingRepresentative(representative);
    setFormData({
      name: representative.name,
      email: representative.email,
      phone: representative.phone,
      cpf: representative.cpf,
      cnpj: representative.cnpj || '',
      company: representative.company || '',
      importerId: representative.importerId || '',
      status: representative.status,
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.phone || !formData.cpf) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const representativeData: Representative = {
      id: editingRepresentative?.id || Date.now().toString(),
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      cpf: formData.cpf,
      cnpj: formData.cnpj || undefined,
      company: formData.company || undefined,
      importerId: formData.importerId || undefined,
      status: formData.status,
      createdAt: editingRepresentative?.createdAt || new Date().toISOString().split('T')[0],
      totalSales: editingRepresentative?.totalSales,
    };

    if (editingRepresentative) {
      setRepresentatives(
        representatives.map((r) => (r.id === editingRepresentative.id ? representativeData : r))
      );
      toast.success('Representante atualizado com sucesso!');
    } else {
      setRepresentatives([...representatives, representativeData]);
      toast.success('Representante cadastrado com sucesso!');
    }

    setShowDialog(false);
  };

  const confirmDelete = (representative: Representative) => {
    setDeletingRepresentative(representative);
    setShowDeleteDialog(true);
  };

  const handleDelete = () => {
    if (!editingRepresentative) return;
    setRepresentatives(representatives.filter((r) => r.id !== editingRepresentative.id));
    toast.success('Representante excluído com sucesso!');
    setShowDialog(false);
    setShowDeleteDialog(false);
    setEditingRepresentative(null);
  };

  const handleStatusChange = (id: string, newStatus: RepresentativeStatus) => {
    setRepresentatives(
      representatives.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
    const statusLabel = statusConfig[newStatus].label;
    toast.success(`Status alterado para ${statusLabel}`);
  };

  const filteredRepresentatives = representatives.filter((rep) => {
    const matchesSearch =
      rep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.cpf.includes(searchTerm) ||
      (rep.company && rep.company.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || rep.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    active: representatives.filter((r) => r.status === 'active').length,
    pending: representatives.filter((r) => r.status === 'pending').length,
    suspended: representatives.filter((r) => r.status === 'suspended').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="mb-2">Representantes</h2>
        <p className="text-muted-foreground">
          Gerencie os representantes cadastrados na plataforma
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Suspensos</p>
              <p className="text-2xl font-bold">{stats.suspended}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail, CPF ou empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="suspended">Suspensa</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Representante
        </Button>
      </div>

      {/* Representatives List */}
      {filteredRepresentatives.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredRepresentatives.map((rep) => {
            const StatusIcon = statusConfig[rep.status].icon;
            return (
              <Card key={rep.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Header com Nome e Status */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{rep.name}</h3>
                            <Badge
                              className={`${statusConfig[rep.status].color} text-white`}
                            >
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig[rep.status].label}
                            </Badge>
                          </div>
                          {rep.company && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {rep.company}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Informações de Contato */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4 shrink-0" />
                          <span className="truncate">{rep.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4 shrink-0" />
                          <span>{rep.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span>CPF: {rep.cpf}</span>
                        </div>
                        {rep.cnpj && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span>CNPJ: {rep.cnpj}</span>
                          </div>
                        )}
                      </div>

                      {/* Vendas Totais */}
                      {rep.totalSales && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground">
                            Vendas totais:{' '}
                            <span className="font-semibold text-foreground">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(rep.totalSales)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-4 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(rep)}
                      >
                        Editar
                      </Button>
                      <Select
                        value={rep.status}
                        onValueChange={(value: RepresentativeStatus) =>
                          handleStatusChange(rep.id, value)
                        }
                      >
                        <SelectTrigger 
                          className={cn(
                            "w-[140px]",
                            rep.status === 'active' && "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
                            rep.status === 'pending' && "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100",
                            rep.status === 'suspended' && "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativar</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="suspended">Suspender</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg">Nenhum representante encontrado</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all'
                ? 'Tente buscar com outros termos ou altere os filtros'
                : 'Comece adicionando seu primeiro representante'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Representante
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Dialog de Adicionar/Editar */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRepresentative ? 'Editar Representante' : 'Adicionar Representante'}
            </DialogTitle>
            <DialogDescription>
              {editingRepresentative
                ? 'Atualize as informações do representante'
                : 'Cadastre um novo representante na plataforma'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ana Silva"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 98765-4321"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="123.456.789-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ (se aplicável)</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="12.345.678/0001-90"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa (se aplicável)</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Ex: AS Representações"
              />
            </div>

            <div className="space-y-2">
              <Label>Importadora Associada (opcional)</Label>
              <Popover open={openImporterCombobox} onOpenChange={setOpenImporterCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openImporterCombobox}
                    className="w-full justify-between"
                  >
                    {formData.importerId
                      ? mockImporters.find((importer) => importer.id === formData.importerId)
                          ?.name
                      : 'Selecione uma importadora...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar importadora..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma importadora encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => {
                            setFormData({ ...formData, importerId: '', company: '' });
                            setOpenImporterCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              formData.importerId === '' ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          Nenhuma (representante autônoma)
                        </CommandItem>
                        {mockImporters.map((importer) => (
                          <CommandItem
                            key={importer.id}
                            value={importer.name}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                importerId: importer.id,
                                company: importer.name,
                              });
                              setOpenImporterCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                formData.importerId === importer.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {importer.name}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Vincule a representante a uma importadora ou deixe como autônoma
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status da Conta *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: RepresentativeStatus) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">🟢 Ativa</SelectItem>
                  <SelectItem value="pending">🟡 Pendente</SelectItem>
                  <SelectItem value="suspended">🔴 Suspensa</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.status === 'active' &&
                  'Representante pode acessar o sistema e realizar vendas'}
                {formData.status === 'pending' &&
                  'Aguardando aprovação ou ativação pelo administrador'}
                {formData.status === 'suspended' &&
                  'Representante não pode acessar o sistema'}
              </p>
            </div>
          </div>
          <DialogFooter>
            {editingRepresentative && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
              {editingRepresentative ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o representante{' '}
              <span className="font-semibold text-foreground">
                {editingRepresentative?.name}
              </span>
              ? Todos os dados e histórico de vendas serão mantidos, mas o acesso será removido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDelete} variant="destructive">
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};