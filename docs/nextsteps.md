# AnyDataset - Wizja rozwoju

## Podsumowanie kluczowych funkcjonalności i przyszłych kierunków

### 1. Nowy interfejs Process File [x]

- **Etapowe przetwarzanie**: [x]
  - [x] Upload i automatyczne rozpoznanie formatu pliku
  - [x] Automatyczne generowanie słów kluczowych z możliwością edycji
  - [x] Konfiguracja opcji przetwarzania i wybór formatu docelowego

- **System Prompt**: [x]
  - [x] Pole tekstowe dla kontekstu zadania (np. "Segregujesz stare artykuły weterynaryjne...")
  - [x] Dostosowanie instrukcji do konkretnego zadania bez ingerencji w kod

- **Opcje modelu**: [x]
  - [x] Temperature (0.0-1.0)
  - [x] Max tokens 
  - [ ] Top-p sampling (priorytet niski)
  - [ ] Frequency penalty (priorytet niski)

- **Zaawansowane opcje**: [x]
  - [x] Reasoning - włączenie/wyłączenie śladu rozumowania
  - [x] Anonymization - anonimizacja danych wrażliwych
  - [x] Token limit per chunk - kontrola długości fragmentów
  - [x] Chunk overlap - nakładanie się fragmentów tekstu

### 2. Ulepszony Batch Processing [x]

- **Pełna automatyzacja**: [x]
  - [x] Automatyczne przetwarzanie wielu plików bez potrzeby ręcznej edycji
  - [x] Brak etapu edycji słów kluczowych - wszystko dzieje się automatycznie
  - [x] Strategia "YoLo" - uruchom i zapomnij (domyślna)
  - [x] Strategia "Paranoid" - podgląd co X plików (opcjonalna)

- **Multi-model Processing**: [x]
  - [x] Równoległe wykorzystanie kilku modeli (checkbox)
  - [x] Strategie dystrybucji plików między modele:
    - [x] Round Robin
    - [x] File Size Based
    - [x] File Type Based
    - [x] Cost Optimization

- **Kontrola przetwarzania**: [x]
  - [x] Elastyczna konfiguracja maksymalnej liczby równoległych zadań
  - [x] Szacowanie kosztów i ograniczenia budżetowe
  - [x] Podgląd postępu z szacowanym czasem ukończenia
  - [x] Śledzenie postępu w czasie rzeczywistym przez WebSockety
  - [x] Szczegółowe raportowanie statusu dla każdego pliku
  - [ ] Możliwość wstrzymania/wznowienia procesu (częściowo zaimplementowane w trybie Paranoid)
  
- **Obsługa języków**: [x]
  - [x] Wybór języka wejściowego (w tym auto-detekcja)
  - [x] Wybór języka wyjściowego
  - [x] Domyślna konfiguracja dla języka polskiego
  - [x] Automatyczne tłumaczenie między językami
  - [x] Integracja z istniejącym skryptem translate.py
  - [x] Zachowanie terminologii dziedzinowej podczas tłumaczenia

### 3. Format pośredni JSON i nowe metody przetwarzania [x]

Format pośredni JSON został zaimplementowany i jest używany jako standardowy format dla wszystkich etapów przetwarzania. Format ten został zaprojektowany tak, aby mógł być łatwo rozszerzany o nowe funkcjonalności w przyszłości.

- **Standaryzacja formatu danych**: [x]
  - [x] Spójny format JSON dla wszystkich etapów przetwarzania
  - [x] Rozszerzone metadane dla każdego rekordu
  - [x] Automatyczne uzupełnianie brakujących pól

- **Inteligentne przetwarzanie tekstu**: [x]
  - [x] Adaptacyjne dzielenie dokumentów na fragmenty
  - [x] Specjalne traktowanie krótkich dokumentów jako całości
  - [x] Zachowanie pełnego kontekstu i powiązań między informacjami
  - [x] Grupowanie powiązanych treściowo informacji w spójne rekordy

- **Ulepszone prompty systemowe**: [x]
  - [x] Kontekstowe rozumienie całości dokumentu przed podziałem
  - [x] Analiza złożoności dokumentu do określenia optymalnej liczby rekordów
  - [x] Szczegółowe instrukcje zachowania integralności informacji
  - [x] Dedykowane prompty dla języka polskiego i angielskiego

```json
{
  "instruction": "PODSUMOWANY konkretny fragment/kontekst z dokumentu, zawierający dokładną terminologię, na podstawie której zbudowano pole 'prompt'",
  "prompt": "Pytanie o pojęcia, definicje lub metody z dokumentu",
  "completion": "Wyczerpująca odpowiedź uwzględniająca pełny kontekst",
  "metadata": {
    "source_file": "plik_źródłowy.pdf",
    "chunk_index": 3,
    "total_chunks": 12,
    "model_used": "claude-3-7-20250219",
    "processing_time": "1.23s",
    "confidence_score": 0.94,
    "keywords": ["hemodializa", "ultrafiltracja", "dyfuzja", "weterynaria"], # przykład
    "extracted_entities": ["hemodializa", "dializator", "osocze"] # przykład
  }
}
```

### 4. Infrastruktura komunikacji w czasie rzeczywistym [x]

- **System WebSocketów**: [x]
  - [x] Klasa ConnectionManager do zarządzania połączeniami
  - [x] Kanały komunikacji dla poszczególnych klientów
  - [x] Funkcja broadcast do powiadamiania wszystkich klientów

- **Śledzenie postępu przetwarzania**: [x]
  - [x] Progress bar z procentowym wskaźnikiem ukończenia
  - [x] Dynamiczna aktualizacja statusu przetwarzania poszczególnych plików
  - [x] Komunikaty o ukończeniu lub błędach przetwarzania
  - [x] Interaktywne odświeżanie interfejsu

### 5. Nowa zakładka "Prepare Training Data" [ ]

- **Źródło danych**:
  - Wybór wcześniej przetworzonych batchów
  - Łączenie wielu batchów w jeden zestaw treningowy

- **Formaty wyjściowe**:
  - JSONL (standardowy)
  - Hugging Face Dataset
  - TFRecord (TensorFlow)
  - CSV/TSV
  - Parquet

- **Transformacje danych**:
  - Filtrowanie przykładów o niskiej jakości
  - Deduplikacja
  - Augmentacja danych
  - Balansowanie różnych kategorii

- **Podział danych**:
  - Train/Validation/Test split (konfigurowalne proporcje)
  - Stratyfikacja podziału
  - Cross-validation

- **Raportowanie i analiza**:
  - Statystyki zestawu
  - Wizualizacje rozkładów
  - Raport potencjalnych problemów

### 6. Rozszerzenie o multimodalność (podejście hybrydowe) [ ]

- **W pierwszej fazie - integracja z AnyDataset**:
  - Podstawowe przetwarzanie obrazów i audio
  - Rozszerzony format JSON obsługujący wielomodalność
  - Nowa zakładka "Multimedia" dla uploadów obrazów i audio

- **Funkcje dla obrazów (VLM)**:
  - Automatyczne tagowanie i opis
  - Detekcja obiektów i segmentacja
  - Ekstrakcja regionów zainteresowania

- **Funkcje dla audio/głosu**:
  - Automatyczna transkrypcja
  - Ekstrakcja parametrów dźwięku
  - Normalizacja i poprawa jakości
  - **[NOWY PLAN] Szczegółowy Pipeline Przygotowania Datasetu Audio-Tekst:**
    - **Cel:** Wysokiej jakości, zsynchronizowane datasety dla modeli głosowych.
    - **Input:** Plik audio/video.
    - **Endpoint:** Planowany `POST /api/process-audio-dataset`.
    - **Logika (planowany `utils/multimedia_processor.py`):**
      1. **Ekstrakcja Audio:** `ffmpeg`.
      2. **Transkrypcja + Word-Timestamps:** `Whisper V3 Large MLX/Lightning`.
      3. **Segmentacja Semantyczna:** Analiza tekstu/pauz.
      4. **Cięcie Audio Chunks:** `ffmpeg` na podstawie precyzyjnych timestampów.
      5. **Generowanie Metadanych JSON:** `text`, `start_time`, `end_time`, `audio_chunk_path`, `source_file`, etc.
      6. **Pakowanie Wyników:** ZIP z plikami `.wav` i `.json`.
      7. **Pobieranie:** Przez `/api/results/{job_id}`.

- **Architektura modułowa**:
  - Możliwość wydzielenia specjalistycznych narzędzi w przyszłości
  - Standardowy format danych dla komunikacji między modułami

## Kolejne kroki implementacyjne

1. **Faza 1** - Ulepszenie interfejsu Process File: [x]
   - [x] Wdrożenie nowego interfejsu trójstopniowego
   - [x] Dodanie opcji reasoningu i dynamicznej konfiguracji modelu
   - [x] Integracja z automatycznym generowaniem słów kluczowych

2. **Faza 2** - Modernizacja Batch Processing: [x]
   - [x] Implementacja "YoLo" i "Paranoid" strategii
   - [x] Dodanie wielomodelowego przetwarzania
   - [x] Rozbudowa funkcji kontroli kosztów i zasobów
   - [x] Dodanie obsługi wielu języków i tłumaczenia
   - [x] Implementacja strategii alokacji zadań (round-robin, file-size, file-type)
   - [x] Dodanie kontroli parametrów modelu (temperature, max_tokens)
   - [x] Wizualizacja szacowanego czasu i kosztu operacji

3. **Faza 2.5** - Poprawki i udoskonalenia: [x]
   - [x] Naprawa funkcjonalności drag and drop do przesyłania plików
   - [x] Uproszczenie interfejsu głównego (usunięcie nieużywanych funkcji)
   - [x] Rozwiązanie problemu zawieszonych zadań w "Existing Datasets"
   - [x] Naprawa błędu w API Anthropic podczas ekstrakcji słów kluczowych
   - [x] Dodanie mechanizmu awaryjnego generowania słów kluczowych
   - [x] Konfiguracja dostępu przez sieć ZeroTier dla pracy zespołowej

4. **Faza 2.6** - Udoskonalenia promptów i przetwarzania: [x]
   - [x] Nowe prompty systemowe z adaptacyjnym podziałem dokumentów
   - [x] Specjalne traktowanie krótkich dokumentów jako niepodzielnych jednostek
   - [x] Dodanie mechanizmu zachowania pełnego kontekstu w instrukcjach
   - [x] Wprowadzenie dedykowanych promptów dla języka polskiego
   - [x] Implementacja systemu powiadamiania przez WebSockety
   - [x] Wizualizacja postępu przetwarzania w czasie rzeczywistym

5. **Faza 3** - Zakładka Prepare Training Data: [ ]
   - [ ] Implementacja przygotowania danych treningowych z makiety do pełnej funkcjonalności
   - [ ] Dodanie transformacji i walidacji danych
   - [ ] Generowanie i optymalizacja JSON/JSONL zgodnie z formatem pośrednim
   - [ ] Raportowanie i wizualizacje
   - [ ] Filtrowanie przykładów o niskiej jakości
   - [ ] Deduplikacja i augmentacja danych

6. **Faza 4** - Podstawowe wsparcie dla multimodalności: [ ]
   - [ ] Rozszerzenie formatu JSON o obsługę audio
   - [ ] Podstawowe przetwarzanie plików audio
   - [ ] Zakładka "Multimedia" z obsługą plików audio
   - [ ] Automatyczna transkrypcja i przetwarzanie audio (Placeholder)
   - [ ] Integracja z modelami AI do analizy audio (Placeholder)
   - **[TODO] Implementacja Szczegółowego Pipeline Przygotowania Datasetu Audio-Tekst** (zgodnie z planem w sekcji 6)

## Priorytety na najbliższy sprint rozwojowy

1. Rozwinięcie interfejsu śledzenia postępu o dodatkowe metryki wydajności
2. Optymalizacja przetwarzania specjalistycznych tekstów dziedzinowych
3. Rozbudowa funkcji dynamicznego wykrywania języka
4. Dodanie funkcji eksportu bezpośrednio do popularnych formatów treningowych
5. Testy wydajnościowe i optymalizacja dla bardzo dużych zbiorów danych

## Wizja długoterminowa

W dłuższej perspektywie AnyDataset może ewoluować w kierunku kompleksowej platformy przygotowania danych dla AI, obsługującej wszystkie modalności, z zaawansowanymi funkcjami walidacji jakości, augmentacji i wizualizacji. System modułowy pozwoli na elastyczne dostosowanie do różnych przypadków użycia, zachowując jednocześnie spójne doświadczenie użytkownika.

Priorytetem jest utrzymanie prostoty i intuicyjności interfejsu, przy jednoczesnym zapewnieniu zaawansowanych funkcji dla doświadczonych użytkowników.