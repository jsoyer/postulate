use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, BorderType, Borders, Paragraph},
    Frame,
};

use crate::app::App;
use crate::ui::theme::CatppuccinMocha as C;

const COLUMNS: [&str; 5] = ["applied", "interview", "offer", "rejected", "ghosted"];

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.kanban;

    if state.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading kanban board..."))
            .style(Style::default().fg(C::BLUE));
        frame.render_widget(msg, area);
        return;
    }

    if let Some(ref err) = state.error {
        let msg = Paragraph::new(format!("Error: {err}")).style(Style::default().fg(C::RED));
        frame.render_widget(msg, area);
        return;
    }

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // title
            Constraint::Length(1), // blank
            Constraint::Min(1),    // columns + help
        ])
        .split(area);

    let title = Paragraph::new("Kanban Board")
        .style(Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD));
    frame.render_widget(title, chunks[0]);

    let board_area = chunks[2];
    let help_height = 2u16;
    let col_area_height = board_area.height.saturating_sub(help_height);

    #[allow(clippy::cast_possible_truncation)]
    let col_width = ((area.width as usize).saturating_sub(4) / COLUMNS.len()) as u16;
    let col_width = col_width.max(18);

    let col_constraints: Vec<Constraint> = COLUMNS
        .iter()
        .map(|_| Constraint::Length(col_width))
        .collect();

    let col_area = Rect {
        x: board_area.x,
        y: board_area.y,
        width: board_area.width,
        height: col_area_height,
    };

    let col_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints(col_constraints)
        .split(col_area);

    for (ci, &status) in COLUMNS.iter().enumerate() {
        if ci >= col_chunks.len() {
            break;
        }
        render_column(frame, app, ci, status, col_chunks[ci]);
    }

    let help_area = Rect {
        x: board_area.x,
        y: board_area.y + col_area_height,
        width: board_area.width,
        height: help_height,
    };
    let help = Paragraph::new(Line::from(Span::styled(
        "  h/l columns  j/k cards  R refresh",
        Style::default().fg(C::OVERLAY0),
    )));
    frame.render_widget(help, help_area);
}

fn render_column(frame: &mut Frame, app: &App, col_idx: usize, status: &str, area: Rect) {
    let state = &app.kanban;
    let is_focused = col_idx == state.col;
    let apps_in_col = state.by_status.get(status).map_or(&[][..], Vec::as_slice);

    let border_color = if is_focused { C::BLUE } else { C::OVERLAY0 };
    let status_color = col_status_color(status);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_type(BorderType::Rounded)
        .border_style(Style::default().fg(border_color))
        .title(Span::styled(
            format!(" {} ({}) ", status, apps_in_col.len()),
            Style::default()
                .fg(status_color)
                .add_modifier(Modifier::BOLD),
        ));

    let inner = block.inner(area);
    frame.render_widget(block, area);

    let max_cards = (inner.height as usize).saturating_sub(0).max(1);
    let limit = apps_in_col.len().min(max_cards);

    let mut lines: Vec<Line> = Vec::new();
    for (i, app_item) in apps_in_col.iter().take(limit).enumerate() {
        let is_selected = is_focused && i == state.row;

        let company = truncate(&app_item.company, (inner.width as usize).saturating_sub(4));
        let position = truncate(&app_item.position, (inner.width as usize).saturating_sub(4));

        if is_selected {
            lines.push(Line::from(Span::styled(
                company,
                Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
            )));
            lines.push(Line::from(Span::styled(
                position,
                Style::default().fg(C::BLUE),
            )));
        } else {
            lines.push(Line::from(Span::styled(
                company,
                Style::default().add_modifier(Modifier::BOLD),
            )));
            lines.push(Line::from(Span::styled(
                position,
                Style::default().fg(C::OVERLAY0),
            )));
        }

        if i + 1 < limit {
            lines.push(Line::from(""));
        }
    }

    if apps_in_col.len() > max_cards {
        lines.push(Line::from(Span::styled(
            format!("+{} more", apps_in_col.len() - max_cards),
            Style::default().fg(C::OVERLAY0),
        )));
    }

    frame.render_widget(Paragraph::new(lines), inner);
}

fn col_status_color(status: &str) -> ratatui::style::Color {
    match status {
        "applied" => C::BLUE,
        "interview" => C::YELLOW,
        "offer" => C::GREEN,
        "rejected" => C::RED,
        _ => C::OVERLAY0,
    }
}

fn truncate(s: &str, max: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max {
        s.to_string()
    } else {
        let prefix: String = s.chars().take(max.saturating_sub(3)).collect();
        format!("{prefix}...")
    }
}

fn spinner_char(tick: u8) -> char {
    const FRAMES: [char; 4] = ['|', '/', '-', '\\'];
    FRAMES[(tick as usize) % FRAMES.len()]
}

#[cfg(test)]
mod tests {}
