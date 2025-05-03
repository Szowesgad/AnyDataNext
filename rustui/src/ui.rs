use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Tabs, Gauge},
    Frame,
};

use crate::app::{App, AppState, ProcessingType};

pub fn ui(f: &mut Frame, app: &mut App) {
    let size = f.size();

    // Create the layout
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // For tabs
            Constraint::Min(0),     // Main content
            Constraint::Length(3),  // Status bar
        ])
        .split(size);

    // Draw the tabs
    let titles = vec!["Main", "Upload", "Process", "Settings", "Job Status"];
    let tabs = Tabs::new(titles.into_iter().map(Line::from).collect())
        .block(Block::default().borders(Borders::ALL).title("AnyDataset TUI"))
        .select(match app.state {
            AppState::Main => 0,
            AppState::Upload => 1,
            AppState::Process => 2,
            AppState::Settings => 3,
            AppState::JobStatus => 4,
        })
        .style(Style::default().fg(Color::White))
        .highlight_style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));
    f.render_widget(tabs, chunks[0]);

    // Draw the content based on the current app state
    match app.state {
        AppState::Main => draw_main(f, app, chunks[1]),
        AppState::Upload => draw_upload(f, app, chunks[1]),
        AppState::Process => draw_process(f, app, chunks[1]),
        AppState::Settings => draw_settings(f, app, chunks[1]),
        AppState::JobStatus => draw_job_status(f, app, chunks[1]),
    }

    // Draw the status bar
    draw_status_bar(f, app, chunks[2]);
}

fn draw_main(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title("Welcome to AnyDataset TUI")
        .borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let text = Text::from(vec![
        Line::from("AnyDataset Terminal UI Client"),
        Line::from(""),
        Line::from("Press keys to navigate:"),
        Line::from("- 'u': Upload files"),
        Line::from("- 'p': Process files"),
        Line::from("- 's': Settings"),
        Line::from("- 'j': Job Status"),
        Line::from("- 'q': Quit"),
        Line::from(""),
        Line::from(format!("Backend URL: {}", app.backend_url)),
    ]);

    let paragraph = Paragraph::new(text)
        .style(Style::default().fg(Color::White))
        .block(Block::default());
    f.render_widget(paragraph, inner_area);
}

fn draw_upload(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title("Upload Files")
        .borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Instructions
            Constraint::Min(0),     // File list
        ])
        .split(inner_area);

    let instructions = Paragraph::new("Press 'f' to simulate file upload, Esc to return")
        .style(Style::default().fg(Color::White));
    f.render_widget(instructions, chunks[0]);

    // Draw uploaded files
    let items: Vec<ListItem> = app
        .uploaded_files
        .iter()
        .enumerate()
        .map(|(i, file)| {
            let style = if Some(i) == app.selected_file_index {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            ListItem::new(file.clone()).style(style)
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().title("Uploaded Files").borders(Borders::ALL));
    f.render_widget(list, chunks[1]);
}

fn draw_process(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title("Process Files")
        .borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(4),  // Processing type
            Constraint::Length(2),  // Instructions
            Constraint::Min(0),     // File list
            Constraint::Length(3),  // Progress bar (if active)
        ])
        .split(inner_area);

    // Processing type selection
    let processing_types = ProcessingType::all()
        .iter()
        .enumerate()
        .map(|(i, pt)| {
            let style = if pt == &app.processing_type {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            Span::styled(format!("{}. {}", i + 1, pt.to_str()), style)
        })
        .collect::<Vec<_>>();

    let processing_text = Line::from(processing_types);
    let processing_type_para = Paragraph::new(Text::from(vec![
        Line::from("Processing Type:"),
        processing_text,
    ]))
    .block(Block::default().borders(Borders::ALL));
    f.render_widget(processing_type_para, chunks[0]);

    // Instructions
    let instructions = Paragraph::new("Select file with Up/Down, change processing type with 1-4, press 'p' to process")
        .style(Style::default().fg(Color::White));
    f.render_widget(instructions, chunks[1]);

    // File list
    let items: Vec<ListItem> = app
        .uploaded_files
        .iter()
        .enumerate()
        .map(|(i, file)| {
            let style = if Some(i) == app.selected_file_index {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::White)
            };
            ListItem::new(file.clone()).style(style)
        })
        .collect();

    let list = List::new(items)
        .block(Block::default().title("Select File").borders(Borders::ALL));
    f.render_widget(list, chunks[2]);

    // Progress bar if job is active
    if let (Some(job_id), Some((current, total))) = (&app.current_job_id, app.job_progress) {
        let progress_percent = if total > 0 { (current as f64 / total as f64) * 100.0 } else { 0.0 };
        let gauge = Gauge::default()
            .block(Block::default().title(format!("Job: {} - Progress", job_id)).borders(Borders::ALL))
            .gauge_style(Style::default().fg(Color::Cyan))
            .percent(progress_percent as u16);
        f.render_widget(gauge, chunks[3]);
    }
}

fn draw_settings(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title("Settings")
        .borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Language
            Constraint::Length(5),  // Provider & Model
            Constraint::Min(0),     // Other settings
        ])
        .split(inner_area);

    // Language settings
    let lang_text = format!("Language: {} (press 'l' to change)", app.language);
    let language = Paragraph::new(lang_text)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(Color::White));
    f.render_widget(language, chunks[0]);

    // Provider and Model selection
    let current_provider = app.get_current_provider().unwrap_or("none");
    let current_model = app.get_current_model().unwrap_or("none");
    
    let provider_model_text = Text::from(vec![
        Line::from(format!("Provider: {} (press 'p' to change)", current_provider)),
        Line::from(""),
        Line::from(format!("Model: {} (press 'm' to change)", current_model)),
    ]);
    
    let provider_model = Paragraph::new(provider_model_text)
        .block(Block::default().title("Provider & Model").borders(Borders::ALL))
        .style(Style::default().fg(Color::White));
    f.render_widget(provider_model, chunks[1]);

    // Other settings
    let other_settings_text = Text::from(vec![
        Line::from("Other settings:"),
        Line::from(""),
        Line::from("Backend URL: ").add_span(Span::styled(
            app.backend_url.clone(),
            Style::default().fg(Color::Cyan),
        )),
    ]);
    
    let other_settings = Paragraph::new(other_settings_text)
        .block(Block::default().borders(Borders::ALL))
        .style(Style::default().fg(Color::White));
    f.render_widget(other_settings, chunks[2]);
}

fn draw_job_status(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default()
        .title("Job Status")
        .borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),  // Input
            Constraint::Min(0),     // Status display
        ])
        .split(inner_area);

    // Job ID input
    let input_text = format!("Job ID: {}", app.job_id_input.value());
    let input = Paragraph::new(input_text)
        .style(Style::default().fg(Color::White))
        .block(Block::default().borders(Borders::ALL).title("Enter Job ID and press Enter"));
    f.render_widget(input, chunks[0]);

    // Job status display
    if let (Some(job_id), Some((current, total)), Some(status)) = 
        (&app.current_job_id, app.job_progress, &app.job_status) {
        let progress_percent = if total > 0 { (current as f64 / total as f64) * 100.0 } else { 0.0 };
        
        let status_text = Text::from(vec![
            Line::from(format!("Job ID: {}", job_id)),
            Line::from(format!("Status: {}", status)),
            Line::from(format!("Progress: {}/{} ({:.1}%)", current, total, progress_percent)),
        ]);
        
        let status_display = Paragraph::new(status_text)
            .style(Style::default().fg(Color::White))
            .block(Block::default().borders(Borders::ALL).title("Job Status"));
        f.render_widget(status_display, chunks[1]);
        
        // Draw gauge
        let gauge_area = centered_rect(60, 3, chunks[1]);
        let gauge = Gauge::default()
            .block(Block::default().borders(Borders::ALL))
            .gauge_style(Style::default().fg(Color::Cyan))
            .percent(progress_percent as u16);
        f.render_widget(gauge, gauge_area);
    } else {
        let instructions = Paragraph::new("Enter a job ID to check status")
            .style(Style::default().fg(Color::Gray))
            .block(Block::default().borders(Borders::ALL));
        f.render_widget(instructions, chunks[1]);
    }
}

fn draw_status_bar(f: &mut Frame, app: &App, area: Rect) {
    let block = Block::default().borders(Borders::ALL);
    f.render_widget(block, area);

    let inner_area = inner_area(area);
    let message = match &app.message {
        Some(msg) => msg.clone(),
        None => match app.state {
            AppState::Main => "Press 'q' to quit".to_string(),
            AppState::Upload => "Upload screen - Esc to return".to_string(),
            AppState::Process => "Process screen - Esc to return".to_string(),
            AppState::Settings => "Settings screen - Esc to return".to_string(),
            AppState::JobStatus => "Job Status screen - Esc to return".to_string(),
        },
    };

    let paragraph = Paragraph::new(message)
        .style(Style::default().fg(Color::White))
        .alignment(ratatui::layout::Alignment::Center);
    f.render_widget(paragraph, inner_area);
}

// Helper function to get a smaller area within a block
fn inner_area(area: Rect) -> Rect {
    let inner = area.inner(&Constraint::new(1, 1, 1, 1));
    Rect {
        x: inner.x,
        y: inner.y,
        width: inner.width.saturating_sub(2),
        height: inner.height.saturating_sub(2),
    }
}

// Helper function to create a centered rect of the specified size
fn centered_rect(percent_x: u16, height: u16, r: Rect) -> Rect {
    let popup_width = percent_x * r.width / 100;
    let popup_x = r.x + (r.width - popup_width) / 2;
    
    let popup_y = r.y + (r.height - height) / 2;
    
    Rect {
        x: popup_x,
        y: popup_y,
        width: popup_width,
        height,
    }
}