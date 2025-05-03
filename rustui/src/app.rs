use crossterm::event::{KeyCode, KeyEvent};
use std::collections::HashMap;
use tui_input::Input;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppState {
    Main,
    Upload,
    Process,
    Settings,
    JobStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessingType {
    Standard,
    Article,
    Translate,
    Batch,
}

impl ProcessingType {
    pub fn to_str(&self) -> &'static str {
        match self {
            ProcessingType::Standard => "standard",
            ProcessingType::Article => "article",
            ProcessingType::Translate => "translate",
            ProcessingType::Batch => "batch",
        }
    }
    
    pub fn all() -> Vec<ProcessingType> {
        vec![
            ProcessingType::Standard,
            ProcessingType::Article, 
            ProcessingType::Translate,
            ProcessingType::Batch
        ]
    }
}

pub struct App {
    pub state: AppState,
    pub backend_url: String,
    pub uploaded_files: Vec<String>,
    pub selected_file_index: Option<usize>,
    pub processing_type: ProcessingType,
    pub language: String,
    pub job_id_input: Input,
    pub current_job_id: Option<String>,
    pub job_progress: Option<(u64, u64)>, // (current, total)
    pub job_status: Option<String>,
    pub providers: Vec<String>,
    pub selected_provider_index: Option<usize>,
    pub models: HashMap<String, Vec<String>>,
    pub selected_model_index: Option<usize>,
    pub keywords: Vec<String>,
    pub system_prompt: String,
    pub message: Option<String>,
    pub debug_info: Vec<String>,
}

impl App {
    pub fn new(backend_url: &str) -> Self {
        Self {
            state: AppState::Main,
            backend_url: backend_url.to_string(),
            uploaded_files: Vec::new(),
            selected_file_index: None,
            processing_type: ProcessingType::Standard,
            language: "en".to_string(),
            job_id_input: Input::default(),
            current_job_id: None,
            job_progress: None,
            job_status: None,
            providers: vec!["openai".to_string(), "anthropic".to_string()],
            selected_provider_index: Some(0),
            models: HashMap::from([
                ("openai".to_string(), vec!["gpt-4-turbo".to_string(), "gpt-3.5-turbo".to_string()]),
                ("anthropic".to_string(), vec!["claude-3-opus".to_string(), "claude-3-sonnet".to_string()])
            ]),
            selected_model_index: Some(0),
            keywords: Vec::new(),
            system_prompt: String::new(),
            message: None,
            debug_info: Vec::new(),
        }
    }

    pub fn on_tick(&mut self) {
        // Update job status if there's a current job
        if let Some(job_id) = &self.current_job_id {
            // In a real app, this would make an API call to get job status
            self.debug_info.push(format!("Checking job status for {}", job_id));
        }
    }

    pub fn handle_upload_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('f') => {
                // Simulate file upload
                self.uploaded_files.push(format!("file_{}.pdf", self.uploaded_files.len() + 1));
                self.message = Some("File uploaded successfully".to_string());
            },
            _ => {},
        }
    }

    pub fn handle_process_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('1') => self.processing_type = ProcessingType::Standard,
            KeyCode::Char('2') => self.processing_type = ProcessingType::Article,
            KeyCode::Char('3') => self.processing_type = ProcessingType::Translate,
            KeyCode::Char('4') => self.processing_type = ProcessingType::Batch,
            KeyCode::Char('p') if !self.uploaded_files.is_empty() => {
                if let Some(index) = self.selected_file_index {
                    let file = &self.uploaded_files[index];
                    // Simulate job submission
                    self.current_job_id = Some(format!("job_{}", uuid::Uuid::new_v4()));
                    self.job_progress = Some((0, 100));
                    self.job_status = Some("processing".to_string());
                    self.message = Some(format!("Processing {} with {} type", file, self.processing_type.to_str()));
                } else {
                    self.message = Some("No file selected".to_string());
                }
            },
            KeyCode::Down => {
                if !self.uploaded_files.is_empty() {
                    let new_index = match self.selected_file_index {
                        Some(i) if i < self.uploaded_files.len() - 1 => Some(i + 1),
                        Some(_) => Some(0),
                        None => Some(0),
                    };
                    self.selected_file_index = new_index;
                }
            },
            KeyCode::Up => {
                if !self.uploaded_files.is_empty() {
                    let new_index = match self.selected_file_index {
                        Some(i) if i > 0 => Some(i - 1),
                        Some(_) => Some(self.uploaded_files.len() - 1),
                        None => Some(0),
                    };
                    self.selected_file_index = new_index;
                }
            },
            _ => {},
        }
    }

    pub fn handle_settings_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char('l') => {
                self.language = if self.language == "en" { "pl".to_string() } else { "en".to_string() };
                self.message = Some(format!("Language changed to {}", self.language));
            },
            KeyCode::Char('p') => {
                if !self.providers.is_empty() {
                    let new_index = match self.selected_provider_index {
                        Some(i) if i < self.providers.len() - 1 => Some(i + 1),
                        Some(_) => Some(0),
                        None => Some(0),
                    };
                    self.selected_provider_index = new_index;
                    self.selected_model_index = Some(0);
                }
            },
            KeyCode::Char('m') => {
                if let Some(provider_idx) = self.selected_provider_index {
                    let provider = &self.providers[provider_idx];
                    if let Some(models) = self.models.get(provider) {
                        if !models.is_empty() {
                            let new_index = match self.selected_model_index {
                                Some(i) if i < models.len() - 1 => Some(i + 1),
                                Some(_) => Some(0),
                                None => Some(0),
                            };
                            self.selected_model_index = new_index;
                        }
                    }
                }
            },
            _ => {},
        }
    }

    pub fn handle_job_status_input(&mut self, key: KeyEvent) {
        match key.code {
            KeyCode::Char(c) => {
                self.job_id_input.insert(c);
            },
            KeyCode::Backspace => {
                self.job_id_input.delete();
            },
            KeyCode::Enter => {
                let job_id = self.job_id_input.value().to_string();
                if !job_id.is_empty() {
                    self.current_job_id = Some(job_id);
                    self.job_progress = Some((50, 100)); // Simulate progress
                    self.job_status = Some("processing".to_string());
                    self.message = Some("Job status retrieved".to_string());
                } else {
                    self.message = Some("Please enter a job ID".to_string());
                }
            },
            _ => {},
        }
    }

    pub fn get_current_provider(&self) -> Option<&str> {
        self.selected_provider_index.and_then(|i| self.providers.get(i)).map(|s| s.as_str())
    }

    pub fn get_current_model(&self) -> Option<&str> {
        let provider = self.get_current_provider()?;
        let models = self.models.get(provider)?;
        self.selected_model_index.and_then(|i| models.get(i)).map(|s| s.as_str())
    }
}