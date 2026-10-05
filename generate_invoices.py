import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm

invoices = [
    {"date": "08/05/2026 18:43:46", "status": "paid", "value": "R$ 481,77", "customer": "Izabel Cristina Marques", "id": "DYZ3IV4HYK"},
    {"date": "08/05/2026 18:40:54", "status": "paid", "value": "R$ 1.851,08", "customer": "Julio Cesar Faustino de Araujo", "id": "WLZU3NHJP0"},
    {"date": "08/05/2026 18:28:09", "status": "paid", "value": "R$ 481,77", "customer": "Izabel Cristina Marques", "id": "KEY5TW5URD"},
    {"date": "08/05/2026 18:24:39", "status": "paid", "value": "R$ 481,77", "customer": "Izabel Cristina Marques", "id": "2Y9XSDS74N"},
    {"date": "08/05/2026 18:24:08", "status": "paid", "value": "R$ 481,77", "customer": "Izabel Cristina Marques", "id": "R9Q1IZ8C9Y"},
    {"date": "01/04/2026 15:55:53", "status": "paid", "value": "R$ 1.118,00", "customer": "Francisco Carvalho Seda", "id": "W858UYJI8L"},
    {"date": "31/03/2026 17:54:31", "status": "paid", "value": "R$ 2.700,00", "customer": "Isabela sequeira", "id": "46QYBK2TP6"},
    {"date": "30/03/2026 23:35:22", "status": "paid", "value": "R$ 1.308,67", "customer": "Mac Pessuto", "id": "483WUEYBVE"},
    {"date": "29/03/2026 19:21:23", "status": "paid", "value": "R$ 499,00", "customer": "Giovanna Cenciarelli", "id": "Q3NJUDRH8D"},
    {"date": "27/03/2026 23:44:41", "status": "paid", "value": "R$ 499,00", "customer": "Verena padre de Deus", "id": "Q1E2C3S1ZP"}
]

output_dir = "/mnt/documents/invoices"
os.makedirs(output_dir, exist_ok=True)
logo_path = "public/images/ellosuit-logo.png"

def generate_pdf(invoice):
    filename = f"{output_dir}/fatura_{invoice['id']}.pdf"
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    # Header
    if os.path.exists(logo_path):
        c.drawImage(logo_path, 2 * cm, height - 3.5 * cm, width=4*cm, preserveAspectRatio=True, mask='auto')
    else:
        c.setFont("Helvetica-Bold", 24)
        c.drawString(2 * cm, height - 3 * cm, "ELLOSUIT")
    
    c.setFont("Helvetica", 10)
    c.drawString(2 * cm, height - 4 * cm, "Sistema de Gestão e API WhatsApp")
    
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - 2 * cm, height - 3 * cm, f"FATURA: #{invoice['id']}")
    
    # Line
    c.setStrokeColor(colors.lightgrey)
    c.line(2 * cm, height - 4.8 * cm, width - 2 * cm, height - 4.8 * cm)
    
    # Info
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, height - 6 * cm, "CLIENTE:")
    c.setFont("Helvetica", 12)
    c.drawString(5 * cm, height - 6 * cm, invoice['customer'])
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, height - 6.7 * cm, "DATA:")
    c.setFont("Helvetica", 12)
    c.drawString(5 * cm, height - 6.7 * cm, invoice['date'])
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, height - 7.4 * cm, "STATUS:")
    c.setFont("Helvetica", 12)
    c.setFillColor(colors.green)
    c.drawString(5 * cm, height - 7.4 * cm, invoice['status'].upper())
    c.setFillColor(colors.black)

    # Table Header
    c.setFillColor(colors.lightgrey)
    c.rect(2 * cm, height - 9.5 * cm, width - 4 * cm, 0.8 * cm, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(2.5 * cm, height - 9 * cm, "DESCRIÇÃO")
    c.drawRightString(width - 2.5 * cm, height - 9 * cm, "VALOR")
    
    # Table Content
    description = "Plano Enterprise / Créditos API WhatsApp"
    if "481,77" in invoice['value']:
        description = "Plano Mensal - Gestão Ellosuit + API"
    elif "1.851,08" in invoice['value']:
        description = "Pacote Anual - Licença Enterprise"
    elif "1.118,00" in invoice['value'] or "1.308,67" in invoice['value']:
        description = "Compra de Créditos API WhatsApp (Bulk)"
    elif "2.700,00" in invoice['value']:
        description = "Consultoria + Implementação API"
    elif "499,00" in invoice['value']:
        description = "Plano Business - Automação IA"

    c.setFont("Helvetica", 11)
    c.drawString(2.5 * cm, height - 10.5 * cm, description)
    c.drawRightString(width - 2.5 * cm, height - 10.5 * cm, invoice['value'])
    
    # Total
    c.line(2 * cm, height - 11.5 * cm, width - 2 * cm, height - 11.5 * cm)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2 * cm, height - 12.5 * cm, "TOTAL")
    c.drawRightString(width - 2.5 * cm, height - 12.5 * cm, invoice['value'])
    
    # Footer
    c.setFont("Helvetica-Oblique", 9)
    c.drawCentredString(width / 2, 2 * cm, "Obrigado por utilizar a Ellosuit. Este documento é o comprovante de pagamento.")
    
    c.showPage()
    c.save()
    return filename

for inv in invoices:
    generate_pdf(inv)

print(f"Generated {len(invoices)} invoices in {output_dir}")
