"""Convert BUKU_PANDUAN.md → PDF with embedded screenshots."""
import re
from pathlib import Path

import markdown
from weasyprint import CSS, HTML

MD_PATH = Path("/app/BUKU_PANDUAN.md")
IMG_DIR = Path("/app/frontend/public/panduan-img")
OUT_PDF = Path("/app/BUKU_PANDUAN.pdf")

md_text = MD_PATH.read_text(encoding="utf-8")

# Rewrite image URLs from /panduan-img/... to absolute file:// paths so PDF renderer can find them
def _rewrite(m):
    fn = m.group(1)
    return f"file://{IMG_DIR / fn}"

md_text = re.sub(r"/panduan-img/([\w\-\.]+)", _rewrite, md_text)

html_body = markdown.markdown(
    md_text,
    extensions=["extra", "tables", "toc", "sane_lists"],
)

css = """
@page {
  size: A4;
  margin: 2cm 1.8cm;
  @bottom-right { content: counter(page) " / " counter(pages); font-size: 9pt; color: #666; }
  @bottom-left  { content: "Air OXLY — Buku Panduan"; font-size: 9pt; color: #666; }
}
* { box-sizing: border-box; }
body {
  font-family: 'DejaVu Sans', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.55;
  font-size: 11pt;
  color: #1f2937;
}
h1 { color: #059669; font-size: 26pt; border-bottom: 3px solid #059669; padding-bottom: 6pt; margin-top: 18pt; page-break-before: auto; }
h1:first-of-type { page-break-before: avoid; }
h2 { color: #0369a1; font-size: 17pt; margin-top: 22pt; border-left: 4pt solid #0EA5E9; padding-left: 8pt; page-break-after: avoid; }
h3 { color: #7c3aed; font-size: 13pt; margin-top: 14pt; page-break-after: avoid; }
p, ul, ol { margin: 6pt 0; }
strong { color: #111827; }
code { background: #f1f5f9; padding: 1px 5px; border-radius: 3px; font-size: 10pt; color: #db2777; }
img {
  max-width: 55%;
  display: block;
  margin: 10pt auto;
  border: 1pt solid #cbd5e1;
  border-radius: 6pt;
  page-break-inside: avoid;
}
hr { border: 0; border-top: 1pt dashed #cbd5e1; margin: 18pt 0; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
th { background: #ecfdf5; color: #065f46; text-align: left; padding: 6pt; font-size: 10pt; border: 1pt solid #a7f3d0; }
td { padding: 6pt; border: 1pt solid #e5e7eb; font-size: 10pt; vertical-align: top; }
blockquote { border-left: 3pt solid #f59e0b; background: #fef3c7; padding: 6pt 12pt; margin: 8pt 0; font-style: italic; }
"""

html_full = f"""<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><title>Buku Panduan Air OXLY</title></head>
<body>{html_body}</body></html>"""

HTML(string=html_full, base_url=str(IMG_DIR.parent)).write_pdf(
    OUT_PDF, stylesheets=[CSS(string=css)]
)

size_kb = OUT_PDF.stat().st_size // 1024
print(f"✅ PDF created: {OUT_PDF} ({size_kb} KB)")
