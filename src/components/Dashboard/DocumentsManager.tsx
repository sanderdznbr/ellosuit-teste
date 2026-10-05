import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Upload, 
  FileText, 
  Folder, 
  MoreHorizontal, 
  Search,
  Grid3X3,
  List,
  Plus,
  Download,
  Share,
  Trash2,
  Clock,
  Tag,
  FolderPlus,
  File,
  MousePointer
} from 'lucide-react';
import { useDocuments } from '@/hooks/useDocuments';

const DocumentsManager = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'document' | 'folder' | 'empty'; item?: any } | null>(null);
  const [newFolder, setNewFolder] = useState({ name: '', description: '', color: '#374DA4' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { documents, folders, loading, createDocument, createFolder, deleteDocument, deleteFolder } = useDocuments();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      createDocument({
        name: file.name,
        file_type: file.type,
        file_size: file.size,
        description: `Arquivo enviado via drag-and-drop`
      });
    });
  }, [createDocument]);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      createDocument({
        name: file.name,
        file_type: file.type,
        file_size: file.size,
        description: `Arquivo enviado via upload`
      });
    });
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'document' | 'folder' | 'empty', item?: any) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      item
    });
  };

  const handleCreateFolder = async () => {
    if (newFolder.name.trim()) {
      await createFolder(newFolder.name);
      setNewFolder({ name: '', description: '', color: '#374DA4' });
      setShowNewFolderDialog(false);
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (fileType?.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    if (fileType?.includes('image')) return <File className="h-8 w-8 text-green-500" />;
    if (fileType?.includes('presentation')) return <File className="h-8 w-8 text-[#2F428D]" />;
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close context menu when clicking elsewhere
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
    <div className="p-6 space-y-8 bg-gray-50 min-h-screen" onContextMenu={(e) => handleContextMenu(e, 'empty')}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🗂️ DRIVE</h1>
          <p className="text-base text-gray-600 mt-2">Seu armazenamento em nuvem - organize, compartilhe e colabore</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64 rounded-xl"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-xl"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-xl"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="rounded-xl">
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={handleFileUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload de Arquivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowNewFolderDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Nova Pasta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Drag and Drop Area */}
      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
          isDragOver ? 'border-[#374DA4] bg-[#F0F2FE]' : 'border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-semibold text-gray-900 mb-2">
          Arraste arquivos aqui ou clique para enviar
        </p>
        <p className="text-base text-gray-600 mb-4">
          Suporta PDFs, imagens, documentos e apresentações
        </p>
        <Button onClick={handleFileUpload} className="rounded-xl">
          Selecionar Arquivos
        </Button>
      </div>

      {/* Context Menu Instructions */}
      <Card className="border-none shadow-lg rounded-2xl bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MousePointer className="h-4 w-4" />
            <span>Clique com o botão direito em pastas e documentos para ver mais opções</span>
          </div>
        </CardContent>
      </Card>

      {/* Documents and Folders */}
      {(filteredDocuments.length === 0 && filteredFolders.length === 0) ? (
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Comece fazendo upload de seus primeiros arquivos
            </p>
            <Button onClick={handleFileUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Fazer Upload
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {/* Folders */}
          {filteredFolders.map((folder) => (
            <Card 
              key={folder.id} 
              className="border-none shadow-lg rounded-2xl bg-white hover:shadow-xl transition-all duration-300 group"
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <Folder className="h-8 w-8 text-[#374DA4]" style={{ color: folder.color }} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{folder.name}</h3>
                  {folder.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{folder.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-3 w-3" />
                    {new Date(folder.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Documents */}
          {filteredDocuments.map((doc) => (
            <Card 
              key={doc.id} 
              className="border-none shadow-lg rounded-2xl bg-white hover:shadow-xl transition-all duration-300 group"
              onContextMenu={(e) => handleContextMenu(e, 'document', doc)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  {getFileIcon(doc.file_type)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Share className="h-4 w-4 mr-2" />
                        Compartilhar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{doc.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-3 w-3" />
                    {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                  </div>
                  {doc.file_size && (
                    <p className="text-sm text-gray-500">{formatFileSize(doc.file_size)}</p>
                  )}
                  
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {doc.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700 rounded-full">
                          <Tag className="h-2 w-2 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-none shadow-lg rounded-2xl bg-white">
          <CardContent className="p-0">
            <div className="space-y-2">
              {filteredFolders.map((folder) => (
                <div key={folder.id} className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors" onContextMenu={(e) => handleContextMenu(e, 'folder', folder)}>
                  <div className="flex items-center gap-4">
                    <Folder className="h-8 w-8 text-[#374DA4]" style={{ color: folder.color }} />
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{folder.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{new Date(folder.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-xl">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {filteredDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors" onContextMenu={(e) => handleContextMenu(e, 'document', doc)}>
                  <div className="flex items-center gap-4">
                    {getFileIcon(doc.file_type)}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{doc.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{new Date(doc.created_at).toLocaleDateString('pt-BR')}</span>
                        {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="flex gap-1">
                        {doc.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs bg-gray-100 text-gray-700 rounded-full">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl">
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share className="h-4 w-4 mr-2" />
                          Compartilhar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'empty' && (
            <>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  setShowNewFolderDialog(true);
                  setContextMenu(null);
                }}
              >
                <FolderPlus className="h-4 w-4" />
                Nova Pasta
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  handleFileUpload();
                  setContextMenu(null);
                }}
              >
                <Upload className="h-4 w-4" />
                Upload Arquivo
              </button>
            </>
          )}
          
          {contextMenu.type === 'folder' && (
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
              onClick={() => {
                deleteFolder(contextMenu.item.id);
                setContextMenu(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Pasta
            </button>
          )}
          
          {contextMenu.type === 'document' && (
            <>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                <Share className="h-4 w-4" />
                Compartilhar
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600"
                onClick={() => {
                  deleteDocument(contextMenu.item.id);
                  setContextMenu(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            </>
          )}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Criar Nova Pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Nome da Pasta *</Label>
              <Input
                id="folder-name"
                value={newFolder.name}
                onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })}
                placeholder="Digite o nome da pasta..."
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="folder-description">Descrição</Label>
              <Textarea
                id="folder-description"
                value={newFolder.description}
                onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })}
                placeholder="Descrição da pasta (opcional)..."
                className="mt-2 rounded-xl"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewFolderDialog(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button onClick={handleCreateFolder} className="rounded-xl">
                Criar Pasta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

export default DocumentsManager;
