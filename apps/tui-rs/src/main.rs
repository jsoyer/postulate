mod api;
mod app;
mod config;
mod error;
mod events;
mod ui;

use std::io;
use std::panic;
use std::time::Duration;

use anyhow::{Context, Result};
use clap::Parser;
use crossterm::{
    event::{DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

use crate::api::ApiClient;
use crate::app::{ActionsPhase, App, View};
use crate::config::Config;
use crate::events::{handle_key, Action};

#[derive(Parser)]
#[command(name = "cv-rs", about = "Ratatui TUI client for cv-api", version)]
struct Cli {
    /// Path to config file
    #[arg(long, default_value = "")]
    config: String,

    /// Override API base URL (also via CV_API_URL env var)
    #[arg(long)]
    api_url: Option<String>,
}

/// A guard that restores the terminal on drop, even in case of panic.
struct TerminalGuard;

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = disable_raw_mode();
        let _ = execute!(io::stdout(), LeaveAlternateScreen, DisableMouseCapture);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let config_path = if cli.config.is_empty() {
        dirs::config_dir()
            .context("cannot find config directory")?
            .join("cv")
            .join("config.toml")
            .to_string_lossy()
            .to_string()
    } else {
        cli.config.clone()
    };

    let mut cfg = Config::load_from(&config_path)
        .with_context(|| format!("failed to load config from {config_path}"))?;

    if let Some(url) = cli.api_url {
        cfg.api.base_url = url;
    }

    // Environment variables override file config and CLI flags.
    cfg.apply_env_overrides();

    let api = ApiClient::new(cfg.api.base_url, cfg.api.api_key, cfg.api.timeout_secs)
        .context("failed to create API client")?;

    // Install panic hook that restores the terminal before printing the panic.
    let default_hook = panic::take_hook();
    panic::set_hook(Box::new(move |info| {
        let _ = disable_raw_mode();
        let _ = execute!(io::stdout(), LeaveAlternateScreen, DisableMouseCapture);
        default_hook(info);
    }));

    enable_raw_mode().context("failed to enable raw mode")?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)
        .context("failed to enter alternate screen")?;

    let _guard = TerminalGuard;

    let backend = CrosstermBackend::new(io::stdout());
    let mut terminal = Terminal::new(backend).context("failed to create terminal")?;

    let mut app = App::new(api);
    app.init();

    run_event_loop(&mut terminal, &mut app)?;

    Ok(())
}

fn run_event_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut App,
) -> Result<()> {
    let tick_interval = Duration::from_millis(250);

    loop {
        // Drain any messages from async tasks.
        app.drain_messages();

        // Render.
        terminal.draw(|frame| {
            ui::render(frame, app);
        })?;

        if !app.running {
            break;
        }

        // Poll for crossterm events.
        if let Some(event) = events::poll(tick_interval)? {
            match event {
                Event::Key(key_event) => {
                    // Handle raw character input separately when filtering, entering
                    // args, or filling in the new-application form — before the
                    // generic action mapping strips context.
                    let is_filter_mode = app.current_view == View::Apps && app.apps.filtering;
                    let is_arg_mode = app.current_view == View::Actions
                        && app.actions.phase == ActionsPhase::EnterArgs;
                    let is_new_app_mode = app.current_view == View::NewApp
                        && app.new_app.success.is_none()
                        && !app.new_app.submitting;

                    if (is_filter_mode || is_arg_mode || is_new_app_mode)
                        && key_event.modifiers == KeyModifiers::NONE
                    {
                        match key_event.code {
                            KeyCode::Char(ch) => {
                                app.handle_filter_char(ch);
                                continue;
                            }
                            KeyCode::Backspace => {
                                app.handle_backspace();
                                continue;
                            }
                            KeyCode::Esc => {
                                app.handle_action(Action::Back);
                                continue;
                            }
                            KeyCode::Enter => {
                                app.handle_action(Action::Select);
                                continue;
                            }
                            KeyCode::Tab => {
                                // Tab advances the field in new-app form.
                                if is_new_app_mode {
                                    app.handle_action(Action::Select);
                                }
                                continue;
                            }
                            _ => {}
                        }
                    }

                    let action = handle_key(key_event);
                    app.handle_action(action);
                }
                Event::Resize(w, h) => {
                    app.width = w;
                    app.height = h;
                }
                _ => {}
            }
        } else {
            // Tick: advance spinner animation.
            app.spinner_tick = app.spinner_tick.wrapping_add(1);
        }
    }

    Ok(())
}
