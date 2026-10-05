import os
import zipfile

invoice_dir = "/mnt/documents/invoices"
output_path = "/mnt/documents/faturas_ellosuit.zip"

if not os.path.exists(invoice_dir):
    print(f"Error: Directory {invoice_dir} not found.")
    exit(1)

with zipfile.ZipFile(output_path, 'w') as zipf:
    for root, dirs, files in os.walk(invoice_dir):
        for file in files:
            if file.endswith(".pdf"):
                zipf.write(os.path.join(root, file), arcname=file)

print(f"ZIP created at {output_path}")
