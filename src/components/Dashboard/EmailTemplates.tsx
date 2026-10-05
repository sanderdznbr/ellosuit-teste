
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Search, Eye, Edit, Copy, Trash2, Code, Mail } from 'lucide-react';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';

const EmailTemplates = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'general',
    html_content: '',
    preview_text: '',
    is_active: true
  });

  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useEmailTemplates();

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const templateCategories = [
    { id: 'all', name: 'Todos', count: templates.length },
    { id: 'general', name: 'Geral', count: templates.filter(t => t.category === 'general').length },
    { id: 'welcome', name: 'Boas-vindas', count: templates.filter(t => t.category === 'welcome').length },
    { id: 'promotion', name: 'Promocional', count: templates.filter(t => t.category === 'promotion').length },
    { id: 'newsletter', name: 'Newsletter', count: templates.filter(t => t.category === 'newsletter').length },
    { id: 'transactional', name: 'Transacional', count: templates.filter(t => t.category === 'transactional').length }
  ];

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.html_content) {
      return;
    }
    
    await createTemplate(newTemplate);
    setIsCreateModalOpen(false);
    setNewTemplate({
      name: '',
      description: '',
      category: 'general',
      html_content: '',
      preview_text: '',
      is_active: true
    });
  };

  const handleEditTemplate = async () => {
    if (!selectedTemplate || !selectedTemplate.name || !selectedTemplate.html_content) {
      return;
    }
    
    await updateTemplate(selectedTemplate.id, selectedTemplate);
    setIsEditModalOpen(false);
    setSelectedTemplate(null);
  };

  const handleDuplicateTemplate = async (template: any) => {
    await duplicateTemplate(template);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Tem certeza que deseja excluir este template?')) {
      await deleteTemplate(templateId);
    }
  };

  const openEditModal = (template: any) => {
    setSelectedTemplate({...template});
    setIsEditModalOpen(true);
  };

  const openPreviewModal = (template: any) => {
    setSelectedTemplate(template);
    setIsPreviewModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'welcome': return 'bg-green-100 text-green-800';
      case 'promotion': return 'bg-red-100 text-red-800';
      case 'newsletter': return 'bg-[#DFE4FB] text-[#1A2551]';
      case 'transactional': return 'bg-purple-100 text-purple-800';
      case 'general': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'welcome': return 'Boas-vindas';
      case 'promotion': return 'Promocional';
      case 'newsletter': return 'Newsletter';
      case 'transactional': return 'Transacional';
      default: return category;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates de Email</h2>
          <p className="text-gray-600">Gerencie seus templates de email marketing</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList>
            {templateCategories.map((category) => (
              <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                {category.name}
                <Badge variant="secondary" className="text-xs">
                  {category.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full sm:w-80"
            />
          </div>
        </div>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <Badge className={getCategoryColor(template.category)}>
                      {getCategoryName(template.category)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {template.preview_text || template.html_content.replace(/<[^>]*>/g, '').substring(0, 100) + '...'}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Criado em {new Date(template.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openPreviewModal(template)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Ver
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditModal(template)}>
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicateTemplate(template)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum template encontrado
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm ? 'Tente ajustar sua busca' : 'Crie seu primeiro template de email'}
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Create Template Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Template</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome do Template *</Label>
                  <Input
                    id="name"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                    placeholder="Ex: Welcome Email"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                    placeholder="Descreva o propósito deste template..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={newTemplate.category} onValueChange={(value) => setNewTemplate({...newTemplate, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral</SelectItem>
                      <SelectItem value="welcome">Boas-vindas</SelectItem>
                      <SelectItem value="promotion">Promocional</SelectItem>
                      <SelectItem value="newsletter">Newsletter</SelectItem>
                      <SelectItem value="transactional">Transacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="preview_text">Texto de Preview</Label>
                  <Textarea
                    id="preview_text"
                    value={newTemplate.preview_text}
                    onChange={(e) => setNewTemplate({...newTemplate, preview_text: e.target.value})}
                    placeholder="Texto que aparece no preview do email..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="html_content">Conteúdo HTML *</Label>
                  <Textarea
                    id="html_content"
                    value={newTemplate.html_content}
                    onChange={(e) => setNewTemplate({...newTemplate, html_content: e.target.value})}
                    placeholder="<html><body><h1>Seu HTML aqui...</h1></body></html>"
                    rows={15}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Template Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Template</DialogTitle>
            </DialogHeader>
            {selectedTemplate && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Nome do Template *</Label>
                    <Input
                      id="edit-name"
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, name: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="edit-description">Descrição</Label>
                    <Textarea
                      id="edit-description"
                      value={selectedTemplate.description || ''}
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, description: e.target.value})}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-category">Categoria</Label>
                    <Select value={selectedTemplate.category} onValueChange={(value) => setSelectedTemplate({...selectedTemplate, category: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">Geral</SelectItem>
                        <SelectItem value="welcome">Boas-vindas</SelectItem>
                        <SelectItem value="promotion">Promocional</SelectItem>
                        <SelectItem value="newsletter">Newsletter</SelectItem>
                        <SelectItem value="transactional">Transacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit-preview_text">Texto de Preview</Label>
                    <Textarea
                      id="edit-preview_text"
                      value={selectedTemplate.preview_text || ''}
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, preview_text: e.target.value})}
                      rows={2}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-html_content">Conteúdo HTML *</Label>
                    <Textarea
                      id="edit-html_content"
                      value={selectedTemplate.html_content}
                      onChange={(e) => setSelectedTemplate({...selectedTemplate, html_content: e.target.value})}
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditTemplate}>
                <Edit className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Template Modal */}
        <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Preview: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Informações do Template</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Categoria:</span> {getCategoryName(selectedTemplate.category)}
                    </div>
                    <div>
                      <span className="font-medium">Criado em:</span> {new Date(selectedTemplate.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  {selectedTemplate.preview_text && (
                    <div className="mt-2">
                      <span className="font-medium">Preview:</span> {selectedTemplate.preview_text}
                    </div>
                  )}
                </div>
                
                <div className="border rounded-lg p-4 bg-white" style={{ minHeight: '400px' }}>
                  <div dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }} />
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => openEditModal(selectedTemplate)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
};

export default EmailTemplates;
