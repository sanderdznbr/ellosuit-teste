import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FolderPlus, 
  Upload, 
  Search, 
  Folder,
  File,
  Download,
  Play,
  Trash2,
  Grid3X3,
  List,
  Star,
  Clock,
  Eye,
  Home,
  Link,
  HardDrive,
  Image,
  FileText,
  Film,
  Music,
  Archive,
  MoreVertical,
  ChevronRight,
  Move,
  Check,
  X
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDropzone } from 'react-dropzone';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

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

// Draggable File Component
const DraggableFile = ({ file, isSelected, onSelect, viewMode, getFileIcon, formatFileSize, onShare, onDelete, onPreview, isDragging }: {
  file: DriveFile;
  isSelected: boolean;
  onSelect: (id: string, ctrlKey: boolean) => void;
  viewMode: 'grid' | 'list';
  getFileIcon: (type: string) => React.ReactNode;
  formatFileSize: (bytes?: number) => string;
  onShare: () => void;
  onDelete: () => void;
  onPreview: () => void;
  isDragging?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `file-${file.id}`,
    data: { type: 'file', file }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  if (viewMode === 'grid') {
    const isImage = file.file_type.includes('image');
    const isVideo = file.file_type.includes('video');
    const isPdf = file.file_type.includes('pdf');
    const hasPreviewable = (isImage || isVideo || isPdf) && file.file_url;

    return (
      <Card 
        ref={setNodeRef}
        style={style}
        className={cn(
          "group hover:shadow-md transition-all cursor-grab active:cursor-grabbing overflow-hidden",
          isSelected && "ring-2 ring-primary border-primary",
          isDragging && "opacity-50"
        )}
        onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
        onDoubleClick={(e) => { e.stopPropagation(); if (file.file_url) onPreview(); }}
        {...attributes}
        {...listeners}
      >
        {/* Thumbnail area */}
        {hasPreviewable ? (
          <div 
            className="relative w-full h-32 bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onPreview(); }}
          >
            {isImage && (
              <img src={file.file_url!} alt={file.name} className="w-full h-full object-cover" />
            )}
            {isVideo && (
              <>
                <video src={file.file_url!} className="w-full h-full object-cover" muted preload="metadata" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-6 w-6 text-foreground ml-0.5" />
                  </div>
                </div>
              </>
            )}
            {isPdf && (
              <div className="flex flex-col items-center gap-1">
                <FileText className="h-10 w-10 text-red-500" />
                <span className="text-xs text-muted-foreground">Clique para ver</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-24 bg-muted flex items-center justify-center">
            {getFileIcon(file.file_type)}
          </div>
        )}

        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Checkbox 
                checked={isSelected} 
                onClick={(e) => e.stopPropagation()}
                onCheckedChange={() => onSelect(file.id, true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {file.file_url && (
                  <>
                    <DropdownMenuItem onClick={onPreview}>
                      <Eye className="h-4 w-4 mr-2" /> Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const link = document.createElement('a');
                      link.href = file.file_url!;
                      link.download = file.name;
                      link.click();
                    }}>
                      <Download className="h-4 w-4 mr-2" /> Download
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem onClick={onShare}>
                  <Link className="h-4 w-4 mr-2" /> Compartilhar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        "group hover:shadow-sm transition-all cursor-grab active:cursor-grabbing",
        isSelected && "ring-2 ring-primary border-primary",
        isDragging && "opacity-50"
      )}
      onClick={(e) => onSelect(file.id, e.ctrlKey || e.metaKey)}
      {...attributes}
      {...listeners}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Checkbox 
          checked={isSelected} 
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={() => onSelect(file.id, true)}
        />
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
          {getFileIcon(file.file_type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{file.name}</p>
          <p className="text-sm text-muted-foreground">{formatFileSize(file.file_size)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {file.file_url && (
              <>
                <DropdownMenuItem onClick={onPreview}>
                  <Eye className="h-4 w-4 mr-2" /> Visualizar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const link = document.createElement('a');
                  link.href = file.file_url!;
                  link.download = file.name;
                  link.click();
                }}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={onShare}>
              <Link className="h-4 w-4 mr-2" /> Compartilhar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
};

// Droppable Folder Component
const DroppableFolder = ({ folder, viewMode, onClick, onShare, onDelete, isOver }: {
  folder: DriveFolder;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onShare: () => void;
  onDelete: () => void;
  isOver: boolean;
}) => {
  const { setNodeRef, isOver: droppableIsOver } = useDroppable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder }
  });

  const highlighted = isOver || droppableIsOver;

  if (viewMode === 'grid') {
    return (
      <Card 
        ref={setNodeRef}
        className={cn(
          "group cursor-pointer hover:shadow-md transition-all",
          highlighted && "ring-2 ring-primary border-primary bg-primary/5 scale-105"
        )} 
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 border"
            >
              <Folder className="h-6 w-6" style={{ color: folder.color }} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
                  <Link className="h-4 w-4 mr-2" /> Compartilhar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="font-medium text-sm truncate">{folder.name}</p>
          {folder.description && (
            <p className="text-xs text-muted-foreground truncate mt-1">{folder.description}</p>
          )}
          {highlighted && (
            <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1">
              <Move className="h-3 w-3" /> Solte aqui
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      ref={setNodeRef}
      className={cn(
        "group cursor-pointer hover:shadow-sm transition-all",
        highlighted && "ring-2 ring-primary border-primary bg-primary/5"
      )} 
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: folder.color + '20' }}
        >
          <Folder className="h-5 w-5" style={{ color: folder.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{folder.name}</p>
          {folder.description && (
            <p className="text-sm text-muted-foreground truncate">{folder.description}</p>
          )}
        </div>
        {highlighted && (
          <div className="text-xs text-primary font-medium flex items-center gap-1">
            <Move className="h-3 w-3" /> Solte aqui
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }}>
              <Link className="h-4 w-4 mr-2" /> Compartilhar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
};

const DriveManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [allFiles, setAllFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{id: string, name: string}>>([]);
  const [sidebarView, setSidebarView] = useState<'drive' | 'recent' | 'starred'>('drive');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  
  const [folderForm, setFolderForm] = useState({
    name: '',
    description: '',
    color: '#374DA4'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  useEffect(() => {
    if (companyId) {
      loadFolders();
      loadFiles();
      loadAllFiles();
    }
  }, [companyId, currentFolder]);

  const loadAllFiles = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId);
    setAllFiles(data || []);
  };

  const loadFolders = async () => {
    if (!companyId) return;

    let query = supabase
      .from('document_folders')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (currentFolder === null) {
      query = query.is('parent_folder_id', null);
    } else {
      query = query.eq('parent_folder_id', currentFolder);
    }

    const { data, error } = await query;
    
    if (!error) setFolders(data || []);
    setLoading(false);
  };

  const loadFiles = async () => {
    if (!companyId) return;

    let query = supabase
      .from('documents')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (currentFolder === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', currentFolder);
    }

    const { data, error } = await query;
    
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
      description: 'Pasta criada com sucesso!'
    });

    setFolderForm({ name: '', description: '', color: '#374DA4' });
    setShowCreateFolder(false);
    loadFolders();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        await uploadFile(file);
      }
    },
    noClick: false,
    noKeyboard: true
  });

  const uploadFile = async (file: File) => {
    if (!user?.id || !companyId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${companyId}/${fileName}`;

    // Para arquivos grandes, usar upload com upsert e sem limite
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        duplex: 'half',
      });

    if (uploadError) {
      toast({
        title: 'Erro no upload',
        description: uploadError.message === 'Payload too large'
          ? 'Arquivo muito grande. Acesse as configurações do Supabase Storage para aumentar o limite de upload.'
          : uploadError.message,
        variant: 'destructive'
      });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('documents')
      .insert({
        name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: publicUrl,
        folder_id: currentFolder,
        company_id: companyId,
        created_by: user.id
      });

    if (dbError) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar arquivo no banco de dados',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Sucesso',
      description: `${file.name} foi enviado com sucesso!`
    });

    loadFiles();
    loadAllFiles();
  };

  const moveFilesToFolder = async (fileIds: string[], targetFolderId: string) => {
    const { error } = await supabase
      .from('documents')
      .update({ folder_id: targetFolderId })
      .in('id', fileIds);

    if (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao mover arquivos',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Sucesso',
      description: `${fileIds.length} arquivo(s) movido(s) com sucesso!`
    });

    setSelectedFiles(new Set());
    loadFiles();
    loadAllFiles();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    setOverId(over?.id || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId.startsWith('file-') && overId.startsWith('folder-')) {
      const fileId = activeId.replace('file-', '');
      const folderId = overId.replace('folder-', '');

      // If multiple files selected, move all of them
      if (selectedFiles.has(fileId) && selectedFiles.size > 1) {
        await moveFilesToFolder(Array.from(selectedFiles), folderId);
      } else {
        await moveFilesToFolder([fileId], folderId);
      }
    }
  };

  const handleFileSelect = (fileId: string, ctrlKey: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (ctrlKey) {
        if (newSet.has(fileId)) {
          newSet.delete(fileId);
        } else {
          newSet.add(fileId);
        }
      } else {
        if (newSet.has(fileId) && newSet.size === 1) {
          newSet.clear();
        } else {
          newSet.clear();
          newSet.add(fileId);
        }
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  const generateShareableLink = async (item: DriveFile | DriveFolder, type: 'file' | 'folder') => {
    const baseUrl = window.location.origin;
    const shareId = `${type}-${item.id}`;
    const shareUrl = `${baseUrl}/shared/${shareId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copiado!',
        description: `Link compartilhável copiado para a área de transferência`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link',
        variant: 'destructive',
      });
    }
  };

  const deleteFile = async (fileId: string) => {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', fileId);

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir arquivo', variant: 'destructive' });
      return;
    }

    toast({ title: 'Sucesso', description: 'Arquivo excluído' });
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
    loadFiles();
    loadAllFiles();
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.size === 0) return;

    const { error } = await supabase
      .from('documents')
      .delete()
      .in('id', Array.from(selectedFiles));

    if (error) {
      toast({ title: 'Erro', description: 'Erro ao excluir arquivos', variant: 'destructive' });
      return;
    }

    toast({ title: 'Sucesso', description: `${selectedFiles.size} arquivo(s) excluído(s)` });
    setSelectedFiles(new Set());
    loadFiles();
    loadAllFiles();
  };

  const deleteFolder = async (folderId: string) => {
    // First, move any documents in this folder to parent (set null)
    await supabase
      .from('documents')
      .update({ folder_id: null })
      .eq('folder_id', folderId);

    const { error } = await supabase
      .from('document_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      console.error('Delete folder error:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir pasta: ' + error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Sucesso', description: 'Pasta excluída' });
    loadFolders();
    loadFiles();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <Image className="h-6 w-6 text-pink-500" />;
    if (fileType.includes('video')) return <Film className="h-6 w-6 text-purple-500" />;
    if (fileType.includes('audio')) return <Music className="h-6 w-6 text-green-500" />;
    if (fileType.includes('pdf')) return <FileText className="h-6 w-6 text-red-500" />;
    if (fileType.includes('zip') || fileType.includes('rar')) return <Archive className="h-6 w-6 text-amber-500" />;
    return <File className="h-6 w-6 text-[#374DA4]" />;
  };

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStorage = 10 * 1024 * 1024 * 1024;
  const usedStorage = allFiles.reduce((acc, file) => acc + (file.file_size || 0), 0);
  const storagePercentage = (usedStorage / totalStorage) * 100;

  const recentFiles = [...allFiles]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-full bg-[#faf9f7] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#374DA4]"></div>
      </div>
    );
  }

  const activeDragFile = activeId ? files.find(f => `file-${f.id}` === activeId) : null;

  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-full bg-[#faf9f7] flex w-full">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-100 bg-[#faf9f7] p-4 hidden lg:flex flex-col shrink-0">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#374DA4]">Meu Drive</h2>
          </div>

          <nav className="space-y-1">
            <Button
              variant={sidebarView === 'drive' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => {
                setSidebarView('drive');
                setCurrentFolder(null);
                setFolderPath([]);
                setSelectedFiles(new Set());
              }}
            >
              <Home className="h-4 w-4 mr-3" />
              Meu Drive
            </Button>
            <Button
              variant={sidebarView === 'recent' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => {
                setSidebarView('recent');
                setSelectedFiles(new Set());
              }}
            >
              <Clock className="h-4 w-4 mr-3" />
              Recentes
            </Button>
            <Button
              variant={sidebarView === 'starred' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => {
                setSidebarView('starred');
                setSelectedFiles(new Set());
              }}
            >
              <Star className="h-4 w-4 mr-3" />
              Favoritos
            </Button>
          </nav>

          <div className="mt-6 pt-4 border-t">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Armazenamento</span>
                <span className="font-medium">{formatFileSize(usedStorage)} / 10 GB</span>
              </div>
              <Progress value={storagePercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {storagePercentage.toFixed(1)}% utilizado
              </p>
            </div>
          </div>
        </aside>

        {/* Main Content with Context Menu */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <main className="flex-1 p-4 sm:p-6 overflow-auto bg-[#faf9f7]">
              {/* Hidden file input for context menu upload */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach(f => uploadFile(f));
                    e.target.value = '';
                  }
                }}
              />
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4]">
                {sidebarView === 'drive' ? 'Meu Drive' : sidebarView === 'recent' ? 'Recentes' : 'Favoritos'}
              </h1>
              
              {sidebarView === 'drive' && folderPath.length > 0 && (
                <nav className="flex items-center gap-1 mt-2 text-sm">
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCurrentFolder(null);
                      setFolderPath([]);
                    }}
                  >
                    Meu Drive
                  </Button>
                  {folderPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setCurrentFolder(folder.id);
                          setFolderPath(folderPath.slice(0, index + 1));
                        }}
                      >
                        {folder.name}
                      </Button>
                    </React.Fragment>
                  ))}
                </nav>
              )}
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Selection Actions */}
              {selectedFiles.size > 0 && (
                <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-medium text-primary">
                    {selectedFiles.size} selecionado(s)
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={deleteSelectedFiles}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 px-2"
                    onClick={() => setSelectedFiles(new Set())}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {sidebarView === 'drive' && (
                <>
                  {files.length > 0 && (
                    <Button variant="outline" size="sm" onClick={selectAllFiles}>
                      <Check className="h-4 w-4 mr-2" />
                      {selectedFiles.size === files.length ? 'Desmarcar' : 'Selecionar Todos'}
                    </Button>
                  )}

                  <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
                    <DialogTrigger asChild>
                      <Button variant="outline">
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Nova Pasta
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Criar Nova Pasta</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Nome da pasta</Label>
                          <Input
                            value={folderForm.name}
                            onChange={(e) => setFolderForm({...folderForm, name: e.target.value})}
                            placeholder="Digite o nome da pasta"
                          />
                        </div>
                        
                        <div>
                          <Label>Descrição (opcional)</Label>
                          <Input
                            value={folderForm.description}
                            onChange={(e) => setFolderForm({...folderForm, description: e.target.value})}
                            placeholder="Descreva o conteúdo desta pasta"
                          />
                        </div>
                        
                        <div>
                          <Label>Cor</Label>
                          <div className="flex gap-2 mt-2">
                            {['#374DA4', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map((color) => (
                              <button
                                key={color}
                                onClick={() => setFolderForm({...folderForm, color})}
                                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                                  folderForm.color === color ? 'border-foreground scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-4">
                          <Button variant="outline" onClick={() => setShowCreateFolder(false)} className="flex-1">
                            Cancelar
                          </Button>
                          <Button onClick={createFolder} disabled={!folderForm.name} className="flex-1">
                            Criar Pasta
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div {...getRootProps()} className={`transition-colors ${isDragActive ? 'opacity-50' : ''}`}>
                    <input {...getInputProps()} />
                    <Button className="bg-primary hover:bg-primary/90">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Drag and Drop Zone */}
          {sidebarView === 'drive' && (
            <div
              {...getRootProps()}
              className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/20 hover:border-muted-foreground/40'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-muted-foreground">
                {isDragActive 
                  ? 'Solte os arquivos aqui...' 
                  : 'Arraste arquivos para cá ou clique para fazer upload'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Dica: Arraste arquivos para dentro das pastas para organizá-los
              </p>
            </div>
          )}

          {/* Content based on view */}
          {sidebarView === 'recent' ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Arquivos Recentes</h3>
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
                : 'space-y-2'
              }>
                {recentFiles.map((file) => (
                  <DraggableFile 
                    key={file.id} 
                    file={file} 
                    viewMode={viewMode}
                    isSelected={selectedFiles.has(file.id)}
                    onSelect={handleFileSelect}
                    getFileIcon={getFileIcon}
                    formatFileSize={formatFileSize}
                    onShare={() => generateShareableLink(file, 'file')}
                    onDelete={() => deleteFile(file.id)}
                    onPreview={() => setPreviewFile(file)}
                  />
                ))}
              </div>
            </div>
          ) : sidebarView === 'starred' ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum arquivo favoritado ainda</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Folders */}
              {filteredFolders.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Pastas</h3>
                  <div className={viewMode === 'grid' 
                    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
                    : 'space-y-2'
                  }>
                    {filteredFolders.map((folder) => (
                      <DroppableFolder
                        key={folder.id}
                        folder={folder}
                        viewMode={viewMode}
                        isOver={overId === `folder-${folder.id}`}
                        onClick={() => {
                          setCurrentFolder(folder.id);
                          setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
                          setSelectedFiles(new Set());
                        }}
                        onShare={() => generateShareableLink(folder, 'folder')}
                        onDelete={() => deleteFolder(folder.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {filteredFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Arquivos</h3>
                  <div className={viewMode === 'grid' 
                    ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' 
                    : 'space-y-2'
                  }>
                    {filteredFiles.map((file) => (
                      <DraggableFile 
                        key={file.id} 
                        file={file} 
                        viewMode={viewMode}
                        isSelected={selectedFiles.has(file.id)}
                        onSelect={handleFileSelect}
                        getFileIcon={getFileIcon}
                        formatFileSize={formatFileSize}
                        onShare={() => generateShareableLink(file, 'file')}
                        onDelete={() => deleteFile(file.id)}
                        onPreview={() => setPreviewFile(file)}
                        isDragging={activeId === `file-${file.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredFiles.length === 0 && filteredFolders.length === 0 && !searchTerm && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-6 flex items-center justify-center">
                    <HardDrive className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Seu Drive está vazio</h3>
                  <p className="text-muted-foreground mb-6">
                    Comece criando uma pasta ou fazendo upload de arquivos
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Criar Pasta
                    </Button>
                    <div {...getRootProps()}>
                      <input {...getInputProps()} />
                      <Button>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
            </main>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-56">
            <ContextMenuItem onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="h-4 w-4 mr-2" /> Nova Pasta
            </ContextMenuItem>
            <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Upload de Arquivo
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}>
              {viewMode === 'grid' ? <List className="h-4 w-4 mr-2" /> : <Grid3X3 className="h-4 w-4 mr-2" />}
              {viewMode === 'grid' ? 'Visualização em Lista' : 'Visualização em Grade'}
            </ContextMenuItem>
            {selectedFiles.size > 0 && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={deleteSelectedFiles} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Selecionados ({selectedFiles.size})
                </ContextMenuItem>
              </>
            )}
            {currentFolder && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => {
                  setCurrentFolder(null);
                  setFolderPath([]);
                }}>
                  <Home className="h-4 w-4 mr-2" /> Voltar ao Drive
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragFile && (
          <Card className="shadow-xl border-2 border-primary bg-card w-48">
            <CardContent className="p-3 flex items-center gap-2">
              {getFileIcon(activeDragFile.file_type)}
              <span className="text-sm font-medium truncate">{activeDragFile.name}</span>
              {selectedFiles.size > 1 && selectedFiles.has(activeDragFile.id) && (
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  +{selectedFiles.size - 1}
                </span>
              )}
            </CardContent>
          </Card>
        )}
      </DragOverlay>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{previewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {previewFile?.file_url && (
              <>
                {previewFile.file_type.includes('image') && (
                  <img src={previewFile.file_url} alt={previewFile.name} className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain" />
                )}
                {previewFile.file_type.includes('video') && (
                  <video src={previewFile.file_url} controls className="max-w-full max-h-[70vh] mx-auto rounded-lg" />
                )}
                {previewFile.file_type.includes('audio') && (
                  <div className="flex items-center justify-center py-12">
                    <audio src={previewFile.file_url} controls className="w-full max-w-md" />
                  </div>
                )}
                {previewFile.file_type.includes('pdf') && (
                  <iframe src={previewFile.file_url} className="w-full h-[70vh] rounded-lg border" />
                )}
                {!previewFile.file_type.includes('image') && !previewFile.file_type.includes('video') && !previewFile.file_type.includes('audio') && !previewFile.file_type.includes('pdf') && (
                  <div className="text-center py-12">
                    <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Pré-visualização não disponível para este tipo de arquivo</p>
                    <Button onClick={() => window.open(previewFile.file_url, '_blank')}>
                      <Download className="h-4 w-4 mr-2" /> Baixar arquivo
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setPreviewFile(null)}>Fechar</Button>
            {previewFile?.file_url && (
              <Button onClick={() => {
                const link = document.createElement('a');
                link.href = previewFile.file_url!;
                link.download = previewFile.name;
                link.click();
              }}>
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
};

export default DriveManager;
