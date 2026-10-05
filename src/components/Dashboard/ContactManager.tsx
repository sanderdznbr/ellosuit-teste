
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Upload, Download, Search, Filter } from 'lucide-react';

const ContactManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    tags: ''
  });

  // Mock data para demonstração
  const contacts = [
    { id: 1, name: 'João Silva', email: 'joao@email.com', status: 'ativo', tags: ['cliente', 'premium'] },
    { id: 2, name: 'Maria Santos', email: 'maria@email.com', status: 'ativo', tags: ['prospect'] },
    { id: 3, name: 'Pedro Costa', email: 'pedro@email.com', status: 'inativo', tags: ['cliente'] },
  ];

  const handleAddContact = () => {
    console.log('Adicionando contato:', newContact);
    setNewContact({ name: '', email: '', tags: '' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total de Contatos</p>
                <p className="text-2xl font-bold">1,234</p>
              </div>
              <Users className="h-8 w-8 text-[#2F428D]" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Contatos Ativos</p>
                <p className="text-2xl font-bold">1,180</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-green-600 rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Novos (30 dias)</p>
                <p className="text-2xl font-bold">85</p>
              </div>
              <UserPlus className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taxa de Engajamento</p>
                <p className="text-2xl font-bold">24.5%</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                <div className="h-4 w-4 bg-purple-600 rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">Lista de Contatos</TabsTrigger>
          <TabsTrigger value="add">Adicionar Contato</TabsTrigger>
          <TabsTrigger value="import">Importar/Exportar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {contacts.map((contact) => (
                  <div key={contact.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-[#DFE4FB] rounded-full flex items-center justify-center">
                        <span className="text-[#2F428D] font-medium">
                          {contact.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-sm text-gray-500">{contact.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex gap-2">
                        {contact.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Badge variant={contact.status === 'ativo' ? 'default' : 'secondary'}>
                        {contact.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Novo Contato</CardTitle>
              <CardDescription>
                Adicione um novo contato à sua lista de email marketing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contact-name">Nome Completo</Label>
                <Input
                  id="contact-name"
                  placeholder="Ex: João Silva"
                  value={newContact.name}
                  onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="Ex: joao@email.com"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="contact-tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="contact-tags"
                  placeholder="Ex: cliente, premium, vip"
                  value={newContact.tags}
                  onChange={(e) => setNewContact({...newContact, tags: e.target.value})}
                />
              </div>
              
              <Button onClick={handleAddContact} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importar Contatos
                </CardTitle>
                <CardDescription>
                  Faça upload de um arquivo CSV com seus contatos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-2">
                    Arraste e solte seu arquivo CSV aqui
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    ou clique para selecionar
                  </p>
                  <Button variant="outline">
                    Selecionar Arquivo
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Formato aceito: CSV com colunas "nome", "email", "tags"
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Exportar Contatos
                </CardTitle>
                <CardDescription>
                  Baixe sua lista de contatos em formato CSV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Todos os Contatos
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Apenas Ativos
                  </Button>
                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Por Tags
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Os arquivos serão baixados em formato CSV
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContactManager;
