use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::App;
use crate::ui::theme::CatppuccinMocha as C;

#[allow(clippy::too_many_lines)]
pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.dashboard;

    if state.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading dashboard..."))
            .style(Style::default().fg(C::BLUE));
        frame.render_widget(msg, area);
        return;
    }

    if let Some(ref err) = state.error {
        let msg = Paragraph::new(format!("Error: {err}")).style(Style::default().fg(C::RED));
        frame.render_widget(msg, area);
        return;
    }

    let Some(ref data) = state.data else {
        frame.render_widget(
            Paragraph::new("No data").style(Style::default().fg(C::SUBTEXT0)),
            area,
        );
        return;
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2), // title
            Constraint::Length(1), // total
            Constraint::Length(1), // blank
            Constraint::Length(1), // pipeline subtitle
            Constraint::Length(5), // 5 status bars
            Constraint::Length(1), // blank
            Constraint::Length(1), // recent subtitle
            Constraint::Min(0),    // recent list + help
        ])
        .split(area);

    // Title
    let title = Paragraph::new("Dashboard")
        .style(Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD));
    frame.render_widget(title, chunks[0]);

    // Total
    let total_line = Line::from(vec![
        Span::raw("  Total applications: "),
        Span::styled(
            data.total_applications.to_string(),
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
    ]);
    frame.render_widget(Paragraph::new(total_line), chunks[1]);

    // Pipeline subtitle
    let subtitle = Paragraph::new("  Pipeline").style(Style::default().fg(C::SUBTEXT1));
    frame.render_widget(subtitle, chunks[3]);

    // Status bars
    let statuses = ["applied", "interview", "offer", "rejected", "ghosted"];
    let status_colors = [C::BLUE, C::YELLOW, C::GREEN, C::RED, C::OVERLAY0];
    let bar_width = (area.width as usize).saturating_sub(35).max(20);

    let bar_lines: Vec<Line> = statuses
        .iter()
        .zip(status_colors.iter())
        .map(|(&status, &color)| {
            let count = data.by_status.get(status).copied().unwrap_or(0);
            #[allow(clippy::cast_sign_loss)]
            let total = data.total_applications.max(1) as usize;
            #[allow(clippy::cast_sign_loss)]
            let filled = ((count as usize) * bar_width) / total;
            let filled = filled.min(bar_width);
            let empty = bar_width - filled;

            Line::from(vec![
                Span::styled(
                    format!("  {status:<10}"),
                    Style::default().fg(color).add_modifier(Modifier::BOLD),
                ),
                Span::styled("█".repeat(filled), Style::default().fg(color)),
                Span::styled("░".repeat(empty), Style::default().fg(C::OVERLAY0)),
                Span::styled(format!(" {count}"), Style::default().fg(C::SUBTEXT0)),
            ])
        })
        .collect();

    let bars = Paragraph::new(bar_lines);
    frame.render_widget(bars, chunks[4]);

    // Recent applications subtitle
    let recent_sub =
        Paragraph::new("  Recent Applications").style(Style::default().fg(C::SUBTEXT1));
    frame.render_widget(recent_sub, chunks[6]);

    // Recent list + help
    let recent_area = chunks[7];
    let available_lines = recent_area.height as usize;
    let help_height = 1usize;
    let list_height = available_lines.saturating_sub(help_height + 1);

    let limit = list_height.min(data.recent_applications.len()).min(8);
    let mut lines: Vec<Line> = Vec::with_capacity(limit + 2);

    for app_item in data.recent_applications.iter().take(limit) {
        let created = app_item.created_at.format("%Y-%m-%d").to_string();
        let status_color = status_color(app_item.status.as_str());
        lines.push(Line::from(vec![
            Span::styled(format!("  {created}  "), Style::default().fg(C::OVERLAY0)),
            Span::styled(
                format!("{:<10}", app_item.status.as_str()),
                Style::default()
                    .fg(status_color)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                format!("  {} - {}", app_item.company, app_item.position),
                Style::default().fg(C::TEXT),
            ),
        ]));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(vec![Span::styled(
        "  R refresh",
        Style::default().fg(C::OVERLAY0),
    )]));

    let recent = Paragraph::new(lines);
    frame.render_widget(recent, recent_area);
}

fn status_color(status: &str) -> ratatui::style::Color {
    match status {
        "applied" => C::BLUE,
        "interview" => C::YELLOW,
        "offer" => C::GREEN,
        "rejected" => C::RED,
        _ => C::OVERLAY0,
    }
}

fn spinner_char(tick: u8) -> char {
    const FRAMES: [char; 4] = ['|', '/', '-', '\\'];
    FRAMES[(tick as usize) % FRAMES.len()]
}
