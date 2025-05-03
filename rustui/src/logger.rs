use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::{Context, Result};
use once_cell::sync::Lazy;

// Poziomy logowania
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
    FATAL,
}

impl LogLevel {
    fn as_str(&self) -> &'static str {
        match self {
            LogLevel::DEBUG => "DEBUG",
            LogLevel::INFO => "INFO",
            LogLevel::WARN => "WARN",
            LogLevel::ERROR => "ERROR",
            LogLevel::FATAL => "FATAL",
        }
    }
    
    // Kolorowanie dla terminala ANSI
    fn color_code(&self) -> &'static str {
        match self {
            LogLevel::DEBUG => "\x1b[36m", // Cyan
            LogLevel::INFO => "\x1b[32m",  // Green
            LogLevel::WARN => "\x1b[33m",  // Yellow
            LogLevel::ERROR => "\x1b[31m", // Red
            LogLevel::FATAL => "\x1b[35m", // Magenta
        }
    }
}

// Global logger instance
static LOGGER: Lazy<Mutex<Logger>> = Lazy::new(|| {
    Mutex::new(Logger::new().unwrap_or_else(|e| {
        eprintln!("Failed to initialize logger: {}", e);
        Logger {
            log_file: None,
            console_level: LogLevel::INFO,
            file_level: LogLevel::DEBUG,
        }
    }))
});

pub struct Logger {
    log_file: Option<File>,
    console_level: LogLevel,
    file_level: LogLevel,
}

impl Logger {
    fn new() -> Result<Self> {
        let log_dir = if let Some(config_dir) = dirs::config_dir() {
            let mut path = config_dir;
            path.push("anydataset-tui");
            path.push("logs");
            path
        } else {
            PathBuf::from("logs")
        };
        
        std::fs::create_dir_all(&log_dir)
            .context("Failed to create log directory")?;
        
        // Utwórz nazwę pliku logu na podstawie aktualnej daty
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        let log_file_path = log_dir.join(format!("anydataset-tui-{}.log", now));
        
        let file = OpenOptions::new()
            .write(true)
            .create(true)
            .append(true)
            .open(log_file_path)
            .context("Failed to open log file")?;
        
        Ok(Self {
            log_file: Some(file),
            console_level: LogLevel::INFO,
            file_level: LogLevel::DEBUG,
        })
    }
    
    fn log_impl(&mut self, level: LogLevel, message: &str, module: &str) -> Result<()> {
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string();
        let log_entry = format!("[{}] [{}] [{}]: {}\n", now, level.as_str(), module, message);
        
        // Log do pliku
        if level >= self.file_level {
            if let Some(file) = &mut self.log_file {
                file.write_all(log_entry.as_bytes())
                    .context("Failed to write to log file")?;
                file.flush()
                    .context("Failed to flush log file")?;
            }
        }
        
        // Log do konsoli
        if level >= self.console_level {
            let color_code = level.color_code();
            let reset_code = "\x1b[0m";
            let colored_entry = format!(
                "{}[{}] [{}] [{}]: {}{}",
                color_code, now, level.as_str(), module, message, reset_code
            );
            println!("{}", colored_entry);
        }
        
        Ok(())
    }
    
    pub fn set_console_level(&mut self, level: LogLevel) {
        self.console_level = level;
    }
    
    pub fn set_file_level(&mut self, level: LogLevel) {
        self.file_level = level;
    }
}

// Public API

pub fn log(level: LogLevel, message: &str, module: &str) {
    if let Ok(mut logger) = LOGGER.lock() {
        if let Err(e) = logger.log_impl(level, message, module) {
            eprintln!("Logging error: {}", e);
        }
    } else {
        eprintln!("Failed to acquire logger lock");
    }
}

pub fn debug(message: &str, module: &str) {
    log(LogLevel::DEBUG, message, module);
}

pub fn info(message: &str, module: &str) {
    log(LogLevel::INFO, message, module);
}

pub fn warn(message: &str, module: &str) {
    log(LogLevel::WARN, message, module);
}

pub fn error(message: &str, module: &str) {
    log(LogLevel::ERROR, message, module);
}

pub fn fatal(message: &str, module: &str) {
    log(LogLevel::FATAL, message, module);
}

// Ustawienia poziomu logowania
pub fn set_console_level(level: LogLevel) {
    if let Ok(mut logger) = LOGGER.lock() {
        logger.set_console_level(level);
    }
}

pub fn set_file_level(level: LogLevel) {
    if let Ok(mut logger) = LOGGER.lock() {
        logger.set_file_level(level);
    }
}

// Makra ułatwiające logowanie z automatycznym module_path!()
#[macro_export]
macro_rules! log_debug {
    ($($arg:tt)*) => {
        $crate::logger::debug(&format!($($arg)*), module_path!())
    };
}

#[macro_export]
macro_rules! log_info {
    ($($arg:tt)*) => {
        $crate::logger::info(&format!($($arg)*), module_path!())
    };
}

#[macro_export]
macro_rules! log_warn {
    ($($arg:tt)*) => {
        $crate::logger::warn(&format!($($arg)*), module_path!())
    };
}

#[macro_export]
macro_rules! log_error {
    ($($arg:tt)*) => {
        $crate::logger::error(&format!($($arg)*), module_path!())
    };
}

#[macro_export]
macro_rules! log_fatal {
    ($($arg:tt)*) => {
        $crate::logger::fatal(&format!($($arg)*), module_path!())
    };
}