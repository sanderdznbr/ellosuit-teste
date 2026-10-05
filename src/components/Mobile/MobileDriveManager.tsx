import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FolderPlus, 
  Upload, 
  Search, 
  MoreHorizontal,
  Folder,
  File,
  Download,
  Trash2,
  Edit3,
  Share2,
  Grid3X3,
  List,
  Star,
  ArrowLeft,
  Plus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface DriveFile {
  id: string;
  name: string;
  file_type: string;
  file_size?: number;
  file_url?: string;
  created_at: string;
  created_by: string;
  folder_id?: string;
  tags?: string[];
  description?: string;
}

interface DriveFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  created_by: string;
  parent_folder_id?: string;
}

const MobileDriveManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'main' | 'create-folder'>('main');
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#374DA4'
  });

  // Get company ID
  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!error && data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    
    fetchCompanyId();
  }, [user?.id]);

  // Load data
  useEffect(() => {
    if (companyId) {
      loadFolders();
      loadFiles();
    }
  }, [companyId, currentFolder]);

  const loadFolders = async () => {
    const { data, error } = await supabase
      .from('document_folders')
      .select('*')
      .eq('parent_folder_id', currentFolder)
      .order('name');
    
    if (!error) setFolders(data || []);
    setLoading(false);
  };

  const loadFiles = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('folder_id', currentFolder)
      .order('name');
    
    if (!error) setFiles(data || []);
  };

  const createFolder = async () => {
    if (!user?.id || !companyId) return;

    const { error } = await supabase
      .from('document_folders')
      .insert({
        ...folderForm,
        parent_folder_id: currentFolder,
        company_id: companyId,
        created_by: user.id
      });

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar pasta',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Sucesso',
      description: 'Pasta criada!'
    });

    setFolderForm({ name: '', description: '', color: '#374DA4' });
    setActiveView('main');
    loadFolders();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎥';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word')) return '📝';
    if (fileType.includes('excel')) return '📊';
    if (fileType.includes('powerpoint')) return '📈';
    return '📄';
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Create Folder View
  if (activeView === 'create-folder') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActiveView('main')}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Nova Pasta</h1>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label className="text-sm font-medium">Nome da pasta</Label>
              <Input
                value={folderForm.name}
                onChange={(e) => setFolderForm({...folderForm, name: e.target.value})}
                placeholder="Digite o nome da pasta"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Descrição (opcional)</Label>
              <Input
                value={folderForm.description}
                onChange={(e) => setFolderForm({...folderForm, description: e.target.value})}
                placeholder="Descreva o conteúdo"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Cor</Label>
              <div className="flex gap-2 mt-2">
                {['#374DA4', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setFolderForm({...folderForm, color})}
                    className={`w-8 h-8 rounded-full border-2 ${
                      folderForm.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setActiveView('main')} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={createFolder} disabled={!folderForm.name} className="flex-1">
                Criar Pasta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main View
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <File className="h-6 w-6" />
          Arquivos
        </h1>
        <p className="text-sm text-gray-600 text-center mt-1">
          Seus documentos organizados
        </p>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Pesquisar arquivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-3">
        <Button 
          onClick={() => setActiveView('create-folder')} 
          variant="outline" 
          className="flex-1"
        >
          <FolderPlus className="h-4 w-4 mr-2" />
          Nova Pasta
        </Button>
        
        <Button className="flex-1">
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
      </div>

      {/* Content */}
      <div className="px-4 space-y-4">
        {/* Folders */}
        {filteredFolders.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Pastas
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {filteredFolders.map((folder) => (
                <Card 
                  key={folder.id}
                  className="cursor-pointer active:scale-95 transition-transform"
                  onClick={() => setCurrentFolder(folder.id)}
                >
                  <CardContent className="p-4 text-center">
                    <div 
                      className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: folder.color + '20' }}
                    >
                      <Folder className="h-6 w-6" style={{ color: folder.color }} />
                    </div>
                    <p className="font-medium text-sm truncate">{folder.name}</p>
                    {folder.description && (
                      <p className="text-xs text-gray-500 truncate">{folder.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {filteredFiles.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <File className="h-5 w-5" />
              Arquivos
            </h3>
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">{getFileIcon(file.file_type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(file.file_size)}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredFiles.length === 0 && filteredFolders.length === 0 && !searchTerm && (
          <Card className="border-dashed border-2">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <File className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                Arquivos vazio
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Crie uma pasta ou faça upload de documentos
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => setActiveView('create-folder')} size="sm">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Criar Pasta
                </Button>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MobileDriveManager;