// Moduł testowy - główny plik ze strukturą testów
// W poniższym pliku znajdziemy tylko strukturę i pomocnicze narzędzia
// Właściwe testy znajdują się w podmodułach

// Import testów jednostkowych dla poszczególnych modułów
pub mod unit {
    pub mod api_tests;
    pub mod app_tests;
    pub mod processors_tests;
    pub mod config_tests;
}

// Import testów integracyjnych
pub mod integration {
    pub mod api_client_tests;
    pub mod processor_pipeline_tests;
}

// Pomocnicze narzędzia dla testów
pub mod test_utils {
    use std::sync::{Arc, Mutex};
    use super::*;
    
    // Mock dla API - do testowania bez rzeczywistego backendu
    pub struct MockApiClient {
        // Przechowaj ostatnie wywołania metod
        pub upload_calls: Arc<Mutex<Vec<String>>>,
        pub process_calls: Arc<Mutex<Vec<(String, crate::api::ProcessingConfig)>>>,
        pub get_status_calls: Arc<Mutex<Vec<String>>>,
        
        // Predefiniowane odpowiedzi
        pub upload_responses: Arc<Mutex<Vec<Result<String, String>>>>,
        pub process_responses: Arc<Mutex<Vec<Result<String, String>>>>,
        pub status_responses: Arc<Mutex<Vec<Result<crate::api::JobStatus, String>>>>,
    }
    
    impl MockApiClient {
        pub fn new() -> Self {
            Self {
                upload_calls: Arc::new(Mutex::new(Vec::new())),
                process_calls: Arc::new(Mutex::new(Vec::new())),
                get_status_calls: Arc::new(Mutex::new(Vec::new())),
                
                upload_responses: Arc::new(Mutex::new(Vec::new())),
                process_responses: Arc::new(Mutex::new(Vec::new())),
                status_responses: Arc::new(Mutex::new(Vec::new())),
            }
        }
        
        // Pomocnicze metody do dodawania predefiniowanych odpowiedzi
        pub fn add_upload_response(&self, response: Result<String, String>) {
            self.upload_responses.lock().unwrap().push(response);
        }
        
        pub fn add_process_response(&self, response: Result<String, String>) {
            self.process_responses.lock().unwrap().push(response);
        }
        
        pub fn add_status_response(&self, response: Result<crate::api::JobStatus, String>) {
            self.status_responses.lock().unwrap().push(response);
        }
    }
    
    // Generator testowych plików
    pub fn create_test_file(content: &str) -> std::path::PathBuf {
        use std::io::Write;
        
        let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = temp_dir.path().join("test_file.txt");
        
        let mut file = std::fs::File::create(&file_path).expect("Failed to create test file");
        file.write_all(content.as_bytes()).expect("Failed to write to test file");
        
        // Zwracamy ścieżkę do pliku - tempdir zostanie usunięty gdy wyjdzie z zakresu
        file_path
    }
    
    // Generator testowej konfiguracji
    pub fn create_test_config() -> crate::config::Config {
        crate::config::Config {
            backend_url: "http://test-server:8000".to_string(),
            default_provider: "test-provider".to_string(),
            default_model: "test-model".to_string(),
            default_language: "en".to_string(),
            default_processing_type: "standard".to_string(),
            downloads_directory: Some(std::path::PathBuf::from("/tmp")),
            max_upload_size_mb: 10,
        }
    }
}

// Konkretne implementacje testów jednostkowych
pub mod unit {
    // Testy dla modułu api.rs
    pub mod api_tests {
        use crate::api::{ProcessingConfig, JobStatus, ApiClient};
        use anyhow::Result;
        
        #[test]
        fn test_processing_config_serialization() -> Result<()> {
            // Utwórz przykładową konfigurację
            let config = ProcessingConfig {
                provider: "openai".to_string(),
                model: "gpt-4-turbo".to_string(),
                system_prompt: Some("Test prompt".to_string()),
                keywords: Some(vec!["test".to_string(), "keywords".to_string()]),
                temperature: Some(0.7),
                max_tokens: Some(1000),
                language: Some("en".to_string()),
                processing_type: "standard".to_string(),
                add_reasoning: Some(true),
                output_format: Some("json".to_string()),
            };
            
            // Serializuj do JSON
            let json = serde_json::to_string(&config)?;
            
            // Sprawdź czy zawiera oczekiwane pola
            assert!(json.contains("\"provider\":\"openai\""));
            assert!(json.contains("\"model\":\"gpt-4-turbo\""));
            assert!(json.contains("\"system_prompt\":\"Test prompt\""));
            assert!(json.contains("\"keywords\":[\"test\",\"keywords\"]"));
            assert!(json.contains("\"temperature\":0.7"));
            assert!(json.contains("\"max_tokens\":1000"));
            assert!(json.contains("\"language\":\"en\""));
            assert!(json.contains("\"processing_type\":\"standard\""));
            assert!(json.contains("\"add_reasoning\":true"));
            assert!(json.contains("\"output_format\":\"json\""));
            
            // Deserializuj z powrotem
            let deserialized: ProcessingConfig = serde_json::from_str(&json)?;
            
            // Sprawdź czy wartości się zgadzają
            assert_eq!(deserialized.provider, "openai");
            assert_eq!(deserialized.model, "gpt-4-turbo");
            assert_eq!(deserialized.system_prompt, Some("Test prompt".to_string()));
            assert_eq!(deserialized.keywords, Some(vec!["test".to_string(), "keywords".to_string()]));
            assert_eq!(deserialized.temperature, Some(0.7));
            assert_eq!(deserialized.max_tokens, Some(1000));
            assert_eq!(deserialized.language, Some("en".to_string()));
            assert_eq!(deserialized.processing_type, "standard");
            assert_eq!(deserialized.add_reasoning, Some(true));
            assert_eq!(deserialized.output_format, Some("json".to_string()));
            
            Ok(())
        }
        
        #[test]
        fn test_job_status_serialization() -> Result<()> {
            // Utwórz przykładowy status zadania
            let status = JobStatus {
                job_id: "test-123".to_string(),
                status: "processing".to_string(),
                current: Some(5),
                total: Some(10),
                error: None,
            };
            
            // Serializuj do JSON
            let json = serde_json::to_string(&status)?;
            
            // Sprawdź czy zawiera oczekiwane pola
            assert!(json.contains("\"job_id\":\"test-123\""));
            assert!(json.contains("\"status\":\"processing\""));
            assert!(json.contains("\"current\":5"));
            assert!(json.contains("\"total\":10"));
            assert!(!json.contains("\"error\""));
            
            // Deserializuj z powrotem
            let deserialized: JobStatus = serde_json::from_str(&json)?;
            
            // Sprawdź czy wartości się zgadzają
            assert_eq!(deserialized.job_id, "test-123");
            assert_eq!(deserialized.status, "processing");
            assert_eq!(deserialized.current, Some(5));
            assert_eq!(deserialized.total, Some(10));
            assert_eq!(deserialized.error, None);
            
            Ok(())
        }
    }
    
    // Testy dla modułu app.rs
    pub mod app_tests {
        use crate::app::{App, AppState, ProcessingType};
        use crossterm::event::{KeyCode, KeyEvent, KeyModifiers, KeyEventKind, KeyEventState};

        #[test]
        fn test_app_new() {
            let app = App::new("http://test:8000");
            
            // Sprawdź domyślne wartości
            assert_eq!(app.state, AppState::Main);
            assert_eq!(app.backend_url, "http://test:8000");
            assert!(app.uploaded_files.is_empty());
            assert_eq!(app.selected_file_index, None);
            assert_eq!(app.processing_type, ProcessingType::Standard);
            assert_eq!(app.language, "en");
            assert_eq!(app.job_id_input.value(), "");
            assert_eq!(app.current_job_id, None);
            assert_eq!(app.job_progress, None);
            assert_eq!(app.job_status, None);
        }
        
        #[test]
        fn test_processing_type_to_str() {
            assert_eq!(ProcessingType::Standard.to_str(), "standard");
            assert_eq!(ProcessingType::Article.to_str(), "article");
            assert_eq!(ProcessingType::Translate.to_str(), "translate");
            assert_eq!(ProcessingType::Batch.to_str(), "batch");
        }
        
        #[test]
        fn test_processing_type_all() {
            let types = ProcessingType::all();
            assert_eq!(types.len(), 4);
            assert!(types.contains(&ProcessingType::Standard));
            assert!(types.contains(&ProcessingType::Article));
            assert!(types.contains(&ProcessingType::Translate));
            assert!(types.contains(&ProcessingType::Batch));
        }
        
        #[test]
        fn test_app_get_current_provider() {
            let mut app = App::new("http://test:8000");
            assert_eq!(app.get_current_provider(), Some("openai"));
            
            app.selected_provider_index = Some(1);
            assert_eq!(app.get_current_provider(), Some("anthropic"));
            
            app.selected_provider_index = None;
            assert_eq!(app.get_current_provider(), None);
        }
        
        #[test]
        fn test_handle_upload_input() {
            let mut app = App::new("http://test:8000");
            assert!(app.uploaded_files.is_empty());
            
            // Symuluj naciśnięcie 'f' w ekranie przesyłania plików
            let key_event = KeyEvent::new(KeyCode::Char('f'), KeyModifiers::NONE, KeyEventKind::Press, KeyEventState::NONE);
            app.handle_upload_input(key_event);
            
            // Sprawdź czy plik został dodany
            assert_eq!(app.uploaded_files.len(), 1);
            assert!(app.message.is_some());
            assert_eq!(app.message.as_ref().unwrap(), "File uploaded successfully");
        }
    }
    
    // Testy dla modułu processors.rs
    pub mod processors_tests {
        use crate::processors::{get_processor, Processor, ProcessorConfig, StandardProcessor, ArticleProcessor, TranslateProcessor, BatchProcessor};
        
        #[test]
        fn test_get_processor() -> anyhow::Result<()> {
            // Sprawdź czy zwracany jest odpowiedni typ procesora
            let standard = get_processor("standard")?;
            assert_eq!(standard.name(), "standard");
            
            let article = get_processor("article")?;
            assert_eq!(article.name(), "article");
            
            let translate = get_processor("translate")?;
            assert_eq!(translate.name(), "translate");
            
            let batch = get_processor("batch")?;
            assert_eq!(batch.name(), "batch");
            
            // Sprawdź czy błąd dla nieznanego typu
            let result = get_processor("unknown");
            assert!(result.is_err());
            
            Ok(())
        }
        
        #[test]
        fn test_standard_processor() -> anyhow::Result<()> {
            let processor = StandardProcessor;
            
            let config = ProcessorConfig {
                model: "test-model".to_string(),
                provider: "test-provider".to_string(),
                language: "en".to_string(),
                system_prompt: Some("Test prompt".to_string()),
                keywords: vec![],
                add_reasoning: false,
                output_format: "json".to_string(),
            };
            
            let result = processor.process_file("test.txt", &config)?;
            
            // Sprawdź czy wynik zawiera oczekiwane wartości
            assert_eq!(result.source_file, "test.txt");
            assert_eq!(result.processing_type, "standard");
            assert_eq!(result.records.len(), 1);
            
            let record = &result.records[0];
            assert_eq!(record.instruction, "Analyze the document");
            
            Ok(())
        }
    }
    
    // Testy dla modułu config.rs
    pub mod config_tests {
        use crate::config::Config;
        use std::path::PathBuf;
        
        #[test]
        fn test_config_default() {
            let config = Config::default();
            
            assert_eq!(config.backend_url, "http://localhost:8000");
            assert_eq!(config.default_provider, "openai");
            assert_eq!(config.default_model, "gpt-4-turbo");
            assert_eq!(config.default_language, "en");
            assert_eq!(config.default_processing_type, "standard");
            assert_eq!(config.max_upload_size_mb, 100);
        }
        
        #[test]
        fn test_config_serialization() -> anyhow::Result<()> {
            let config = Config {
                backend_url: "http://test:8000".to_string(),
                default_provider: "test-provider".to_string(),
                default_model: "test-model".to_string(),
                default_language: "pl".to_string(),
                default_processing_type: "article".to_string(),
                downloads_directory: Some(PathBuf::from("/test/dir")),
                max_upload_size_mb: 50,
            };
            
            let toml = toml::to_string(&config)?;
            
            // Sprawdź czy zawiera oczekiwane pola
            assert!(toml.contains("backend_url = \"http://test:8000\""));
            assert!(toml.contains("default_provider = \"test-provider\""));
            assert!(toml.contains("default_model = \"test-model\""));
            assert!(toml.contains("default_language = \"pl\""));
            assert!(toml.contains("default_processing_type = \"article\""));
            assert!(toml.contains("downloads_directory = \"/test/dir\""));
            assert!(toml.contains("max_upload_size_mb = 50"));
            
            // Deserializuj z powrotem
            let deserialized: Config = toml::from_str(&toml)?;
            
            // Sprawdź czy wartości się zgadzają
            assert_eq!(deserialized.backend_url, "http://test:8000");
            assert_eq!(deserialized.default_provider, "test-provider");
            assert_eq!(deserialized.default_model, "test-model");
            assert_eq!(deserialized.default_language, "pl");
            assert_eq!(deserialized.default_processing_type, "article");
            assert_eq!(deserialized.downloads_directory, Some(PathBuf::from("/test/dir")));
            assert_eq!(deserialized.max_upload_size_mb, 50);
            
            Ok(())
        }
    }
}

// Implementacje testów integracyjnych
pub mod integration {
    // Testy integracyjne dla API klienta
    pub mod api_client_tests {
        use crate::api::{ApiClient, ProcessingConfig, JobStatus};
        use std::path::Path;
        use mockito::mock;
        
        #[tokio::test]
        async fn test_get_job_status() -> anyhow::Result<()> {
            // Utwórz mockito server do symulacji API
            let mut server = mockito::Server::new();
            
            // Przykładowa odpowiedź JSON
            let response_body = r#"
                {
                    "job_id": "test-123",
                    "status": "completed",
                    "current": 10,
                    "total": 10,
                    "error": null
                }
            "#;
            
            // Skonfiguruj mock dla endpointu job status
            let _m = server.mock("GET", "/api/jobs/test-123")
                .with_status(200)
                .with_header("content-type", "application/json")
                .with_body(response_body)
                .create();
            
            // Utwórz klienta API z adresem mockito
            let client = ApiClient::new(&server.url());
            
            // Wywołaj testowaną metodę
            let status = client.get_job_status("test-123").await?;
            
            // Sprawdź czy odpowiedź została poprawnie sparsowana
            assert_eq!(status.job_id, "test-123");
            assert_eq!(status.status, "completed");
            assert_eq!(status.current, Some(10));
            assert_eq!(status.total, Some(10));
            assert_eq!(status.error, None);
            
            Ok(())
        }
        
        #[tokio::test]
        async fn test_get_job_status_error() -> anyhow::Result<()> {
            // Utwórz mockito server do symulacji API
            let mut server = mockito::Server::new();
            
            // Skonfiguruj mock dla endpointu job status zwracający błąd
            let _m = server.mock("GET", "/api/jobs/nonexistent")
                .with_status(404)
                .with_body("Job not found")
                .create();
            
            // Utwórz klienta API z adresem mockito
            let client = ApiClient::new(&server.url());
            
            // Wywołaj testowaną metodę i sprawdź czy zwraca błąd
            let result = client.get_job_status("nonexistent").await;
            assert!(result.is_err());
            
            Ok(())
        }
    }
    
    // Testy integracyjne dla pipeline'u procesorów
    pub mod processor_pipeline_tests {
        use crate::processors::{get_processor, ProcessorConfig};
        use std::path::Path;
        use tempfile::tempdir;
        use std::io::Write;
        
        #[test]
        fn test_processor_pipeline() -> anyhow::Result<()> {
            // Utwórz tymczasowy katalog i plik testowy
            let dir = tempdir()?;
            let file_path = dir.path().join("test_document.txt");
            
            // Zapisz przykładową zawartość
            let mut file = std::fs::File::create(&file_path)?;
            writeln!(file, "This is a test document.\nIt has multiple lines.\nFor testing purposes.")?;
            
            // Utwórz konfigurację
            let config = ProcessorConfig {
                model: "test-model".to_string(),
                provider: "test-provider".to_string(),
                language: "en".to_string(),
                system_prompt: Some("Analyze this document".to_string()),
                keywords: vec!["test".to_string()],
                add_reasoning: false,
                output_format: "json".to_string(),
            };
            
            // Przetestuj różne procesory
            for processor_type in ["standard", "article", "translate"] {
                let processor = get_processor(processor_type)?;
                let result = processor.process_file(file_path.to_str().unwrap(), &config)?;
                
                // Podstawowe sprawdzenie wyników
                assert_eq!(result.source_file, file_path.to_str().unwrap());
                assert_eq!(result.processing_type, processor_type);
                assert!(!result.records.is_empty());
            }
            
            Ok(())
        }
    }
}