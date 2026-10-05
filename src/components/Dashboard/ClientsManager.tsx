
import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Users, 
  Mail, 
  Phone, 
  UserCheck, 
  Target, 
  TrendingUp, 
  MoreHorizontal, 
  UserCog, 
  Trash2,
  Plus,
  Search,
  Eye,
  Package,
  Building2,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import ClientForm from './ClientForm';
import { toast } from 'sonner';

interface ClientsManagerProps {
  contactType?: 'cliente' | 'fornecedor' | 'prospecto' | 'all';
}

const ClientsManager = ({ contactType = 'all' }: ClientsManagerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { clients, loading, createClient, updateClient, deleteClient, refetch } = useClients(contactType);

  // --- IMPORT ---
  const CSV_HEADERS = ['nome', 'email', 'telefone', 'whatsapp', 'empresa', 'cpf_cnpj', 'profissao', 'rua', 'numero', 'cidade', 'estado', 'cep', 'status', 'tags'];

  const generateTemplate = () => {
    const header = CSV_HEADERS.join(';');
    const example = 'João Silva;joao@email.com;(11) 99999-0000;(11) 99999-0000;Empresa Ltda;123.456.789-00;Engenheiro;Rua Exemplo;100;São Paulo;SP;01000-000;active;vip,parceiro';
    const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${contactType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template baixado!');
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error('Arquivo vazio ou sem dados.'); return; }

    const headerLine = lines[0].toLowerCase();
    const sep = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(sep).map(h => h.trim());

    const fieldMap: Record<string, string> = {
      nome: 'name', name: 'name',
      email: 'email', 'e-mail': 'email',
      telefone: 'phone', phone: 'phone', tel: 'phone',
      whatsapp: 'whatsapp',
      empresa: 'company_name', company: 'company_name', company_name: 'company_name',
      cpf_cnpj: 'cnpj_cpf', cpf: 'cnpj_cpf', cnpj: 'cnpj_cpf',
      profissao: 'profession', profession: 'profession',
      rua: 'address_street', address_street: 'address_street',
      numero: 'address_number', address_number: 'address_number',
      cidade: 'address_city', city: 'address_city', address_city: 'address_city',
      estado: 'address_state', state: 'address_state', address_state: 'address_state', uf: 'address_state',
      cep: 'address_zip', zip: 'address_zip', address_zip: 'address_zip',
      status: 'status',
      tags: 'tags',
    };

    let success = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map(v => v.trim());
      const row: Record<string, any> = {};
      headers.forEach((h, idx) => {
        const mapped = fieldMap[h];
        if (mapped && values[idx]) {
          row[mapped] = values[idx];
        }
      });

      if (!row.name) { errors.push(`Linha ${i + 1}: nome obrigatório`); continue; }

      if (row.tags && typeof row.tags === 'string') {
        row.tags = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      }

      row.client_type = contactType !== 'all' ? contactType : 'cliente';

      try {
        await createClient(row as any);
        success++;
      } catch (err: any) {
        errors.push(`Linha ${i + 1}: ${err.message || 'erro desconhecido'}`);
      }
    }

    setImportResult({ success, errors });
    if (fileInputRef.current) fileInputRef.current.value = '';
    refetch();
  };

  // --- EXPORT ---
  const handleExport = () => {
    const data = filteredClients.length > 0 ? filteredClients : clients;
    if (data.length === 0) { toast.error('Nenhum dado para exportar.'); return; }

    if (exportFormat === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${contactType}_export.json`);
    } else {
      const sep = exportFormat === 'csv' ? ';' : '\t';
      const headers = ['Nome', 'Email', 'Telefone', 'WhatsApp', 'Empresa', 'CPF/CNPJ', 'Profissão', 'Cidade', 'Estado', 'Status', 'Tags', 'Criado em'];
      const rows = data.map(c => [
        c.name, c.email || '', c.phone || '', c.whatsapp || '', c.company_name || '',
        c.cnpj_cpf || '', c.profession || '', c.address_city || '', c.address_state || '',
        c.status, (c.tags || []).join(','), new Date(c.created_at).toLocaleDateString('pt-BR'),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep));

      const csvContent = [headers.join(sep), ...rows].join('\n');
      const bom = '\uFEFF';
      const ext = exportFormat === 'csv' ? 'csv' : 'xls';
      const mime = exportFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/vnd.ms-excel;charset=utf-8;';
      const blob = new Blob([bom + csvContent], { type: mime });
      downloadBlob(blob, `${contactType}_export.${ext}`);
    }

    setShowExportDialog(false);
    toast.success('Exportação concluída!');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Config baseado no tipo de contato
  const typeConfig = {
    cliente: {
      title: 'Clientes',
      subtitle: 'Gerencie seus clientes e relacionamentos',
      icon: Users,
      iconColor: 'text-[#2F428D]',
      bgColor: 'bg-[#F0F2FE]',
      newButtonText: 'Novo Cliente',
      emptyTitle: 'Nenhum cliente encontrado',
      emptyText: 'Comece adicionando seu primeiro cliente'
    },
    fornecedor: {
      title: 'Fornecedores',
      subtitle: 'Gerencie seus fornecedores e parceiros',
      icon: Package,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      newButtonText: 'Novo Fornecedor',
      emptyTitle: 'Nenhum fornecedor encontrado',
      emptyText: 'Comece adicionando seu primeiro fornecedor'
    },
    prospecto: {
      title: 'Prospectos',
      subtitle: 'Gerencie seus leads e oportunidades',
      icon: Target,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      newButtonText: 'Novo Prospecto',
      emptyTitle: 'Nenhum prospecto encontrado',
      emptyText: 'Comece adicionando seu primeiro prospecto'
    },
    all: {
      title: 'Contatos',
      subtitle: 'Gerencie todos os seus contatos',
      icon: Building2,
      iconColor: 'text-gray-600',
      bgColor: 'bg-gray-50',
      newButtonText: 'Novo Contato',
      emptyTitle: 'Nenhum contato encontrado',
      emptyText: 'Comece adicionando seu primeiro contato'
    }
  };

  const config = typeConfig[contactType];
  const IconComponent = config.icon;

  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientForm(true);
  };

  const handleEditClient = (client: any) => {
    setEditingClient(client);
    setShowClientForm(true);
  };

  const handleSaveClient = async (clientData: any) => {
    // Se for um tipo específico, incluir o client_type
    const dataToSave = {
      ...clientData,
      client_type: contactType !== 'all' ? contactType : clientData.client_type || 'cliente'
    };

    if (editingClient) {
      await updateClient(editingClient.id, dataToSave);
    } else {
      await createClient(dataToSave);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm(`Tem certeza que deseja excluir este ${contactType === 'all' ? 'contato' : contactType}?`)) {
      await deleteClient(id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'prospect':
        return 'bg-[#DFE4FB] text-[#0F1631]';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'prospect':
        return 'Prospecto';
      default:
        return 'Desconhecido';
    }
  };

  const filteredClients = clients.filter(client => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch =
      client.name.toLowerCase().includes(searchTermLower) ||
      (client.company_name || '').toLowerCase().includes(searchTermLower) ||
      (client.email || '').toLowerCase().includes(searchTermLower);

    const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeClients = clients.filter(c => c.status === 'active').length;
  const prospectClients = clients.filter(c => c.status === 'prospect').length;
  const newThisMonth = clients.filter(c => {
    const createdDate = new Date(c.created_at);
    const now = new Date();
    return createdDate.getMonth() === now.getMonth() && createdDate.getFullYear() === now.getFullYear();
  }).length;

  if (loading) {
    return (
      <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${config.bgColor}`}>
            <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{config.title}</h1>
            <p className="text-base text-gray-600 mt-1">{config.subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder={`Buscar ${config.title.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 rounded-xl"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
              <SelectItem value="prospect">Prospecto</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="rounded-xl">
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button variant="outline" onClick={() => setShowExportDialog(true)} className="rounded-xl">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleAddClient} className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            {config.newButtonText}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total</p>
                <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
              </div>
              <div className={`p-4 rounded-full ${config.bgColor}`}>
                <IconComponent className={`h-6 w-6 ${config.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ativos</p>
                <p className="text-3xl font-bold text-gray-900">{activeClients}</p>
              </div>
              <div className="p-4 rounded-full bg-green-50">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Prospectos</p>
                <p className="text-3xl font-bold text-gray-900">{prospectClients}</p>
              </div>
              <div className="p-4 rounded-full bg-[#F0F2FE]">
                <Target className="h-6 w-6 text-[#253573]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Novos este Mês</p>
                <p className="text-3xl font-bold text-gray-900">{newThisMonth}</p>
              </div>
              <div className="p-4 rounded-full bg-purple-50">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="border-none shadow-lg rounded-2xl bg-white">
        <CardHeader className="p-6 pb-4">
          <CardTitle className="text-lg font-semibold">Lista de {config.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12">
              <div className={`h-16 w-16 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <IconComponent className={`h-8 w-8 ${config.iconColor}`} />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {config.emptyTitle}
              </h3>
              <p className="text-gray-500 mb-4">
                {config.emptyText}
              </p>
              <Button onClick={handleAddClient}>
                <Plus className="h-4 w-4 mr-2" />
                {config.newButtonText}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="text-sm text-gray-600 font-medium p-6">NOME</TableHead>
                  <TableHead className="text-sm text-gray-600 font-medium p-6">CONTATO</TableHead>
                  <TableHead className="text-sm text-gray-600 font-medium p-6">STATUS</TableHead>
                  <TableHead className="text-sm text-gray-600 font-medium p-6">CRIADO EM</TableHead>
                  <TableHead className="text-sm text-gray-600 font-medium p-6">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id} className="hover:bg-gray-50">
                    <TableCell className="p-6">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={client.avatar_url} />
                          <AvatarFallback className={`${config.bgColor} ${config.iconColor}`}>
                            {client.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-semibold text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-600">{client.company_name}</p>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="p-6">
                      <div className="space-y-1">
                        {client.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span>{client.email}</span>
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{client.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell className="p-6">
                      <Badge 
                        className={`rounded-full ${getStatusColor(client.status)}`}
                      >
                        {getStatusLabel(client.status)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="p-6">
                      <span className="text-base text-gray-600">
                        {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </TableCell>
                    
                    <TableCell className="p-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem onClick={() => handleEditClient(client)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClient(client)}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClient(client.id)} 
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Client Form Modal */}
      <ClientForm
        client={editingClient}
        open={showClientForm}
        onOpenChange={setShowClientForm}
        onSave={handleSaveClient}
      />

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); if (!open) setImportResult(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar {config.title}
            </DialogTitle>
            <DialogDescription>
              Importe contatos a partir de um arquivo CSV. Baixe o template para ver o formato correto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="rounded-xl border p-4 space-y-2 bg-muted/50">
              <h4 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Instruções</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                <li>O arquivo deve ser <strong>.csv</strong> separado por <strong>;</strong> (ponto e vírgula) ou <strong>,</strong> (vírgula)</li>
                <li>A primeira linha deve conter os cabeçalhos</li>
                <li>O campo <strong>nome</strong> é obrigatório</li>
                <li>Campos aceitos: nome, email, telefone, whatsapp, empresa, cpf_cnpj, profissao, rua, numero, cidade, estado, cep, status, tags</li>
                <li>Tags devem ser separadas por vírgula dentro do campo</li>
              </ul>
            </div>

            {/* Template button */}
            <Button variant="outline" onClick={generateTemplate} className="w-full rounded-xl">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Baixar Template CSV
            </Button>

            {/* File input */}
            <div>
              <Label className="text-sm font-medium">Selecionar arquivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileImport}
                className="mt-2 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>

            {/* Results */}
            {importResult && (
              <div className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {importResult.success} registro(s) importado(s) com sucesso
                </div>
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      {importResult.errors.length} erro(s):
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto pl-6 list-disc">
                      {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exportar {config.title}
            </DialogTitle>
            <DialogDescription>
              {filteredClients.length !== clients.length
                ? `Exportando ${filteredClients.length} registro(s) filtrado(s) de ${clients.length} total.`
                : `Exportando todos os ${clients.length} registro(s).`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Label className="text-sm font-medium">Formato do arquivo</Label>
            <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as any)} className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">CSV</p>
                    <p className="text-xs text-muted-foreground">Compatível com Excel, Google Sheets</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-4 w-4 text-[#2F428D]" />
                  <div>
                    <p className="font-medium text-sm">Excel (XLS)</p>
                    <p className="text-xs text-muted-foreground">Planilha compatível com Microsoft Excel</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-4 w-4 text-[#253573]" />
                  <div>
                    <p className="font-medium text-sm">JSON</p>
                    <p className="text-xs text-muted-foreground">Formato para integração com sistemas</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            <Button onClick={handleExport} className="w-full rounded-xl">
              <Download className="h-4 w-4 mr-2" />
              Exportar Agora
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsManager;
