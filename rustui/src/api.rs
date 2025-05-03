use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingConfig {
    pub provider: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub keywords: Option<Vec<String>>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub language: Option<String>,
    pub processing_type: String,
    pub add_reasoning: Option<bool>,
    pub output_format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStatus {
    pub job_id: String,
    pub status: String,
    pub current: Option<u64>,
    pub total: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

pub struct ApiClient {
    client: reqwest::Client,
    base_url: String,
}

impl ApiClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: base_url.to_string(),
        }
    }

    pub async fn get_job_status(&self, job_id: &str) -> Result<JobStatus> {
        let url = format!("{}/api/jobs/{}", self.base_url, job_id);
        
        let response = self.client.get(&url)
            .send()
            .await
            .context("Failed to send request")?;
            
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("API error ({}): {}", status, error_text);
        }
        
        let job_status: JobStatus = response.json().await
            .context("Failed to parse job status")?;
            
        Ok(job_status)
    }

    pub async fn upload_file(&self, file_path: &Path) -> Result<String> {
        let url = format!("{}/api/upload", self.base_url);
        
        let file_name = file_path.file_name()
            .and_then(|n| n.to_str())
            .context("Invalid file name")?;
            
        let file_data = tokio::fs::read(file_path).await
            .context("Failed to read file")?;
            
        let form = reqwest::multipart::Form::new()
            .part("file", reqwest::multipart::Part::bytes(file_data)
                .file_name(file_name.to_string()));
                
        let response = self.client.post(&url)
            .multipart(form)
            .send()
            .await
            .context("Failed to upload file")?;
            
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Upload error ({}): {}", status, error_text);
        }
        
        #[derive(Deserialize)]
        struct UploadResponse {
            file_id: String,
        }
        
        let upload_result: UploadResponse = response.json().await
            .context("Failed to parse upload response")?;
            
        Ok(upload_result.file_id)
    }

    pub async fn process_file(&self, file_id: &str, config: ProcessingConfig) -> Result<String> {
        let url = format!("{}/api/process", self.base_url);
        
        #[derive(Serialize)]
        struct ProcessRequest {
            file_id: String,
            #[serde(flatten)]
            config: ProcessingConfig,
        }
        
        let request = ProcessRequest {
            file_id: file_id.to_string(),
            config,
        };
        
        let response = self.client.post(&url)
            .json(&request)
            .send()
            .await
            .context("Failed to send process request")?;
            
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Process error ({}): {}", status, error_text);
        }
        
        #[derive(Deserialize)]
        struct ProcessResponse {
            job_id: String,
        }
        
        let process_result: ProcessResponse = response.json().await
            .context("Failed to parse process response")?;
            
        Ok(process_result.job_id)
    }

    pub async fn get_available_models(&self) -> Result<serde_json::Value> {
        let url = format!("{}/api/models", self.base_url);
        
        let response = self.client.get(&url)
            .send()
            .await
            .context("Failed to get available models")?;
            
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("API error ({}): {}", status, error_text);
        }
        
        let models = response.json().await
            .context("Failed to parse models response")?;
            
        Ok(models)
    }

    pub async fn download_results(&self, job_id: &str, output_path: &Path) -> Result<()> {
        let url = format!("{}/api/results/{}", self.base_url, job_id);
        
        let response = self.client.get(&url)
            .send()
            .await
            .context("Failed to download results")?;
            
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            anyhow::bail!("Download error ({}): {}", status, error_text);
        }
        
        let bytes = response.bytes().await
            .context("Failed to read response body")?;
            
        tokio::fs::write(output_path, &bytes).await
            .context("Failed to write file")?;
            
        Ok(())
    }
}