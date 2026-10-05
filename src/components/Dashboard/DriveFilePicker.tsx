import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  Folder, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  Music, 
  HardDrive,
  ChevronRight,
  ArrowLeft,
  Loader2,
   ArrowUpDown,
   Files,
   XCircle,
   RotateCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface DriveFile {
  id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size?: number;
  created_at?: string;
  updated_at?: string;
}

interface DriveFolder {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelect: (files: { name: string; url: string; type: string; size?: number }[]) => void;
}

const DriveFilePicker: React.FC<Props> = ({ open, onOpenChange, onFilesSelect }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'pdf'>('all');
   const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');

   const clearFilters = () => {
     setTypeFilter('all');
     setSortBy('recent');
     setSearchTerm('');
   };

   const isFilterActive = typeFilter !== 'all' || sortBy !== 'recent' || searchTerm !== '';

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let folderQuery = (supabase as any)
        .from('drive_folders')
        .select('id, name')
        .eq('created_by', user.id);
      
      let fileQuery = (supabase as any)
        .from('drive_files')
        .select('id, name, file_type, file_url, file_size, created_at, updated_at')
        .eq('created_by', user.id);

      if (currentFolderId) {
        folderQuery = folderQuery.eq('parent_folder_id', currentFolderId);
        fileQuery = fileQuery.eq('folder_id', currentFolderId);
      } else {
        folderQuery = folderQuery.is('parent_folder_id', null);
        fileQuery = fileQuery.is('folder_id', null);
      }

      const [foldersRes, filesRes] = await Promise.all([folderQuery, fileQuery]);
      
      if (foldersRes.data) setFolders(foldersRes.data);
      if (filesRes.data) setFiles(filesRes.data as DriveFile[]);
    } catch (error) {
      console.error('Error fetching drive data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchData();
    else {
      setSelectedFileIds(new Set());
      setPreviewFile(null);
    }
  }, [open, currentFolderId]);

  const handleFolderClick = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, folder]);
  };

  const handleBack = () => {
    const newPath = [...folderPath];
    newPath.pop();
    setFolderPath(newPath);
    setCurrentFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon className="h-5 w-5 text-[#374DA4]" />;
    if (type.includes('video')) return <Film className="h-5 w-5 text-purple-500" />;
    if (type.includes('audio')) return <Music className="h-5 w-5 text-pink-500" />;
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const matchesType = (file: DriveFile) => {
    if (typeFilter === 'all') return true;
    return file.file_type?.toLowerCase().includes(typeFilter);
  };
  const filteredFiles = files
    .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()) && matchesType(f))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const aDate = new Date(a.updated_at || a.created_at || 0).getTime();
      const bDate = new Date(b.updated_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });

  const typeFilters: { key: typeof typeFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'Todos', icon: <Files className="h-3.5 w-3.5" /> },
    { key: 'image', label: 'Imagens', icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { key: 'video', label: 'Vídeos', icon: <Film className="h-3.5 w-3.5" /> },
    { key: 'audio', label: 'Áudios', icon: <Music className="h-3.5 w-3.5" /> },
    { key: 'pdf', label: 'PDFs', icon: <FileText className="h-3.5 w-3.5" /> },
  ];

  const toggleFileSelection = (file: DriveFile) => {
    const newSelection = new Set(selectedFileIds);
    if (newSelection.has(file.id)) {
      newSelection.delete(file.id);
    } else {
      newSelection.add(file.id);
    }
    setSelectedFileIds(newSelection);
  };

  const handleConfirmSelection = () => {
    const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
    onFilesSelect(selectedFiles.map(f => ({
      name: f.name,
      url: f.file_url,
      type: f.file_type,
      size: f.file_size
    })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-white/10 shadow-2xl"
      >
        <DialogHeader className="p-4 border-b border-white/5 bg-white/5 backdrop-blur-md">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <HardDrive className="h-5 w-5 text-primary" />
            Biblioteca do Drive
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4 flex flex-col flex-1 min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar arquivos ou pastas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 rounded-xl focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {typeFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  typeFilter === f.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                }`}
              >
                {f.icon}
                {f.label}
              </button>
            ))}
            <div className="w-px h-5 bg-white/10 shrink-0 mx-1" />
            <button
              onClick={() => setSortBy(sortBy === 'recent' ? 'name' : 'recent')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all shrink-0"
              title="Alternar ordenação"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === 'recent' ? 'Recentes' : 'A → Z'}
             </button>

             {isFilterActive && (
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={clearFilters}
                 className="h-7 px-2 text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/10 shrink-0 ml-auto"
               >
                 <RotateCcw className="h-3 w-3 mr-1" />
                 Limpar filtros
               </Button>
             )}
           </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 hover:bg-white/10"
              onClick={() => {
                setCurrentFolderId(null);
                setFolderPath([]);
              }}
            >
              Drive
            </Button>
            {folderPath.map((folder, i) => (
              <React.Fragment key={folder.id}>
                <ChevronRight className="h-3 w-3" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 hover:bg-white/10"
                  onClick={() => {
                    const newPath = folderPath.slice(0, i + 1);
                    setFolderPath(newPath);
                    setCurrentFolderId(folder.id);
                  }}
                >
                  {folder.name}
                </Button>
              </React.Fragment>
            ))}
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                <p className="text-sm text-muted-foreground">Carregando seus arquivos...</p>
              </div>
             ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-300">
                 <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 relative">
                   <Search className="h-10 w-10 text-muted-foreground/20" />
                   <XCircle className="h-5 w-5 text-primary absolute -bottom-1 -right-1" />
                 </div>
                 <p className="text-base font-bold text-foreground">Nenhum arquivo encontrado</p>
                 <p className="text-sm text-muted-foreground mt-2 max-w-[250px] mx-auto">
                   Não encontramos nada com os filtros aplicados ou nesta pasta.
                 </p>
                 {isFilterActive && (
                   <Button 
                     variant="outline" 
                     onClick={clearFilters}
                     className="mt-6 rounded-xl border-white/10 hover:bg-white/5 transition-all font-bold"
                   >
                     <RotateCcw className="h-4 w-4 mr-2" />
                     Limpar todos os filtros
                   </Button>
                 )}
               </div>
             ) : (
              <div className="grid grid-cols-1 gap-1 pb-4">
                {currentFolderId && folderPath.length > 0 && !searchTerm && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <ArrowLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-sm font-medium">Voltar</span>
                  </button>
                )}

                {filteredFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder)}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all group text-left border border-transparent hover:border-white/5"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Folder className="h-5 w-5 text-primary fill-primary/20" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{folder.name}</p>
                      <p className="text-[11px] text-muted-foreground">Pasta</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}

                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all border ${
                      selectedFileIds.has(file.id) 
                        ? 'bg-primary/10 border-primary/30' 
                        : 'hover:bg-white/5 border-transparent'
                    }`}
                  >
                    <div 
                      className="flex-1 flex items-center gap-3 cursor-pointer py-1"
                      onClick={() => toggleFileSelection(file)}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                        selectedFileIds.has(file.id) ? 'bg-primary/20' : 'bg-white/5'
                      }`}>
                        {getFileIcon(file.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${selectedFileIds.has(file.id) ? 'text-primary' : ''}`}>
                          {file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate uppercase">
                          {file.file_type.split('/')[1] || 'arquivo'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-white/10"
                        onClick={() => setPreviewFile(file)}
                        title="Pré-visualizar"
                      >
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {selectedFileIds.size > 0 && (
            <div className="pt-4 border-t border-white/5 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
              <p className="text-sm font-medium text-muted-foreground">
                <span className="text-primary font-bold">{selectedFileIds.size}</span> {selectedFileIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedFileIds(new Set())}>
                  Limpar
                </Button>
                <Button size="sm" onClick={handleConfirmSelection} className="rounded-xl font-bold">
                  Anexar à conversa
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* File Preview Modal */}
        <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] p-0 overflow-hidden border-white/10 shadow-2xl bg-black/95 backdrop-blur-xl">
            <DialogHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
              <DialogTitle className="text-sm font-medium truncate pr-8">
                {previewFile?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-transparent min-h-[300px]">
              {previewFile?.file_url && (
                <>
                  {previewFile.file_type.includes('image') && (
                    <img src={previewFile.file_url} alt={previewFile.name} className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                  )}
                  {previewFile.file_type.includes('pdf') && (
                    <iframe src={previewFile.file_url} title={previewFile.name} className="w-full h-[60vh] rounded-lg border-none" />
                  )}
                  {previewFile.file_type.includes('audio') && (
                    <div className="w-full max-w-md p-8 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-4">
                      <Music className="h-16 w-16 text-primary animate-pulse" />
                      <audio src={previewFile.file_url} controls className="w-full" />
                    </div>
                  )}
                  {!previewFile.file_type.includes('image') && !previewFile.file_type.includes('pdf') && !previewFile.file_type.includes('audio') && (
                    <div className="text-center p-12">
                      {getFileIcon(previewFile.file_type)}
                      <p className="mt-4 text-muted-foreground">Pré-visualização não disponível para este tipo de arquivo.</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-white/5">
              <Button variant="outline" onClick={() => setPreviewFile(null)} className="rounded-xl">
                Fechar
              </Button>
              <Button 
                onClick={() => {
                  if (previewFile) toggleFileSelection(previewFile);
                  setPreviewFile(null);
                }}
                className="rounded-xl font-bold"
              >
                {previewFile && selectedFileIds.has(previewFile.id) ? 'Desmarcar' : 'Selecionar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default DriveFilePicker;