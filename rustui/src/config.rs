use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub backend_url: String,
    pub default_provider: String,
    pub default_model: String,
    pub default_language: String,
    pub default_processing_type: String,
    pub downloads_directory: Option<PathBuf>,
    pub max_upload_size_mb: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            backend_url: "http://localhost:8000".to_string(),
            default_provider: "openai".to_string(),
            default_model: "gpt-4-turbo".to_string(),
            default_language: "en".to_string(),
            default_processing_type: "standard".to_string(),
            downloads_directory: dirs::download_dir(),
            max_upload_size_mb: 100,
        }
    }
}

impl Config {
    pub fn load() -> Result<Self> {
        let config_dir = get_config_dir()?;
        let config_path = config_dir.join("config.toml");

        if !config_path.exists() {
            let default_config = Config::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let config_content = fs::read_to_string(&config_path)
            .context("Failed to read config file")?;
            
        let config: Config = toml::from_str(&config_content)
            .context("Failed to parse config file")?;
            
        Ok(config)
    }

    pub fn save(&self) -> Result<()> {
        let config_dir = get_config_dir()?;
        fs::create_dir_all(&config_dir)
            .context("Failed to create config directory")?;
            
        let config_path = config_dir.join("config.toml");
        let config_content = toml::to_string_pretty(self)
            .context("Failed to serialize config")?;
            
        fs::write(&config_path, config_content)
            .context("Failed to write config file")?;
            
        Ok(())
    }
}

fn get_config_dir() -> Result<PathBuf> {
    let mut config_dir = dirs::config_dir()
        .context("Could not determine config directory")?;
        
    config_dir.push("anydataset-tui");
    Ok(config_dir)
}