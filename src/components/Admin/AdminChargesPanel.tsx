import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DollarSign, 
  Search, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';

// Data source
const INITIAL_CLIENTS: { id: string; name: string; email: string; status: string; amount: number; token: string; dueDate: string }[] = [];

const AdminChargesPanel = () => {
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [search, setSearch] = useState('');
  const [selectedGateway, setSelectedGateway] = useState('stripe');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCharge = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    setProcessingId(clientId);
    
    // Simulate API call failure for demo purposes
    setTimeout(() => {
      toast.error(`Falha ao processar cobrança: Erro 404 (Gateway ${selectedGateway.toUpperCase()} indisponível)`);
      setProcessingId(null);
    }, 1500);
  };

  const handleBatchCharge = () => {
    if (filteredClients.length === 0) return;
    
    toast.info(`Iniciando cobrança em lote de ${filteredClients.length} clientes via ${selectedGateway.toUpperCase()}...`);
    
    // Simulate batch processing failure
    setTimeout(() => {
      toast.error(`Erro crítico no processamento em lote: 404 Not Found.`);
    }, 3000);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reprocessamento de Cobranças</h1>
          <p className="text-sm text-muted-foreground">Gerencie assinaturas vencidas e tokens de cartão</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Gateway de Cobrança</span>
            <Select value={selectedGateway} onValueChange={setSelectedGateway}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Selecionar Gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="pagarme">Pagar.me</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                <SelectItem value="vindi">Vindi</SelectItem>
                <SelectItem value="uvvi">UVVI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="bg-[#374DA4] hover:bg-[#374DA4]/90 text-white mt-5"
            onClick={handleBatchCharge}
            disabled={filteredClients.length === 0}
          >
            Cobrar Todos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Vencido</p>
              <p className="text-xl font-bold text-foreground">
                R$ {clients.reduce((t, c) => t + c.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-[#DFE4FB] rounded-lg">
              <Building2 className="h-5 w-5 text-[#2F428D]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes Pendentes</p>
              <p className="text-xl font-bold text-foreground">{clients.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gateway Ativo</p>
              <p className="text-xl font-bold text-foreground capitalize">{selectedGateway}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente ou email..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-9 bg-muted/30 border-none"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Cliente</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Token Cartão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente com cobrança pendente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map(client => (
                  <TableRow key={client.id} className="hover:bg-muted/10 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(client.dueDate).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {client.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <code className="text-xs bg-muted p-1 rounded font-mono text-muted-foreground">
                          {client.token}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                        Vencido
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-[#374DA4] hover:bg-[#374DA4]/10"
                        onClick={() => handleCharge(client.id)}
                        disabled={processingId === client.id}
                      >
                        {processingId === client.id ? (
                          <span className="flex items-center gap-2 animate-pulse">
                            Processando...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            Cobrar <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminChargesPanel;
