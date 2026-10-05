import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SUITE_COLOR = '#374DA4';

const ContractViewer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractId = searchParams.get('id');
  const [contract, setContract] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!contractId) { navigate('/dashboard/contratos'); return; }
      const { data } = await supabase
        .from('generated_contracts')
        .select('*, contract_templates(*)')
        .eq('id', contractId)
        .single();
      if (data) {
        setContract(data);
        setTemplate(data.contract_templates);
      } else {
        toast.error('Contrato não encontrado');
        navigate('/dashboard/contratos');
      }
      setLoading(false);
    };
    load();
  }, [contractId]);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>${contract?.title}</title>
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; font-family: 'Times New Roman', serif; }
        .page { width: 210mm; min-height: 297mm; padding: 40px 60px; box-sizing: border-box;
          ${template?.letterhead_url ? `background-image: url(${template.letterhead_url}); background-size: cover;` : ''} }
        .logo { text-align: center; margin-bottom: 16px; }
        .logo img { max-height: 80px; }
        .content { font-size: 12pt; line-height: 1.8; }
      </style></head><body>
      <div class="page">
        ${template?.logo_url ? `<div class="logo"><img src="${template.logo_url}" /></div>` : ''}
        <div class="content">${contract?.final_content || ''}</div>
      </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: SUITE_COLOR }} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-muted/30">
      <div className="h-14 bg-background border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/contratos')} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FileText className="h-5 w-5" style={{ color: SUITE_COLOR }} />
          <span className="font-semibold">{contract?.title}</span>
        </div>
        <Button onClick={handlePrint} variant="outline" className="rounded-xl gap-2">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </Button>
      </div>

      <div className="flex-1 overflow-auto flex justify-center py-8">
        <div
          ref={printRef}
          className="bg-white shadow-xl rounded-sm"
          style={{
            width: '210mm',
            minHeight: '297mm',
            backgroundImage: template?.letterhead_url ? `url(${template.letterhead_url})` : undefined,
            backgroundSize: 'cover',
          }}
        >
          {template?.logo_url && (
            <div className="flex justify-center pt-8 pb-2">
              <img src={template.logo_url} alt="Logo" className="max-h-20 object-contain" />
            </div>
          )}
          <div
            className="px-16 py-8"
            style={{ fontFamily: "'Times New Roman', serif", fontSize: '12pt', lineHeight: '1.8' }}
            dangerouslySetInnerHTML={{ __html: contract?.final_content || '' }}
          />
        </div>
      </div>
    </div>
  );
};

export default ContractViewer;
