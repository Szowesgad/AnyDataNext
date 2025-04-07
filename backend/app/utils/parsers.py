import os
import json
import re
import csv
import yaml
import logging
import io
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

# Optional: advanced NLP for chunking
try:
    import nltk
    # Pamiętaj: python -m nltk.downloader punkt
    nltk_available = True
except ImportError:
    nltk_available = False

# Import handlers for document formats
try:
    import docx
    from pdfminer.high_level import extract_text
    from pdfminer.layout import LAParams
    DOCX_SUPPORT = True
    PDF_SUPPORT = True
except ImportError:
    DOCX_SUPPORT = False
    PDF_SUPPORT = False

# Constants for chunking
MAX_CHUNK_SIZE = 1500  # Maximum number of characters in a chunk
MIN_CHUNK_SIZE = 100   # Minimum chunk size to keep
CHUNK_OVERLAP = 0      # Overlap in characters (np. 100 jeśli chcesz nakładkę)

def _clean_whitespace(text: str) -> str:
    """
    Reduce excessive whitespace but keep double newlines as paragraph boundaries.
    - Zamienia wielokrotne spacje w pojedynczą.
    - Ogranicza >=3 pustych linii do maksymalnie 2.
    - Naprawia problem z przenoszeniami wyrazów (słowo- kontynuacja).
    """
    # 1. Zamień wielokrotne spacje/taby w jednej linii na pojedynczą spację:
    #    [^\S\r\n] oznacza "whitespace niebędący \r ani \n"
    text = re.sub(r'[^\S\r\n]+', ' ', text)
    
    # 2. Zredukuj wielokrotne puste linie do maks. dwóch \n\n
    #    np. 3 i więcej newlinów -> 2 newliny
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # 3. Napraw problem z dzielonymi słowami (np. "oczeki- waly")
    text = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', text)
    
    # 4. Dodatkowe czyszczenie: usuń zbędne podzielenia ze skanowanych PDF-ów
    text = re.sub(r'(\w+)-\s*\n\s*(\w+)', r'\1\2', text)
    
    # trim trailing spaces
    text = text.strip()
    return text

def split_into_sentences(text: str) -> List[str]:
    """
    Split text into sentences using NLTK if available,
    otherwise fallback to regex-based approach.
    """
    if nltk_available:
        from nltk.tokenize import sent_tokenize
        sentences = sent_tokenize(text)
        return [s.strip() for s in sentences if s.strip()]
    else:
        # Prosty fallback
        pattern = r'(?<=[.!?])\s+'
        raw_sentences = re.split(pattern, text)
        sentences = [s.strip() for s in raw_sentences if s.strip()]
        return sentences

def chunk_text(text: str,
               max_size: int = MAX_CHUNK_SIZE,
               min_size: int = MIN_CHUNK_SIZE,
               overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Intelligently chunk text into smaller parts not exceeding max_size,
    with potential overlap.
    
    Steps:
      1. Split text into paragraphs (double newline).
      2. For each paragraph, if it's bigger than max_size, split by sentences.
      3. If a sentence is still bigger than max_size, split by spaces.
      4. Combine smaller paragraphs or sentences if they are < min_size
         to avoid too tiny chunks.
      5. Optionally add overlap between consecutive chunks if overlap>0.
    """
    if len(text) <= max_size:
        return [text]
    
    paragraphs = re.split(r'\n\s*\n', text)
    results = []
    current_buffer = ""

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        
        if len(paragraph) > max_size:
            # Split by sentences
            sentences = split_into_sentences(paragraph)
            
            for sentence in sentences:
                if len(sentence) > max_size:
                    # fallback: split by space
                    words = sentence.split()
                    chunk_temp = ""
                    for w in words:
                        if len(chunk_temp) + len(w) + 1 <= max_size:
                            if chunk_temp:
                                chunk_temp += " "
                            chunk_temp += w
                        else:
                            if chunk_temp:
                                results.append(chunk_temp)
                            chunk_temp = w
                    if chunk_temp:
                        results.append(chunk_temp)
                else:
                    # normal sentence
                    if (len(current_buffer) + len(sentence) + 1) <= max_size:
                        if current_buffer:
                            current_buffer += " "
                        current_buffer += sentence
                    else:
                        if current_buffer:
                            results.append(current_buffer)
                        current_buffer = sentence
            
            if current_buffer:
                results.append(current_buffer)
                current_buffer = ""
        else:
            # paragraph smaller than max_size
            if (len(current_buffer) + len(paragraph) + 2) <= max_size:
                if current_buffer:
                    current_buffer += "\n\n"
                current_buffer += paragraph
            else:
                if current_buffer:
                    results.append(current_buffer)
                current_buffer = paragraph
    
    if current_buffer:
        results.append(current_buffer)
    
    # 2. scal bardzo krótkie fragmenty z sąsiednimi
    final_chunks = []
    buffer_chunk = ""
    for chunk in results:
        if not buffer_chunk:
            buffer_chunk = chunk
            continue
        if len(buffer_chunk) < min_size:
            buffer_chunk += "\n" + chunk
        else:
            if len(chunk) < min_size:
                buffer_chunk += "\n" + chunk
            else:
                final_chunks.append(buffer_chunk)
                buffer_chunk = chunk
    if buffer_chunk:
        final_chunks.append(buffer_chunk)
    
    # 3. Overlap (opcjonalnie)
    if overlap > 0 and overlap < max_size // 2:
        overlapped_result = []
        for i, ch in enumerate(final_chunks):
            if i == 0:
                overlapped_result.append(ch)
            else:
                prev = overlapped_result[-1]
                if len(prev) > overlap:
                    tail = prev[-overlap:]
                    combined = tail + "\n" + ch
                    overlapped_result.append(combined)
                else:
                    overlapped_result.append(ch)
        return overlapped_result
    else:
        return final_chunks


def parse_txt(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_txt] Parsing .txt file: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text_content = f.read()
    except Exception as e:
        logger.error(f"[parse_txt] Error reading .txt file: {file_path}. Details: {e}")
        raise
    
    # Usuwamy nadmiar whitespace
    text_content = _clean_whitespace(text_content)
    
    chunks = chunk_text(text_content, max_size=MAX_CHUNK_SIZE)
    records = []
    for i, chunk in enumerate(chunks):
        # Generowanie instrukcji na podstawie zawartości
        instruction = ""
        if "?" in chunk:
            # Jeśli jest pytanie, użyj go jako instrukcji
            first_question = re.search(r'([^.!?]*\?)', chunk)
            if first_question:
                instruction = "Udziel odpowiedzi na pytanie: " + first_question.group(1)
        
        # Generowanie domyślnej odpowiedzi dla każdego fragmentu
        default_output = ""
        if len(chunk) > 200:
            # Dla dłuższych fragmentów generuj bardziej rozbudowaną odpowiedź
            is_medical = any(word in chunk.lower() for word in ["medycyn", "zdrowi", "leczen", "diagno", "choroby"])
            is_veterinary = any(word in chunk.lower() for word in ["weteryn", "zwierz", "kot", "pies"])
            
            if is_veterinary:
                default_output = "Na podstawie analizy tekstu dotyczącego weterynarii, można zauważyć istotne aspekty dotyczące opieki nad zwierzętami. Przedstawione informacje wskazują na znaczenie odpowiedniego podejścia do leczenia i diagnostyki zwierząt."
            elif is_medical:
                default_output = "Analizując przedstawione dane medyczne, można wyciągnąć wnioski dotyczące procedur leczniczych i diagnostycznych. Informacje te wskazują na istotne aspekty w podejściu do kwestii zdrowotnych."
            else:
                default_output = "Przedstawione informacje zawierają istotne dane, które można wykorzystać w procesie analizy. Tekst wskazuje na kluczowe aspekty omawianego tematu."
        
        records.append({
            "instruction": instruction,
            "input": chunk,
            "output": default_output,
            "metadata": {
                "chunk_index": i,
                "total_chunks": len(chunks),
                "source_file": os.path.basename(file_path)
            }
        })
    
    logger.info(f"[parse_txt] Created {len(records)} records from text file (chunked).")
    return records


def parse_md(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_md] Parsing .md file: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text_content = f.read()
    except Exception as e:
        logger.error(f"[parse_md] Error reading .md file: {file_path}. Details: {e}")
        raise
    
    text_content = _clean_whitespace(text_content)
    
    # Split by top-level headers
    sections = re.split(r'(?=\n#{1,6}\s)', text_content)
    if len(sections) <= 1:
        logger.info("[parse_md] No major headers found, falling back to parse_txt logic")
        return parse_txt(file_path, logger)
    
    all_chunks = []
    section_titles = []
    for section in sections:
        section = section.strip()
        if not section:
            continue
            
        # Spróbuj wyciągnąć tytuł sekcji (nagłówek)
        header_match = re.match(r'^(#+)\s+(.+)$', section, re.MULTILINE)
        section_title = ""
        if header_match:
            section_title = header_match.group(2).strip()
            
        parted = chunk_text(section, max_size=MAX_CHUNK_SIZE)
        all_chunks.extend(parted)
        section_titles.extend([section_title] * len(parted))
    
    records = []
    for i, (chunk, title) in enumerate(zip(all_chunks, section_titles)):
        # Generowanie instrukcji na podstawie nagłówka sekcji
        instruction = ""
        if title:
            instruction = f"Przedstaw informacje na temat: {title}"
            
        # Generowanie domyślnej odpowiedzi dla każdego fragmentu
        default_output = "Analiza treści dokumentu wskazuje na istotne informacje dotyczące tematu. "
        if title:
            default_output += f"W sekcji \"{title}\" przedstawione są kluczowe elementy, które warto uwzględnić w całościowej ocenie zagadnienia."
        
        records.append({
            "instruction": instruction,
            "input": chunk,
            "output": default_output,
            "metadata": {
                "chunk_index": i,
                "total_chunks": len(all_chunks),
                "section_title": title,
                "source_file": os.path.basename(file_path)
            }
        })
    logger.info(f"[parse_md] Created {len(records)} records from markdown file")
    return records


def parse_csv(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_csv] Parsing .csv file: {file_path}")
    parsed_data = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_data = f.read()
        raw_data = _clean_whitespace(raw_data)
        
        # Ponownie wczytujemy do CSV
        dialect = csv.Sniffer().sniff(raw_data[:2048])
        f2 = io.StringIO(raw_data)
        csv_reader = csv.DictReader(f2, dialect=dialect)
        rows = list(csv_reader)
        
        headers = csv_reader.fieldnames or []
        if not rows:
            logger.warning(f"[parse_csv] CSV file is empty or has no data: {file_path}")
            return []
        
        for i, row in enumerate(rows):
            row_text_parts = []
            for h in headers:
                val = row.get(h, "")
                if val:
                    row_text_parts.append(f"{h}: {val}")
            
            row_text = "\n".join(row_text_parts)
            
            # Generate a reasonable instruction based on header names
            instruction = f"Analizuj dane z wiersza {i+1} tabeli"
            if headers and len(headers) > 0:
                key_headers = [h for h in headers if any(kw in h.lower() for kw in ["nazwa", "tytuł", "kategoria", "id"])]
                if key_headers:
                    instruction = f"Przeanalizuj informacje o {row.get(key_headers[0], 'elemencie')} z tabeli"
            
            # Generate sample output
            header_types = []
            for h in headers:
                if any(word in h.lower() for word in ["data", "date", "czas", "time"]):
                    header_types.append("czasowa")
                elif any(word in h.lower() for word in ["kwota", "cena", "koszt", "amount", "price"]):
                    header_types.append("finansowa") 
                elif any(word in h.lower() for word in ["nazwa", "name", "tytuł", "title"]):
                    header_types.append("identyfikacyjna")
                else:
                    header_types.append("informacyjna")
            
            output = f"Na podstawie analizy wiersza {i+1} tabeli, można stwierdzić, że "
            if "czasowa" in header_types and "finansowa" in header_types:
                output += "dane przedstawiają informacje finansowe z określonymi ramami czasowymi. "
            elif "finansowa" in header_types:
                output += "dane zawierają istotne informacje finansowe. "
            elif "czasowa" in header_types:
                output += "dane są uporządkowane chronologicznie. "
            else:
                output += "dane zawierają istotne informacje do dalszej analizy. "
            
            output += "Kluczowe elementy to: " + ", ".join([f"{h}" for h in headers[:3]])
            
            if len(row_text) <= MAX_CHUNK_SIZE:
                parsed_data.append({
                    "instruction": instruction,
                    "input": row_text,
                    "output": output,
                    "metadata": {
                        "row_index": i,
                        "source_file": os.path.basename(file_path)
                    }
                })
            else:
                splitted = chunk_text(row_text, max_size=MAX_CHUNK_SIZE)
                for j, chunk in enumerate(splitted):
                    parsed_data.append({
                        "instruction": instruction + f" (część {j+1}/{len(splitted)})",
                        "input": chunk,
                        "output": output,
                        "metadata": {
                            "row_index": i,
                            "chunk_index": j,
                            "source_file": os.path.basename(file_path)
                        }
                    })
    except Exception as e:
        logger.error(f"[parse_csv] Error parsing CSV: {e}")
        raise
    
    logger.info(f"[parse_csv] Created {len(parsed_data)} records from CSV")
    return parsed_data


def _process_json_item(item: Any, logger=None, path="root") -> List[Dict[str, Any]]:
    """
    Recursively parse a JSON item to produce records. If there's a text field 
    that's too large, chunk it. Otherwise, if we see instruction/input/output,
    we treat it as a direct record.
    """
    records = []
    if isinstance(item, dict):
        # If directly matches instruction/input
        if all(k in item for k in ['instruction','input']):
            rec = {
                "instruction": str(item['instruction']),
                "input": str(item['input']),
                "output": str(item.get('output',"")),
                "metadata": item.get('metadata', {})
            }
            records.append(rec)
            return records
        
        text_keys = ["body","content","text","description"]
        large_field_found = False
        for tk in text_keys:
            if tk in item and isinstance(item[tk], str) and len(item[tk])>MAX_CHUNK_SIZE:
                cleaned = _clean_whitespace(item[tk])
                splitted = chunk_text(cleaned, max_size=MAX_CHUNK_SIZE)
                for i, chunk in enumerate(splitted):
                    records.append({
                        "instruction": "Przeanalizuj następujący tekst",
                        "input": chunk,
                        "output": f"Analiza wskazuje na istotne informacje zawarte w tekście dotyczącym {path}.{tk}. Dokument zawiera kluczowe dane, które należy uwzględnić w kontekście całościowej oceny.",
                        "metadata":{
                            "json_path": path,
                            "chunk_index": i,
                            "source_field": tk
                        }
                    })
                large_field_found = True
        
        if not large_field_found:
            for k,v in item.items():
                sub_path = f"{path}.{k}" if path else k
                sub_records = _process_json_item(v, logger, sub_path)
                records.extend(sub_records)
    
    elif isinstance(item, list):
        for i, element in enumerate(item):
            sub_path = f"{path}[{i}]"
            sub_records = _process_json_item(element, logger, sub_path)
            records.extend(sub_records)
    
    elif isinstance(item, str):
        if len(item) > MAX_CHUNK_SIZE:
            cleaned = _clean_whitespace(item)
            splitted = chunk_text(cleaned, max_size=MAX_CHUNK_SIZE)
            for i, chunk in enumerate(splitted):
                records.append({
                    "instruction": "Przedstaw treść dokumentu",
                    "input": chunk,
                    "output": f"Dokument zawiera istotne treści, które należy przeanalizować w kontekście całościowego znaczenia. Fragment {i+1} stanowi część większej całości.",
                    "metadata":{
                        "json_path": path,
                        "chunk_index": i
                    }
                })
    return records

def parse_json_file(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_json_file] Parsing .json file: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = f.read()
        data = _clean_whitespace(data)
        parsed_json = json.loads(data)
    except Exception as e:
        logger.error(f"[parse_json_file] Error parsing JSON: {e}")
        raise
    
    recs = _process_json_item(parsed_json, logger=logger)
    if not recs:
        return [{
            "instruction":"Przeanalizuj strukturę dokumentu JSON",
            "input": data,
            "output":"Dokument JSON zawiera zorganizowaną strukturę danych, która może być wykorzystana do dalszej analizy. Struktura ta jest typowa dla schematów wymiany danych.",
            "metadata": {"source_file": os.path.basename(file_path)}
        }]
    logger.info(f"[parse_json_file] Created {len(recs)} records from JSON file.")
    return recs

def parse_jsonl_file(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_jsonl_file] Parsing .jsonl file: {file_path}")
    results = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Usuwamy whitespace z każdej linii
        cleaned_lines = [line.strip() for line in lines if line.strip()]
        
        for i, line in enumerate(cleaned_lines, start=1):
            try:
                obj = json.loads(line)
                sub_records = _process_json_item(obj, logger=logger, path=f"line_{i}")
                if not sub_records:
                    results.append({
                        "instruction":"Przeanalizuj obiekt JSON",
                        "input": line,
                        "output":"Obiekt JSON reprezentuje element w kolekcji danych. Na podstawie struktury można określić jego zastosowanie i kontekst w całościowym systemie.",
                        "metadata":{"line_number": i}
                    })
                else:
                    results.extend(sub_records)
            except json.JSONDecodeError as e:
                logger.error(f"[parse_jsonl_file] Decoding error line {i}: {e}")
                # Możesz tu przerwać lub pominąć
                pass
        
        logger.info(f"[parse_jsonl_file] Created {len(results)} records.")
        return results
    except Exception as e:
        logger.error(f"[parse_jsonl_file] Error reading jsonl: {e}")
        raise

def parse_yaml_file(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_yaml_file] Parsing .yaml/.yml file: {file_path}")
    try:
        import yaml
    except ImportError:
        logger.error("Missing pyyaml. Please install pyyaml.")
        raise
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            raw_data = f.read()
        raw_data = _clean_whitespace(raw_data)
        data = yaml.safe_load(raw_data)
    except Exception as e:
        logger.error(f"[parse_yaml_file] Error loading YAML: {e}")
        raise
    
    recs = _process_json_item(data, logger=logger, path="yaml_root")
    if not recs:
        return [{
            "instruction":"Analizuj strukturę pliku konfiguracyjnego YAML",
            "input": raw_data,
            "output":"Plik YAML zawiera uporządkowaną konfigurację, która określa parametry i ustawienia systemu. Na podstawie struktury można określić logikę działania i przeznaczenie aplikacji.",
            "metadata": {"source_file": os.path.basename(file_path)}
        }]
    
    logger.info(f"[parse_yaml_file] Created {len(recs)} records from YAML.")
    return recs

def parse_docx(file_path: str, logger) -> List[Dict[str, Any]]:
    if not DOCX_SUPPORT:
        raise ImportError("python-docx or pdfminer not installed.")
    
    logger.info(f"[parse_docx] Parsing .docx file: {file_path}")
    try:
        doc = docx.Document(file_path)
    except Exception as e:
        logger.error(f"[parse_docx] Error reading DOCX: {e}")
        raise
    
    sections = []
    current_heading = None
    current_section = []
    
    def flush_section():
        if current_section:
            merged = "\n".join(current_section).strip()
            # wyczyść whitespace
            merged = _clean_whitespace(merged)
            sections.append((current_heading, merged))
    
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if not text:
            continue
        style_name = paragraph.style.name if paragraph.style else ""
        
        if style_name.startswith("Heading"):
            flush_section()
            current_heading = text
            current_section = []
        elif "ListBullet" in style_name or "ListNumber" in style_name or "Bulleted" in style_name:
            if current_section:
                current_section.append(f"• {text}")
            else:
                current_section = [f"• {text}"]
        else:
            current_section.append(text)
    
    flush_section()
    
    if not sections and current_section:
        sections.append((None, _clean_whitespace("\n".join(current_section))))
    
    records = []
    chunked_count = 0
    
    for i, (heading, content) in enumerate(sections):
        if not content.strip():
            continue
        
        # Generate instruction based on heading
        instruction = "Przeanalizuj następujący fragment dokumentu"
        if heading:
            instruction = f"Przedstaw informacje na temat: {heading}"
        
        # Generate default output based on content
        output = "Analiza dokumentu wskazuje na istotne informacje, które należy uwzględnić w całościowej ocenie. "
        if heading:
            output += f"Sekcja '{heading}' zawiera kluczowe elementy związane z tematem dokumentu."
        
        parted = chunk_text(content, max_size=MAX_CHUNK_SIZE)
        for j, ch in enumerate(parted):
            records.append({
                "instruction": instruction + (f" (część {j+1}/{len(parted)})" if len(parted) > 1 else ""),
                "input": ch,
                "output": output,
                "metadata":{
                    "docx_heading": heading,
                    "section_index": i,
                    "chunk_index": j,
                    "source_file": os.path.basename(file_path)
                }
            })
            chunked_count += 1
    
    logger.info(f"[parse_docx] Created {chunked_count} records from DOCX (chunked).")
    return records

def parse_pdf(file_path: str, logger) -> List[Dict[str, Any]]:
    if not PDF_SUPPORT:
        raise ImportError("pdfminer.six not installed.")
    logger.info(f"[parse_pdf] Parsing .pdf file: {file_path}")
    
    try:
        # Open in binary mode to handle PDF files correctly
        laparams = LAParams(line_margin=0.5)
        with open(file_path, 'rb') as f:
            raw_text = extract_text(f, laparams=laparams)
    except Exception as e:
        logger.error(f"[parse_pdf] Error extracting text from PDF: {e}")
        raise
    
    # usuwamy nadmierny whitespace
    raw_text = _clean_whitespace(raw_text)
    
    page_markers = re.findall(r'(?:Page \d+ of \d+)', raw_text)
    chunks = []
    
    if page_markers:
        splitted = re.split(r'(Page \d+ of \d+)', raw_text)
        buffer_page = ""
        page_texts = []
        for seg in splitted:
            if seg.startswith("Page "):
                if buffer_page.strip():
                    page_texts.append(buffer_page)
                buffer_page = ""
            else:
                buffer_page += seg
        if buffer_page.strip():
            page_texts.append(buffer_page)
        
        for i, page_txt in enumerate(page_texts):
            parted = chunk_text(page_txt, max_size=MAX_CHUNK_SIZE)
            chunks.extend(parted)
    else:
        parted = chunk_text(raw_text, max_size=MAX_CHUNK_SIZE)
        chunks.extend(parted)
    
    records = []
    for i, ch in enumerate(chunks):
        # Generate a reasonable output
        output = "Dokument PDF zawiera istotne informacje, które mogą być wykorzystane do dalszej analizy. "
        
        # Detect potential document type
        if re.search(r'(faktura|invoice|rachunek)', ch, re.IGNORECASE):
            output = "Dokument zawiera informacje finansowe, prawdopodobnie jest to faktura lub rachunek. Należy zwrócić uwagę na kwoty, daty i strony transakcji."
        elif re.search(r'(umowa|agreement|kontrakt|contract)', ch, re.IGNORECASE):
            output = "Dokument ma charakter prawny, prawdopodobnie jest to umowa. Należy zwrócić uwagę na warunki, zobowiązania stron i terminy obowiązywania."
        elif re.search(r'(raport|report|analiza|analysis)', ch, re.IGNORECASE):
            output = "Dokument ma charakter analityczny, prawdopodobnie jest to raport. Zawiera kluczowe wnioski i dane, które mogą być podstawą do podejmowania decyzji."
        
        records.append({
            "instruction": f"Przeanalizuj fragment {i+1}/{len(chunks)} dokumentu PDF",
            "input": ch,
            "output": output,
            "metadata":{
                "chunk_index": i,
                "total_chunks": len(chunks),
                "source_file": os.path.basename(file_path)
            }
        })
    logger.info(f"[parse_pdf] Created {len(records)} records from PDF.")
    return records

def parse_file(file_path: str, logger) -> List[Dict[str, Any]]:
    logger.info(f"[parse_file] Starting parsing of file: {file_path}")
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".txt":
        return parse_txt(file_path, logger)
    elif ext == ".md":
        return parse_md(file_path, logger)
    elif ext == ".csv" or ext == ".tsv":
        return parse_csv(file_path, logger)
    elif ext == ".json":
        return parse_json_file(file_path, logger)
    elif ext == ".jsonl":
        return parse_jsonl_file(file_path, logger)
    elif ext in [".yaml", ".yml"]:
        return parse_yaml_file(file_path, logger)
    elif ext == ".docx":
        return parse_docx(file_path, logger)
    elif ext == ".pdf":
        return parse_pdf(file_path, logger)
    else:
        msg = f"Unsupported file extension: {ext}. Supported: .txt, .md, .csv, .tsv, .json, .jsonl, .yaml, .yml, .docx, .pdf"
        logger.error(f"[parse_file] {msg}")
        raise ValueError(msg)