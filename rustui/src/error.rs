use std::fmt;
use std::error::Error as StdError;
use std::io;

// Główna struktura błędu dla aplikacji
#[derive(Debug)]
pub enum AppError {
    // Błędy IO (pliki, terminal)
    Io(io::Error),
    
    // Błędy API
    Api {
        kind: ApiErrorKind,
        message: String,
    },
    
    // Błędy konfiguracji
    Config(String),
    
    // Błędy przetwarzania plików
    Processing {
        file_id: Option<String>,
        kind: ProcessingErrorKind,
        message: String,
    },
    
    // Inne błędy (ogólne, zewnętrzne)
    Other(String),
}

// Rodzaje błędów API
#[derive(Debug, Clone)]
pub enum ApiErrorKind {
    Connection,      // Problemy z połączeniem
    Authentication,  // Problemy z autoryzacją
    NotFound,        // Zasób nie znaleziony
    BadRequest,      // Złe żądanie
    ServerError,     // Błąd serwera
    Parsing,         // Problemy z parsowaniem odpowiedzi
}

// Rodzaje błędów przetwarzania
#[derive(Debug, Clone)]
pub enum ProcessingErrorKind {
    UnsupportedFormat,   // Niewspierany format pliku
    FileTooBig,          // Za duży plik
    ProcessorError,      // Błąd w procesorze
    ModelError,          // Błąd modelu AI
    Timeout,             // Timeout operacji
}

// Implementacja konwersji z błędów IO
impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        AppError::Io(err)
    }
}

// Implementacja konwersji z anyhow::Error
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Other(err.to_string())
    }
}

// Implementacja Display dla ładnego formatowania błędów
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(err) => write!(f, "I/O error: {}", err),
            Self::Api { kind, message } => {
                let kind_str = match kind {
                    ApiErrorKind::Connection => "Connection",
                    ApiErrorKind::Authentication => "Authentication",
                    ApiErrorKind::NotFound => "Not Found",
                    ApiErrorKind::BadRequest => "Bad Request",
                    ApiErrorKind::ServerError => "Server Error",
                    ApiErrorKind::Parsing => "Parsing Error",
                };
                write!(f, "API error [{}]: {}", kind_str, message)
            },
            Self::Config(message) => write!(f, "Configuration error: {}", message),
            Self::Processing { file_id, kind, message } => {
                let kind_str = match kind {
                    ProcessingErrorKind::UnsupportedFormat => "Unsupported Format",
                    ProcessingErrorKind::FileTooBig => "File Too Big",
                    ProcessingErrorKind::ProcessorError => "Processor Error",
                    ProcessingErrorKind::ModelError => "Model Error",
                    ProcessingErrorKind::Timeout => "Timeout",
                };
                if let Some(id) = file_id {
                    write!(f, "Processing error [{}] for file {}: {}", kind_str, id, message)
                } else {
                    write!(f, "Processing error [{}]: {}", kind_str, message)
                }
            },
            Self::Other(message) => write!(f, "Error: {}", message),
        }
    }
}

// Implementacja Error traitu
impl StdError for AppError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            Self::Io(err) => Some(err),
            _ => None,
        }
    }
}

// Użyteczne makro do tworzenia błędów API
#[macro_export]
macro_rules! api_error {
    ($kind:expr, $($arg:tt)*) => {
        crate::error::AppError::Api {
            kind: $kind,
            message: format!($($arg)*),
        }
    };
}

// Użyteczne makro do tworzenia błędów przetwarzania
#[macro_export]
macro_rules! processing_error {
    ($kind:expr, $message:expr) => {
        crate::error::AppError::Processing {
            file_id: None,
            kind: $kind,
            message: $message.to_string(),
        }
    };
    ($kind:expr, $file_id:expr, $message:expr) => {
        crate::error::AppError::Processing {
            file_id: Some($file_id.to_string()),
            kind: $kind,
            message: $message.to_string(),
        }
    };
    ($kind:expr, $file_id:expr, $($arg:tt)*) => {
        crate::error::AppError::Processing {
            file_id: Some($file_id.to_string()),
            kind: $kind,
            message: format!($($arg)*),
        }
    };
}

// Alias dla Result z naszym własnym typem błędu
pub type Result<T> = std::result::Result<T, AppError>;