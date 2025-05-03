use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Common record format used across all processing types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub instruction: String,
    pub prompt: String,
    pub completion: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Result of any processing operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingResult {
    pub records: Vec<Record>,
    pub source_file: String,
    pub processing_type: String,
    pub stats: ProcessingStats,
}

/// Statistics collected during processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingStats {
    pub total_records: usize,
    pub total_tokens: usize,
    pub processing_time_ms: u64,
}

/// Interface for processors
pub trait Processor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult>;
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
}

/// Configuration for processors
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorConfig {
    pub model: String,
    pub provider: String,
    pub language: String,
    pub system_prompt: Option<String>,
    pub keywords: Vec<String>,
    pub add_reasoning: bool,
    pub output_format: String,
}

/// Standard processor implementation
pub struct StandardProcessor;

impl Processor for StandardProcessor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult> {
        // In the actual implementation, this would process the file
        // For now, we just return a mock result
        
        let record = Record {
            instruction: "Analyze the document".to_string(),
            prompt: "What information is contained in this document?".to_string(),
            completion: "This document contains sample information for testing purposes.".to_string(),
            metadata: HashMap::from([
                ("file_type".to_string(), serde_json::Value::String("pdf".to_string())),
                ("page_count".to_string(), serde_json::Value::Number(serde_json::Number::from(10))),
            ]),
        };
        
        Ok(ProcessingResult {
            records: vec![record],
            source_file: file_path.to_string(),
            processing_type: "standard".to_string(),
            stats: ProcessingStats {
                total_records: 1,
                total_tokens: 100,
                processing_time_ms: 1500,
            },
        })
    }
    
    fn name(&self) -> &'static str {
        "standard"
    }
    
    fn description(&self) -> &'static str {
        "Standard document processing"
    }
}

/// Article processor implementation
pub struct ArticleProcessor;

impl Processor for ArticleProcessor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult> {
        // In the actual implementation, this would process the file
        // For now, we just return a mock result
        
        let record = Record {
            instruction: "Extract article content".to_string(),
            prompt: "What are the key points of this article?".to_string(),
            completion: "The article discusses several key topics including...".to_string(),
            metadata: HashMap::from([
                ("article_type".to_string(), serde_json::Value::String("news".to_string())),
                ("word_count".to_string(), serde_json::Value::Number(serde_json::Number::from(1500))),
                ("author".to_string(), serde_json::Value::String("John Doe".to_string())),
            ]),
        };
        
        Ok(ProcessingResult {
            records: vec![record],
            source_file: file_path.to_string(),
            processing_type: "article".to_string(),
            stats: ProcessingStats {
                total_records: 1,
                total_tokens: 250,
                processing_time_ms: 2200,
            },
        })
    }
    
    fn name(&self) -> &'static str {
        "article"
    }
    
    fn description(&self) -> &'static str {
        "Article extraction and processing"
    }
}

/// Translation processor implementation
pub struct TranslateProcessor;

impl Processor for TranslateProcessor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult> {
        // In the actual implementation, this would process the file
        // For now, we just return a mock result
        
        let source_language = "en";
        let target_language = &config.language;
        
        let record = Record {
            instruction: format!("Translate from {} to {}", source_language, target_language),
            prompt: "This is sample text that needs to be translated.".to_string(),
            completion: if target_language == "pl" {
                "To jest przykładowy tekst, który wymaga tłumaczenia."
            } else {
                "This is sample text that needs to be translated."
            }.to_string(),
            metadata: HashMap::from([
                ("source_language".to_string(), serde_json::Value::String(source_language.to_string())),
                ("target_language".to_string(), serde_json::Value::String(target_language.to_string())),
                ("character_count".to_string(), serde_json::Value::Number(serde_json::Number::from(45))),
            ]),
        };
        
        Ok(ProcessingResult {
            records: vec![record],
            source_file: file_path.to_string(),
            processing_type: "translate".to_string(),
            stats: ProcessingStats {
                total_records: 1,
                total_tokens: 120,
                processing_time_ms: 1800,
            },
        })
    }
    
    fn name(&self) -> &'static str {
        "translate"
    }
    
    fn description(&self) -> &'static str {
        "Document translation"
    }
}

/// Batch processor implementation
pub struct BatchProcessor;

impl Processor for BatchProcessor {
    fn process_file(&self, file_path: &str, config: &ProcessorConfig) -> anyhow::Result<ProcessingResult> {
        // In the actual implementation, this would process multiple files
        // For now, we just return a mock result
        
        let records = vec![
            Record {
                instruction: "Process first item in batch".to_string(),
                prompt: "What is the content of the first item?".to_string(),
                completion: "The first item contains information about...".to_string(),
                metadata: HashMap::from([
                    ("batch_index".to_string(), serde_json::Value::Number(serde_json::Number::from(0))),
                ]),
            },
            Record {
                instruction: "Process second item in batch".to_string(),
                prompt: "What is the content of the second item?".to_string(),
                completion: "The second item discusses...".to_string(),
                metadata: HashMap::from([
                    ("batch_index".to_string(), serde_json::Value::Number(serde_json::Number::from(1))),
                ]),
            },
        ];
        
        Ok(ProcessingResult {
            records,
            source_file: file_path.to_string(),
            processing_type: "batch".to_string(),
            stats: ProcessingStats {
                total_records: 2,
                total_tokens: 300,
                processing_time_ms: 3500,
            },
        })
    }
    
    fn name(&self) -> &'static str {
        "batch"
    }
    
    fn description(&self) -> &'static str {
        "Batch processing of multiple documents"
    }
}

/// Factory function to get the appropriate processor based on the processing type
pub fn get_processor(processing_type: &str) -> anyhow::Result<Box<dyn Processor>> {
    match processing_type {
        "standard" => Ok(Box::new(StandardProcessor)),
        "article" => Ok(Box::new(ArticleProcessor)),
        "translate" => Ok(Box::new(TranslateProcessor)),
        "batch" => Ok(Box::new(BatchProcessor)),
        _ => anyhow::bail!("Unknown processing type: {}", processing_type),
    }
}