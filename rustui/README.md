# AnyDataset TUI

![License](https://img.shields.io/badge/license-Proprietary-blue)
![Rust](https://img.shields.io/badge/rust-1.75%2B-orange)
[![CI Status](https://github.com/Szowesgad/AnyDataNext/actions/workflows/rust.yml/badge.svg)](https://github.com/Szowesgad/AnyDataNext/actions/workflows/rust.yml)
[![codecov](https://codecov.io/gh/Szowesgad/AnyDataNext/branch/main/graph/badge.svg?token=XXXXXXXXXX)](https://codecov.io/gh/Szowesgad/AnyDataNext)

Terminal User Interface (TUI) klient dla AnyDataNext, napisany w Rust przy użyciu biblioteki [ratatui](https://github.com/ratatui/ratatui).

<p align="center">
  <img src="docs/images/screenshot.png" alt="AnyDataset TUI Screenshot" width="800">
</p>

## 🔥 Dlaczego TUI?

AnyDataset TUI to klient terminalowy zaprojektowany dla:
- Szybki dostęp do funkcji AnyDataNext
- Lekki interfejs bez przeglądarki
- Obsługa wszystkich operacji AnyDataNext w terminalu
- Używanie przez SSH/remote sessions bez interfejsu graficznego
- Wyższej wydajności na słabszym sprzęcie

## 🚀 Funkcje

- **Zarządzanie Plikami**: Przesyłanie, wybór i organizacja plików do przetwarzania
- **Wsparcie Wszystkich Trybów**: STANDARD, ARTICLE, TRANSLATE i BATCH
- **Monitorowanie Zadań**: Śledzenie postępu i statusu zadań w czasie rzeczywistym
- **Zaawansowana Diagnostyka**: Rozbudowane logowanie i crashlogi
- **Pełna Integracja API**: Wsparcie wszystkich funkcji AnyDataNext API
- **Lekki i Szybki**: Optymalny dla maszyn o niższej specyfikacji

## 📋 Wymagania

- **Rust i Cargo**: Version 1.75+ (stable)
- **Terminal**: Obsługa kolorów ANSI (większość nowoczesnych terminali)
- **Połączenie**: Z backendem AnyDataNext (lokalnie lub zdalnie)
- **Uprawnienia**: Dostęp do plików i systemu plików

## 🔧 Instalacja

### Z Source

```bash
# Klonowanie repozytorium
git clone https://github.com/Szowesgad/AnyDataNext.git
cd AnyDataNext/rustui

# Zbuduj aplikację w trybie release
cargo build --release

# Uruchom aplikację
cargo run --release

# Możesz też zainstalować do ~/.cargo/bin/
cargo install --path .
```

### Prebuilt Releases

Pobierz najnowszą wersję z [Releases](https://github.com/Szowesgad/AnyDataNext/releases) i dodaj plik wykonywalny do swojej ścieżki.

## 🛠 Konfiguracja

Aplikacja używa pliku konfiguracyjnego TOML, który znajduje się w:
- **Linux/macOS**: `~/.config/anydataset-tui/config.toml`
- **Windows**: `C:\Users\<USER>\AppData\Roaming\anydataset-tui\config.toml`

Przy pierwszym uruchomieniu zostanie utworzony domyślny plik konfiguracyjny.

### Przykładowa konfiguracja

```toml
# Config.toml
backend_url = "http://localhost:8000"
default_provider = "openai"
default_model = "gpt-4-turbo"
default_language = "pl"
default_processing_type = "standard"
downloads_directory = "/path/to/downloads"
max_upload_size_mb = 100
```

## 🖥️ Użycie

### Nawigacja

| Klawisz | Akcja |
|---------|-------|
| `u` | Ekran przesyłania plików |
| `p` | Ekran przetwarzania |
| `s` | Ustawienia aplikacji |
| `j` | Sprawdzanie statusu zadań |
| `q` | Wyjście z aplikacji |
| `Esc` | Powrót do głównego ekranu |

### Zarządzanie Plikami

| Klawisz | Akcja |
|---------|-------|
| `f` | Wybór i przesłanie pliku |
| `↑/↓` | Nawigacja po liście plików |
| `Enter` | Wybór pliku |
| `d` | Usuń plik z listy |

### Przetwarzanie

| Klawisz | Akcja |
|---------|-------|
| `1-4` | Wybór typu przetwarzania (STANDARD, ARTICLE, TRANSLATE, BATCH) |
| `p` | Uruchomienie przetwarzania |
| `c` | Anulowanie aktywnego zadania |

### Ustawienia

| Klawisz | Akcja |
|---------|-------|
| `l` | Zmiana języka (pl/en) |
| `p` | Zmiana dostawcy AI |
| `m` | Zmiana modelu AI |
| `Tab` | Nawigacja między sekcjami |

## 🧪 Testy i Development

### Uruchamianie testów

```bash
# Testy jednostkowe
cargo test --lib

# Testy integracyjne 
cargo test --test integration

# Wszystkie testy z pokryciem
cargo tarpaulin
```

### Struktura projektu

```
rustui/
├── .github/             # Konfiguracja CI/CD
├── src/
│   ├── api.rs           # Klient API do backendu
│   ├── app.rs           # Stan aplikacji i logika
│   ├── config.rs        # Zarządzanie konfiguracją
│   ├── error.rs         # Obsługa błędów i wyjątków
│   ├── logger.rs        # System logowania
│   ├── main.rs          # Punkt wejściowy aplikacji
│   ├── processors.rs    # Procesory różnych typów danych
│   ├── tests.rs         # Testy jednostkowe i integracyjne
│   └── ui.rs            # Renderowanie UI
└── Cargo.toml           # Manifest Cargo
```

## 🛠️ Rozwijanie projektu

### Dodawanie nowych widoków

1. Dodaj nowy stan w `AppState` w pliku `app.rs`
2. Dodaj obsługę wejścia w `run_app` w pliku `main.rs`
3. Zaimplementuj funkcję rysującą w pliku `ui.rs`

```rust
// Dodawanie nowego stanu
pub enum AppState {
    Main,
    Upload,
    Process,
    Settings,
    JobStatus,
    YourNewState,  // Nowy stan
}

// Dodawanie obsługi wejścia
match app.state {
    AppState::YourNewState => match key.code {
        KeyCode::Esc => app.state = AppState::Main,
        _ => app.handle_new_state_input(key),
    },
}

// Implementacja funkcji rysującej
fn draw_your_new_state(f: &mut Frame, app: &App, area: Rect) {
    // Implementacja rysowania
}
```

### Dodawanie nowych procesorów

1. Dodaj nowy typ w `ProcessingType` w pliku `app.rs`
2. Zaimplementuj `Processor` trait w pliku `processors.rs`
3. Zaktualizuj funkcję `get_processor`

```rust
// Dodawanie nowego typu procesora
pub enum ProcessingType {
    Standard,
    Article,
    Translate,
    Batch,
    YourNewType,  // Nowy typ
}

// Implementacja procesora
pub struct YourNewProcessor;

impl Processor for YourNewProcessor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult> {
        // Implementacja
    }
    
    fn name(&self) -> &'static str {
        "your_new_type"
    }
    
    fn description(&self) -> &'static str {
        "Your new processor description"
    }
}

// Aktualizacja factory
pub fn get_processor(processing_type: &str) -> anyhow::Result<Box<dyn Processor>> {
    match processing_type {
        // Istniejące
        "your_new_type" => Ok(Box::new(YourNewProcessor)),
        _ => anyhow::bail!("Unknown processing type: {}", processing_type),
    }
}
```

## 📊 Logowanie i debugging

### Poziomy logów

- **DEBUG**: Szczegółowe informacje dla deweloperów
- **INFO**: Ogólne informacje o operacjach
- **WARN**: Ostrzeżenia, które nie przerywają działania
- **ERROR**: Błędy, które mogą wpłynąć na działanie
- **FATAL**: Krytyczne błędy zatrzymujące aplikację

### Lokalizacje logów

- **Terminal**: Domyślnie poziom INFO i wyżej
- **Pliki logów**: `~/.config/anydataset-tui/logs/`
- **Crashlogi**: `~/.cache/anydataset-tui/crash_*.log`

## 📝 Licencja

(c)2025 by M&K

---

Stworzono z ❤️ przy użyciu [ratatui](https://github.com/ratatui/ratatui) i [Rust](https://www.rust-lang.org/).