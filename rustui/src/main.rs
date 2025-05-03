use anyhow::{Context, Result};
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{prelude::*, widgets::*};
use std::{
    io,
    time::{Duration, Instant}, 
    panic, fs, path::PathBuf,
};

mod app;
mod ui;
mod api;
mod config;
mod processors;
mod logger;
mod error;
mod tests;

#[macro_use]
extern crate lazy_static;

// Reeksportujemy makra logowania, aby były dostępne w całym projekcie
pub use crate::logger::{debug, info, warn, error, fatal, LogLevel, set_console_level, set_file_level};
#[macro_use] 
pub use crate::log_debug;
#[macro_use]
pub use crate::log_info;
#[macro_use]
pub use crate::log_warn;
#[macro_use]
pub use crate::log_error;
#[macro_use]
pub use crate::log_fatal;

use app::{App, AppState};
use ui::ui;

// Wersja aplikacji z pliku Cargo.toml
const VERSION: &str = env!("CARGO_PKG_VERSION");

fn main() -> Result<()> {
    // Inicjalizacja niestandardowego handlera paniki
    setup_panic_handler();
    
    // Inicjalizacja loggera
    set_console_level(LogLevel::INFO);
    set_file_level(LogLevel::DEBUG);
    
    // Informacje startowe
    log_info!("Starting AnyDataset TUI v{}", VERSION);
    log_info!("Working directory: {:?}", std::env::current_dir().unwrap_or_default());
    
    // Wczytaj konfigurację
    let config = match config::Config::load() {
        Ok(cfg) => {
            log_info!("Configuration loaded successfully");
            cfg
        },
        Err(err) => {
            log_warn!("Failed to load configuration: {}, using defaults", err);
            config::Config::default()
        }
    };
    
    // Setup terminala
    log_debug!("Setting up terminal");
    enable_raw_mode().context("Failed to enable raw mode")?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Utwórz aplikację i uruchom ją
    let tick_rate = Duration::from_millis(250);
    let app = App::new(&config.backend_url);
    log_info!("Starting application main loop");
    let res = run_app(&mut terminal, app, tick_rate);

    // Przywracanie terminala
    log_debug!("Restoring terminal");
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        log_error!("Application error: {:?}", err);
        println!("Error: {}\nSee log file for details.", err);
    }

    log_info!("Application terminated");
    Ok(())
}

// Niestandardowy handler paniki
fn setup_panic_handler() {
    panic::set_hook(Box::new(|panic_info| {
        // Przywracanie terminala w przypadku paniki
        let _ = disable_raw_mode();
        let mut stdout = io::stdout();
        let _ = execute!(
            stdout,
            LeaveAlternateScreen,
            DisableMouseCapture
        );
        
        // Zbieranie informacji o panice
        let backtrace = std::backtrace::Backtrace::capture();
        let panic_message = panic_info.to_string();
        let panic_location = panic_info.location().map(|loc| format!("{}:{}", loc.file(), loc.line())).unwrap_or_else(|| "unknown".to_string());
        
        // Logowanie do pliku i konsoli
        if let Err(err) = disable_raw_mode() {
            eprintln!("Failed to disable raw mode: {}", err);
        }
        
        // Zapisz informacje do pliku crashlog
        let crash_dir = dirs::cache_dir().unwrap_or(PathBuf::from("/tmp")).join("anydataset-tui");
        let _ = fs::create_dir_all(&crash_dir);
        let crash_file = crash_dir.join(format!("crash_{}.log", chrono::Local::now().format("%Y%m%d_%H%M%S")));
        
        let crash_info = format!(
            "AnyDataset TUI crashed!\n\
            Time: {}\n\
            Version: {}\n\
            Panic: {}\n\
            Location: {}\n\
            Backtrace:\n{:?}\n",
            chrono::Local::now(), VERSION, panic_message, panic_location, backtrace
        );
        
        let _ = fs::write(&crash_file, &crash_info);
        
        // Wyświetl informację dla użytkownika
        eprintln!("\n\nANYDATASET TUI CRASHED!\n");
        eprintln!("Error: {}", panic_message);
        eprintln!("Location: {}", panic_location);
        eprintln!("\nCrash report saved to: {:?}", crash_file);
        eprintln!("\nPlease report this issue with the crash log attached.");
    }));
}

fn run_app<B: Backend>(
    terminal: &mut Terminal<B>,
    mut app: App,
    tick_rate: Duration,
) -> Result<()> {
    let mut last_tick = Instant::now();
    
    loop {
        terminal.draw(|f| ui(f, &mut app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or_else(|| Duration::from_secs(0));

        if crossterm::event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match app.state {
                        AppState::Main => match key.code {
                            KeyCode::Char('q') => return Ok(()),
                            KeyCode::Char('u') => app.state = AppState::Upload,
                            KeyCode::Char('p') => app.state = AppState::Process,
                            KeyCode::Char('s') => app.state = AppState::Settings,
                            KeyCode::Char('j') => app.state = AppState::JobStatus,
                            _ => {}
                        },
                        AppState::Upload => match key.code {
                            KeyCode::Esc => app.state = AppState::Main,
                            _ => app.handle_upload_input(key),
                        },
                        AppState::Process => match key.code {
                            KeyCode::Esc => app.state = AppState::Main,
                            _ => app.handle_process_input(key),
                        },
                        AppState::Settings => match key.code {
                            KeyCode::Esc => app.state = AppState::Main,
                            _ => app.handle_settings_input(key),
                        },
                        AppState::JobStatus => match key.code {
                            KeyCode::Esc => app.state = AppState::Main,
                            _ => app.handle_job_status_input(key),
                        },
                    }
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            app.on_tick();
            last_tick = Instant::now();
        }
    }
}