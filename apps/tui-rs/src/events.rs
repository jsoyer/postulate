use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use std::time::Duration;

/// Key action after processing an input event.
#[derive(Clone, Copy)]
pub enum Action {
    Quit,
    ForceQuit,
    Help,
    Back,
    Tab,
    Up,
    Down,
    Left,
    Right,
    Top,
    Bottom,
    Select,
    Filter,
    New,
    Delete,
    Run,
    Copy,
    Refresh,
    JumpToView(usize),
    // Detail view quick-launch actions.
    Tailor,
    Review,
    Build,
    Score,
    Prep,
    Audit,
    None,
}

/// Poll for a crossterm event with the given timeout.
pub fn poll(timeout: Duration) -> std::io::Result<Option<Event>> {
    if event::poll(timeout)? {
        Ok(Some(event::read()?))
    } else {
        Ok(None)
    }
}

/// Map a key event to an Action.
pub fn handle_key(key: KeyEvent) -> Action {
    match key.code {
        KeyCode::Char('q') => Action::Quit,
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => Action::ForceQuit,
        KeyCode::Char('?') => Action::Help,
        KeyCode::Esc => Action::Back,
        KeyCode::Tab => Action::Tab,
        KeyCode::Char('j') | KeyCode::Down => Action::Down,
        KeyCode::Char('k') | KeyCode::Up => Action::Up,
        KeyCode::Char('h') | KeyCode::Left => Action::Left,
        KeyCode::Char('l') | KeyCode::Right => Action::Right,
        KeyCode::Char('g') => Action::Top,
        KeyCode::Char('G') => Action::Bottom,
        KeyCode::Enter => Action::Select,
        KeyCode::Char('/') => Action::Filter,
        KeyCode::Char('n') => Action::New,
        KeyCode::Char('d') => Action::Delete,
        KeyCode::Char('r') => Action::Run,
        KeyCode::Char('y') => Action::Copy,
        KeyCode::Char('R') => Action::Refresh,
        KeyCode::Char('t') => Action::Tailor,
        KeyCode::Char('v') => Action::Review,
        KeyCode::Char('b') => Action::Build,
        KeyCode::Char('s') => Action::Score,
        KeyCode::Char('p') => Action::Prep,
        KeyCode::Char('a') => Action::Audit,
        KeyCode::Char(c @ '1'..='6') => Action::JumpToView((c as usize) - ('1' as usize)),
        _ => Action::None,
    }
}
