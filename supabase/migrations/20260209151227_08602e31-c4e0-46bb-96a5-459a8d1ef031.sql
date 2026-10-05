-- Fix FK constraints to allow folder deletion by cascading
ALTER TABLE public.documents DROP CONSTRAINT fk_documents_folder;
ALTER TABLE public.documents ADD CONSTRAINT fk_documents_folder 
  FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE SET NULL;

ALTER TABLE public.document_folders DROP CONSTRAINT fk_folders_parent;
ALTER TABLE public.document_folders ADD CONSTRAINT fk_folders_parent 
  FOREIGN KEY (parent_folder_id) REFERENCES document_folders(id) ON DELETE CASCADE;