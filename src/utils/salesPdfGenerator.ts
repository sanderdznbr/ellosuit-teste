import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubscriptionData {
  company_name: string;
  contracted_at: string;
  monthly_price: number;
  plan_type: string;
  status: string;
}

export const generateSalesDefensePDF = (data: SubscriptionData[]) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(255, 107, 0); // Omni Orange
  doc.text('Relatório de Defesa de Vendas - Ellosuit', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, pageWidth / 2, 28, { align: 'center' });

  // Introduction
  doc.setFontSize(12);
  doc.setTextColor(0);
  const intro = "Este documento serve como prova de prestação de serviços e contratação da plataforma Ellosuit. " +
    "Abaixo listamos as empresas que realizaram pagamentos legítimos via Pagar.me, confirmando a validade das transações.";
  const splitIntro = doc.splitTextToSize(intro, pageWidth - 40);
  doc.text(splitIntro, 20, 40);

  // Table
  const tableRows = data.map((item, index) => [
    index + 1,
    item.company_name || 'N/A',
    format(new Date(item.contracted_at), "dd/MM/yyyy", { locale: ptBR }),
    `R$ ${item.monthly_price.toFixed(2)}`,
    item.plan_type.toUpperCase(),
    item.status === 'active' ? 'PAGO/ATIVO' : 'CONTATADO'
  ]);

  (doc as any).autoTable({
    startY: 55,
    head: [['#', 'Empresa/Cliente', 'Data Contratação', 'Valor Plano', 'Tipo Plano', 'Status']],
    body: tableRows,
    headStyles: { fillColor: [255, 107, 0] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { top: 55 },
  });

  // Footer / Defense Statement
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(11);
  const defenseText = "Observação de Defesa: As transações citadas acima correspondem a empresas distintas que utilizam a infraestrutura da Ellosuit. " +
    "A repetição de valores é decorrente da padronização de nossos planos comerciais (Base, Growth, Business, Partner). " +
    "Cada cobrança está vinculada a um CNPJ/Cadastro único em nossa base de dados, comprovando que não se trata de duplicidade indevida, mas sim de assinaturas legítimas de diferentes clientes.";
  
  const splitDefense = doc.splitTextToSize(defenseText, pageWidth - 40);
  doc.text(splitDefense, 20, finalY);

  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Documento Interno Ellosuit - Válido para contestação junto ao gateway de pagamento.", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  // Save/Download
  doc.save('defesa-vendas-ellosuit.pdf');
};
