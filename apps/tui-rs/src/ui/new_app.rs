use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{App, NewAppField};
use crate::ui::theme::CatppuccinMocha as C;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.new_app;

    // Center a box that is 50 chars wide and 14 rows tall.
    let box_width = 52_u16.min(area.width);
    let box_height = 14_u16.min(area.height);

    let centered = center_rect(box_width, box_height, area);

    let mut lines: Vec<Line> = Vec::new();

    // Title.
    lines.push(Line::from(Span::styled(
        " New Application ",
        Style::default()
            .fg(C::MAUVE)
            .add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(""));

    // Company field.
    let company_style = field_style(state.active_field == NewAppField::Company);
    lines.push(Line::from(Span::styled(
        "  Company",
        Style::default().fg(C::SUBTEXT1),
    )));
    lines.push(Line::from(vec![
        Span::raw("  "),
        Span::styled(
            format!("{}_", state.company),
            company_style,
        ),
    ]));
    lines.push(Line::from(""));

    // Position field.
    let position_style = field_style(state.active_field == NewAppField::Position);
    lines.push(Line::from(Span::styled(
        "  Position",
        Style::default().fg(C::SUBTEXT1),
    )));
    lines.push(Line::from(vec![
        Span::raw("  "),
        Span::styled(
            format!("{}_", state.position),
            position_style,
        ),
    ]));
    lines.push(Line::from(""));

    // URL field.
    let url_style = field_style(state.active_field == NewAppField::Url);
    lines.push(Line::from(Span::styled(
        "  URL (optional)",
        Style::default().fg(C::SUBTEXT1),
    )));
    lines.push(Line::from(vec![
        Span::raw("  "),
        Span::styled(
            format!("{}_", state.url),
            url_style,
        ),
    ]));
    lines.push(Line::from(""));

    // Error / success / submitting status.
    if let Some(ref err) = state.error {
        lines.push(Line::from(Span::styled(
            format!("  {err}"),
            Style::default().fg(C::RED),
        )));
    } else if let Some(ref ok) = state.success {
        lines.push(Line::from(Span::styled(
            format!("  {ok}"),
            Style::default()
                .fg(C::GREEN)
                .add_modifier(Modifier::BOLD),
        )));
    } else if state.submitting {
        lines.push(Line::from(Span::styled(
            "  Submitting...",
            Style::default().fg(C::BLUE),
        )));
    } else {
        lines.push(Line::from(""));
    }

    lines.push(Line::from(""));

    // Help bar.
    let help = if state.success.is_some() {
        "  Enter/Esc close"
    } else {
        "  Enter next/submit  Tab next  Esc cancel"
    };
    lines.push(Line::from(Span::styled(
        help,
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), centered);
}

/// Return a style for an input field — highlighted when active.
fn field_style(active: bool) -> Style {
    if active {
        Style::default()
            .fg(C::TEXT)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(C::SUBTEXT0)
    }
}

/// Compute a centered [`Rect`] of the given dimensions within `area`.
fn center_rect(width: u16, height: u16, area: Rect) -> Rect {
    let v = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(area.height.saturating_sub(height) / 2),
            Constraint::Length(height),
            Constraint::Min(0),
        ])
        .split(area);

    let h = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Length(area.width.saturating_sub(width) / 2),
            Constraint::Length(width),
            Constraint::Min(0),
        ])
        .split(v[1]);

    h[1]
}
