import os
from datetime import datetime
from typing import List

def wrap_text(text: str, max_chars: int = 75) -> List[str]:
    lines = []
    for paragraph in text.splitlines():
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        current_line = []
        current_len = 0
        for word in words:
            if current_len + len(word) + 1 <= max_chars:
                current_line.append(word)
                current_len += len(word) + 1
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
                current_len = len(word)
        if current_line:
            lines.append(" ".join(current_line))
    return lines

def create_pdf_from_text(title: str, text_content: str, author: str = "Virtual AI Tutor") -> bytes:
    """
    Generates a valid, beautifully formatted PDF-1.4 binary from any plain text or markdown content.
    Guarantees opening in standard PDF readers (Adobe Acrobat, Chrome, Edge) rather than text editors.
    """
    wrapped_lines = wrap_text(text_content, max_chars=80)
    lines_per_page = 40
    
    # Chunk into pages
    page_chunks = []
    if not wrapped_lines:
        page_chunks.append(["(No content provided)"])
    else:
        for i in range(0, len(wrapped_lines), lines_per_page):
            page_chunks.append(wrapped_lines[i:i + lines_per_page])
            
    total_pages = len(page_chunks)
    
    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n")
    xref = []
    
    def add_obj(content: bytes) -> int:
        xref.append(len(pdf))
        obj_num = len(xref)
        pdf.extend(f"{obj_num} 0 obj\n".encode("latin1"))
        pdf.extend(content)
        pdf.extend(b"\nendobj\n")
        return obj_num

    # Catalog & font forward declarations
    # 1: Catalog
    # 2: Pages root
    # Fonts will be obj 3 (Helvetica-Bold) and obj 4 (Helvetica)
    catalog_obj = add_obj(b"<< /Type /Catalog /Pages 2 0 R >>")
    
    # Reserve obj 2 for Pages (will write later)
    pages_root_idx = len(xref)
    xref.append(len(pdf))
    pdf.extend(b"2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n")
    
    font_bold_obj = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    font_reg_obj = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    
    page_obj_ids = []
    
    for page_num, chunk in enumerate(page_chunks, start=1):
        stream = bytearray()
        
        # Header banner
        safe_title = "".join(c for c in title if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        safe_author = "".join(c for c in author if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        # Title bar
        stream.extend(b"BT\n")
        stream.extend(f"/F1 16 Tf 50 740 Td ({safe_title}) Tj\n".encode("latin1"))
        stream.extend(f"/F2 9 Tf 0 -18 Td (Author: {safe_author}  |  Generated: {now_str}  |  Page {page_num} of {total_pages}) Tj\n".encode("latin1"))
        stream.extend(b"ET\n")
        
        # Horizontal line
        stream.extend(b"0.8 0.8 0.8 RG 1 w 50 710 m 562 710 l S\n")
        
        # Body text
        stream.extend(b"BT\n/F2 10 Tf 50 690 Td 14 TL\n")
        for line in chunk:
            safe_line = "".join(c for c in line if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream.extend(f"({safe_line}) ' \n".encode("latin1"))
        stream.extend(b"ET\n")
        
        content_stream_obj = add_obj(f"<< /Length {len(stream)} >>\nstream\n".encode("latin1") + stream + b"\nendstream")
        
        page_obj = add_obj(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_stream_obj} 0 R "
            f"/Resources << /Font << /F1 {font_bold_obj} 0 R /F2 {font_reg_obj} 0 R >> >> >>".encode("latin1")
        )
        page_obj_ids.append(page_obj)

    # Rewrite Pages root object 2 with exact kids list
    kids_str = " ".join([f"{pid} 0 R" for pid in page_obj_ids])
    pages_content = f"2 0 obj\n<< /Type /Pages /Kids [{kids_str}] /Count {len(page_obj_ids)} >>\nendobj\n".encode("latin1")
    
    # Replace placeholder for obj 2 in pdf buffer
    # Re-assemble buffer
    rebuilt_pdf = bytearray()
    rebuilt_pdf.extend(b"%PDF-1.4\n")
    new_xref = []
    
    # 1: Catalog
    new_xref.append(len(rebuilt_pdf))
    rebuilt_pdf.extend(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    
    # 2: Pages
    new_xref.append(len(rebuilt_pdf))
    rebuilt_pdf.extend(pages_content)
    
    # 3: Font Bold
    new_xref.append(len(rebuilt_pdf))
    rebuilt_pdf.extend(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
    
    # 4: Font Regular
    new_xref.append(len(rebuilt_pdf))
    rebuilt_pdf.extend(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    
    # Add page contents & page objects
    current_obj_id = 5
    for page_num, chunk in enumerate(page_chunks, start=1):
        stream = bytearray()
        safe_title = "".join(c for c in title if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        safe_author = "".join(c for c in author if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        
        stream.extend(b"BT\n")
        stream.extend(f"/F1 16 Tf 50 740 Td ({safe_title}) Tj\n".encode("latin1"))
        stream.extend(f"/F2 9 Tf 0 -18 Td (Author: {safe_author}  |  Date: {now_str}  |  Page {page_num} of {total_pages}) Tj\n".encode("latin1"))
        stream.extend(b"ET\n")
        stream.extend(b"0.8 0.8 0.8 RG 1 w 50 710 m 562 710 l S\n")
        stream.extend(b"BT\n/F2 10 Tf 50 690 Td 14 TL\n")
        for line in chunk:
            safe_line = "".join(c for c in line if 32 <= ord(c) <= 126).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream.extend(f"({safe_line}) ' \n".encode("latin1"))
        stream.extend(b"ET\n")
        
        c_id = current_obj_id
        current_obj_id += 1
        p_id = current_obj_id
        current_obj_id += 1
        
        new_xref.append(len(rebuilt_pdf))
        rebuilt_pdf.extend(f"{c_id} 0 obj\n<< /Length {len(stream)} >>\nstream\n".encode("latin1") + stream + b"\nendstream\nendobj\n")
        
        new_xref.append(len(rebuilt_pdf))
        rebuilt_pdf.extend(
            f"{p_id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {c_id} 0 R "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n".encode("latin1")
        )
        
    xref_offset = len(rebuilt_pdf)
    rebuilt_pdf.extend(f"xref\n0 {len(new_xref) + 1}\n0000000000 65535 f \n".encode("latin1"))
    for offset in new_xref:
        rebuilt_pdf.extend(f"{offset:010d} 00000 n \n".encode("latin1"))
    rebuilt_pdf.extend(f"trailer\n<< /Size {len(new_xref) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("latin1"))
    
    return bytes(rebuilt_pdf)
