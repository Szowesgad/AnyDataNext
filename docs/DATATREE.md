Propozycja uporządkowanej struktury folderów dla aplikacji konwertującej różne formaty plików na potrzeby tworzenia datasetów AI:
```tree
anydata/
├── raw_data/                      # Dane pierwotne przed jakąkolwiek obróbką
│   ├── documents/                 # Dokumenty tekstowe, PDF, itp.
│   │   ├── pdf/
│   │   ├── docx/
│   │   ├── txt/
│   │   └── other_docs/
│   ├── images/                    # Obrazy w różnych formatach
│   │   ├── jpg/
│   │   ├── png/
│   │   └── other_images/
│   ├── audio/                     # Pliki dźwiękowe
│   │   ├── mp3/
│   │   ├── wav/
│   │   └── other_audio/
│   ├── video/                     # Materiały wideo
│   │   ├── mp4/
│   │   ├── avi/
│   │   └── other_video/
│   ├── structured/                # Dane strukturalne
│   │   ├── csv/
│   │   ├── xml/
│   │   └── other_structured/
│   └── misc/                      # Inne typy plików
│
├── preprocessed/                  # Formaty pośrednie przed konwersją do JSON
│   ├── extracted_text/            # Tekst wyciągnięty z różnych źródeł (np. z PDF)
│   ├── transcriptions/            # Transkrypcje audio/wideo
│   ├── ocr_results/               # Wyniki rozpoznawania tekstu z obrazów
│   ├── normalized_data/           # Znormalizowane dane
│   └── processed_media/           # Wstępnie przetworzone media
│
├── json_data/                     # Wszystkie dane skonwertowane do JSON/JSONL
│   ├── documents_json/            # Dokumenty w formacie JSON/JSONL
│   ├── images_json/               # Opisy obrazów/metadane w formacie JSON/JSONL
│   ├── audio_json/                # Dane audio (transkrypcje, metadane) w JSON/JSONL
│   ├── video_json/                # Dane wideo w formacie JSON/JSONL
│   ├── structured_json/           # Przekonwertowane dane strukturalne w JSON/JSONL
│   └── combined_json/             # Połączone dane z różnych źródeł w JSON/JSONL
│
├── datasets/                      # Gotowe zestawy danych do treningu AI
│   ├── training/                  # Dane treningowe (wszystkie w JSON/JSONL)
│   ├── validation/                # Dane walidacyjne (wszystkie w JSON/JSONL)
│   ├── test/                      # Dane testowe (wszystkie w JSON/JSONL)
│   ├── augmented/                 # Dane z augmentacją (wszystkie w JSON/JSONL)
│   └── versions/                  # Historia wersji datasetów
│       ├── v1/
│       ├── v2/
│       └── ...
│
├── metadata/                      # Metadane o plikach i procesie konwersji
│   ├── logs/                      # Logi procesów konwersji
│   │   ├── conversion_logs/       # Logi z procesów konwersji formatów
│   │   ├── error_logs/            # Logi błędów podczas przetwarzania
│   │   └── performance_logs/      # Logi wydajności
│   ├── stats/                     # Statystyki dotyczące danych
│   │   ├── dataset_stats/         # Statystyki zbiorów danych
│   │   ├── distribution_reports/  # Raporty o rozkładzie danych
│   │   └── quality_metrics/       # Metryki jakości danych
│   └── schemas/                   # Schematy danych JSON/JSONL
│       ├── document_schemas/      # Schematy dla dokumentów
│       ├── media_schemas/         # Schematy dla multimediów
│       └── dataset_schemas/       # Schematy dla gotowych datasetów
│
├── exports/                       # Dane wyeksportowane do innych formatów (jeśli potrzebne)
│   ├── csv_exports/               # Eksporty do CSV
│   ├── xml_exports/               # Eksporty do XML
│   └── special_formats/           # Eksporty do formatów specyficznych dla modeli
│
├── temp/                          # Pliki tymczasowe (mogą być czyszczone)
│   ├── extraction_temp/           # Pliki tymczasowe podczas ekstrakcji
│   ├── conversion_temp/           # Pliki tymczasowe podczas konwersji
│   └── processing_temp/           # Pliki tymczasowe podczas przetwarzania
└──# ... current anydataset application structure
# or as suggested below: 
# ├── config/                        # Konfiguracje procesów konwersji
# ├── pipelines/                 # Definicje potoków konwersji
# │   ├── to_json_pipelines/     # Potoki konwersji do JSON/JSONL
# │   ├── extraction_pipelines/  # Potoki ekstrakcji danych
# │   └── dataset_pipelines/     # Potoki tworzenia datasetów
# ├── templates/                 # Szablony dla formatów JSON/JSONL
# │   ├── document_templates/    # Szablony dla dokumentów
# │   ├── media_templates/       # Szablony dla multimediów
# │   └── dataset_templates/     # Szablony dla datasetów
# ├── settings/                  # Ustawienia aplikacji
# ├── conversion_settings/   # Ustawienia konwersji
# ├── processing_settings/   # Ustawienia przetwarzania
# └── app_settings/          # Ogólne ustawienia aplikacji
```
# Szczegółowe omówienie struktury folderów dla aplikacji Anydata

## 1. `raw_data/`

Ten folder zawiera oryginalne, niezmienione dane w stanie, w jakim zostały dostarczone lub pobrane.

- **`documents/`**: Przechowuje wszystkie pliki dokumentów tekstowych (PDF, DOCX, ODT, TXT, RTF, itd.)
- **`images/`**: Zawiera wszelkiego rodzaju pliki graficzne (JPG, PNG, TIFF, SVG, itd.)
- **`audio/`**: Przechowuje pliki dźwiękowe (MP3, WAV, FLAC, OGG, itd.)
- **`video/`**: Zawiera materiały wideo (MP4, AVI, MKV, MOV, itd.)
- **`structured/`**: Przechowuje dane w formatach strukturalnych (JSON, CSV, XML, YAML, itd.)
- **`misc/`**: Miejsce na pliki, które nie pasują do żadnej z powyższych kategorii

Dane w tym folderze są traktowane jako “nieruszalne” – są to dane źródłowe, które stanowią punkt wyjścia do dalszych przekształceń.

## 2. `processed/`

W tym folderze znajdują się dane po wstępnym przetworzeniu, ale jeszcze przed finalną konwersją formatu. Przetwarzanie może obejmować czyszczenie, normalizację, segmentację, itd.

- **`text_extracted/`**: Zawiera tekst wyekstrahowany z różnych źródeł, np. tekst wyciągnięty z PDF-ów, dokumentów Word czy nawet z obrazów poprzez OCR
- **`audio_processed/`**: Przechowuje pliki audio po wstępnej obróbce, np. po usunięciu szumów, normalizacji głośności czy segmentacji
- **`transcriptions/`**: Zawiera transkrypcje mowy na tekst z plików audio lub wideo
- **`annotations/`**: Przechowuje dane z adnotacjami (ręcznymi lub automatycznymi), np. oznaczenie istotnych fragmentów w tekście czy kategorie dla obrazów
- **`normalized/`**: Zawiera znormalizowane wersje danych, np. ujednolicony format dat czy standardowe kodowanie znaków

**Różnica między `processed/` a `converted/`**: Folder `processed/` zawiera dane po modyfikacjach zawartości (np. usunięcie szumów z audio, wyciągnięcie tekstu z PDF), ale niekoniecznie w innym formacie pliku. Natomiast `converted/` zawiera dane po zmianie formatu pliku (np. z PDF na JSONL).

## 3. `converted/`

W tym folderze znajdują się pliki po konwersji z jednego formatu na drugi, bez znaczących zmian w samej zawartości.

- **`by_format/`**: Organizuje pliki według formatu docelowego
    - **`jsonl/`**: Pliki skonwertowane do formatu JSONL
    - **`txt/`**: Pliki skonwertowane do formatu TXT
    - **`csv/`**: Pliki skonwertowane do formatu CSV
    - **`wav/`**: Pliki audio skonwertowane do formatu WAV
    - itd.
- **`by_pipeline/`**: Organizuje pliki według ścieżki konwersji
    - **`pdf_to_txt_to_jsonl/`**: Pliki, które przeszły konwersję z PDF przez TXT do JSONL
    - **`mp4_to_wav/`**: Pliki wideo skonwertowane na pliki audio
    - itd.

Ta struktura umożliwia zarówno znalezienie wszystkich plików w określonym formacie, jak i śledzenie konkretnych ścieżek konwersji.

## 4. `datasets/`

Ten folder zawiera gotowe zestawy danych, przygotowane do użycia w treningu modeli AI.

- **`training/`**: Dane przeznaczone do trenowania modeli 80%
- **`validation/`**: Dane do walidacji modelu podczas treningu 20%
- **`test/`**: Dane do testowania wydajności wytrenowanego modelu (zwykle 10-15%)
- **`versions/`**: Historia wersji datasetów
    - **`v1/`**: Pierwsza wersja datasetu
    - **`v2/`**: Druga wersja, zawierająca np. poprawki lub rozszerzenia
    - itd.

Dane w tym folderze są już w odpowiednim formacie i podziale, gotowe do bezpośredniego podania do frameworków ML/AI.

## 5. `metadata/`

Ten folder przechowuje informacje o danych i procesach konwersji.

- **`logs/`**: Logi z procesów konwersji, zawierające informacje o przebiegu, ostrzeżeniach i błędach
- **`stats/`**: Statystyki dotyczące danych, np. rozkład klas, długość tekstów, jakość obrazów
- **`schemas/`**: Definicje struktur danych, np. schematy JSON, opisy pól CSV

Metadata są kluczowe dla reproducibility (możliwości odtworzenia procesu) oraz dla monitorowania jakości danych.

## 6. `temp/`

Folder na pliki tymczasowe generowane podczas procesów konwersji. Te pliki mogą być automatycznie czyszczone po zakończeniu procesów.

## 7. `config/`

Ten folder zawiera różne konfiguracje dla aplikacji Anydata.

- **`pipelines/`**: Definicje potoków konwersji, np. sekwencje kroków do przekształcenia PDF w JSONL
- **`templates/`**: Szablony dla formatów wyjściowych, np. struktura JSONL dla różnych typów danych
- **`settings/`**: Ogólne ustawienia aplikacji, np. liczba wątków do przetwarzania równoległego

## Podsumowanie różnic między kluczowymi folderami:

1. **`raw_data/` vs `processed/`**:
    - `raw_data/` zawiera oryginalne, niezmienione dane
    - `processed/` zawiera dane po wstępnej obróbce (czyszczenie, normalizacja, itp.)
2. **`processed/` vs `converted/`**:
    - `processed/` skupia się na modyfikacji zawartości bez zmiany formatu
    - `converted/` skupia się na zmianie formatu pliku, a nie na modyfikacji zawartości
3. **`converted/` vs `datasets/`**:
    - `converted/` zawiera pojedyncze pliki po konwersji formatów
    - `datasets/` zawiera zorganizowane kolekcje danych gotowe do treningu AI, często łączące wiele skonwertowanych plików

Ta struktura zapewnia przejrzysty przepływ danych od surowych, przez przetworzenie i konwersję, aż do gotowych datasetów, z zachowaniem historii i metadanych na każdym etapie.

1. **Przejrzystość procesu** - widoczny jest przepływ danych od surowych przez przetworzone do gotowych datasetów
2. **Elastyczność** - można łatwo dodawać nowe formaty i przepływy konwersji
3. **Zarządzanie wersjami** - możliwość śledzenia zmian w datasetach
4. **Separacja danych** - rozdzielenie danych według etapu przetwarzania i typu
5. **Łatwe odtwarzanie procesu**
6. Ta struktura zapewnia również dobrą podstawę do automatyzacji procesów konwersji i tworzenia datasetów + śledzenie całego procesu od surowych danych do zestawu treningowego.

# Formaty plików

### Dokumenty

- PDF (.pdf)
- Microsoft Word (.doc, .docx)
- OpenDocument Text (.odt)
- Rich Text Format (.rtf)
- Text (.txt)
- Markdown (.md)
- HTML (.html, .htm)
- XML (.xml)
- LaTeX (.tex)

### Obrazy

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)
- SVG (.svg)
- WebP (.webp)
- RAW (.raw, .cr2, .nef)
- PSD (.psd)
- ....

### Audio

- WAV (.wav)
- MP3 (.mp3)
- AAC (.aac)
- FLAC (.flac)
- 
    - M4A (.m4a)
- OGG (.ogg)
- AIFF (.aiff)
- WMA (.wma)
- ....

### Wideo

- MP4 (.mp4)
- AVI (.avi)
- MKV (.mkv)
- MOV (.mov)
- WebM (.webm)
- WMV (.wmv)
- MPEG (.mpeg, .mpg)
- TS (.ts)
- ....

### Dane strukturalne

- JSON (.json)
- JSONL (.jsonl)
- NDJSON (.ndjson)
- CSV (.csv)
- TSV (.tsv)
- Excel (.xls, .xlsx)
- XML (.xml)
- YAML (.yml, .yaml)
- Parquet (.parquet)
- Protocol Buffers (.pb)
- SQLite (.sqlite, .db)
- ….

### Archiwa i kompresja

- ZIP (.zip)
- RAR (.rar)
- TAR (.tar)
- GZ (.gz)
- 7Z (.7z)
- ……

### Formaty specyficzne dla AI i ML

- TensorFlow Model (.pb, .h5)
- PyTorch Model (.pt, .pth)
- ONNX (.onnx)
- HDF5 (.h5)
- TFRecord (.tfrecord)
- SFrame (.sframe)
- .....

### Inne specjalistyczne formaty

- CAD (.dwg, .dxf)
- 3D Models (.obj, .stl, .fbx)
- Subtitle (.srt, .vtt)
- E-books (.epub, .mobi)
- Vector (.ai, .eps)

Każda z kategorii w strukturze folderów mogłaby zawierać odpowiednie podkatalogi dla tych konkretnych formatów, umożliwiając precyzyjne zarządzanie różnymi typami plików w procesie konwersji i tworzenia datasetów.