import React from 'react';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Image, Undo2, Redo2,
} from 'lucide-react';

interface Props {
  execCmd: (cmd: string, value?: string) => void;
  onInsertImage?: () => void;
}

const ContractEditorToolbar: React.FC<Props> = ({ execCmd, onInsertImage }) => (
  <div className="h-10 bg-background border-b flex items-center gap-1 px-4 flex-shrink-0 overflow-x-auto">
    <button onClick={() => execCmd('undo')} className="p-1.5 rounded-lg hover:bg-muted" title="Desfazer"><Undo2 className="h-4 w-4" /></button>
    <button onClick={() => execCmd('redo')} className="p-1.5 rounded-lg hover:bg-muted" title="Refazer"><Redo2 className="h-4 w-4" /></button>
    <div className="w-px h-5 bg-border mx-1" />
    <button onClick={() => execCmd('bold')} className="p-1.5 rounded-lg hover:bg-muted" title="Negrito"><Bold className="h-4 w-4" /></button>
    <button onClick={() => execCmd('italic')} className="p-1.5 rounded-lg hover:bg-muted" title="Itálico"><Italic className="h-4 w-4" /></button>
    <button onClick={() => execCmd('underline')} className="p-1.5 rounded-lg hover:bg-muted" title="Sublinhado"><Underline className="h-4 w-4" /></button>
    <div className="w-px h-5 bg-border mx-1" />
    <button onClick={() => execCmd('justifyLeft')} className="p-1.5 rounded-lg hover:bg-muted" title="Esquerda"><AlignLeft className="h-4 w-4" /></button>
    <button onClick={() => execCmd('justifyCenter')} className="p-1.5 rounded-lg hover:bg-muted" title="Centro"><AlignCenter className="h-4 w-4" /></button>
    <button onClick={() => execCmd('justifyRight')} className="p-1.5 rounded-lg hover:bg-muted" title="Direita"><AlignRight className="h-4 w-4" /></button>
    <button onClick={() => execCmd('justifyFull')} className="p-1.5 rounded-lg hover:bg-muted" title="Justificado"><AlignJustify className="h-4 w-4" /></button>
    <div className="w-px h-5 bg-border mx-1" />
    <button onClick={() => execCmd('insertUnorderedList')} className="p-1.5 rounded-lg hover:bg-muted" title="Lista"><List className="h-4 w-4" /></button>
    <button onClick={() => execCmd('insertOrderedList')} className="p-1.5 rounded-lg hover:bg-muted" title="Lista Numerada"><ListOrdered className="h-4 w-4" /></button>
    <div className="w-px h-5 bg-border mx-1" />
    {onInsertImage && (
      <button onClick={onInsertImage} className="p-1.5 rounded-lg hover:bg-muted" title="Inserir Imagem"><Image className="h-4 w-4" /></button>
    )}
    <div className="w-px h-5 bg-border mx-1" />
    <select
      onChange={e => {
        const val = e.target.value;
        if (val === 'p') {
          execCmd('formatBlock', 'p');
        } else {
          execCmd('formatBlock', val);
        }
      }}
      className="text-xs border rounded-lg px-2 py-1 bg-background"
      defaultValue="p"
    >
      <option value="p">Normal</option>
      <option value="h1">Título 1</option>
      <option value="h2">Título 2</option>
      <option value="h3">Título 3</option>
    </select>
    <select onChange={e => execCmd('fontSize', e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-background" defaultValue="3">
      <option value="1">8pt</option>
      <option value="2">10pt</option>
      <option value="3">12pt</option>
      <option value="4">14pt</option>
      <option value="5">18pt</option>
      <option value="6">24pt</option>
      <option value="7">36pt</option>
    </select>
  </div>
);

export default ContractEditorToolbar;