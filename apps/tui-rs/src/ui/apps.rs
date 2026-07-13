use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::App;
use crate::ui::theme::CatppuccinMocha as C;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    // Check if we're rendering the detail view
    if app.current_view == crate::app::View::AppDetail {
        render_detail(frame, app, area);
        return;
    }

    let state = &app.apps;

    if state.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading applications..."))
            .style(Style::default().fg(C::BLUE));
        frame.render_widget(msg, area);
        return;
    }

    if let Some(ref err) = state.error {
        let msg = Paragraph::new(format!("Error: {err}")).style(Style::default().fg(C::RED));
        frame.render_widget(msg, area);
        return;
    }

    let filter_row = u16::from(state.filtering || !state.filter.is_empty());

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1 + filter_row), // title + optional filter
            Constraint::Length(1),              // blank
            Constraint::Length(1),              // header
            Constraint::Min(1),                 // rows + help
        ])
        .split(area);

    // Title row
    let count_str = format!("({})", state.filtered.len());
    let mut title_spans = vec![
        Span::styled(
            "Applications ",
            Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(count_str, Style::default().fg(C::OVERLAY0)),
    ];
    if state.filtering {
        title_spans.push(Span::raw("\n  "));
        title_spans.push(Span::styled(
            format!("/ {}_", state.filter),
            Style::default().fg(C::BLUE),
        ));
    } else if !state.filter.is_empty() {
        title_spans.push(Span::raw("\n"));
        title_spans.push(Span::styled(
            format!("  filter: {}", state.filter),
            Style::default().fg(C::OVERLAY0),
        ));
    }
    frame.render_widget(Paragraph::new(Line::from(title_spans)), chunks[0]);

    // Header
    let header = format!(
        "  {:<12} {:<10} {:<26} {}",
        "DATE", "STATUS", "COMPANY", "POSITION"
    );
    frame.render_widget(
        Paragraph::new(header).style(Style::default().fg(C::SUBTEXT1)),
        chunks[2],
    );

    // Rows + help
    let list_area = chunks[3];
    let visible_rows = (list_area.height as usize).saturating_sub(2).max(1);
    let end = (state.offset + visible_rows).min(state.filtered.len());

    let mut lines: Vec<Line> = Vec::new();

    for i in state.offset..end {
        let item = &state.filtered[i];
        let date = item.created_at.format("%Y-%m-%d").to_string();
        let status_color = status_color(item.status.as_str());
        let company = truncate(&item.company, 26);
        let position = truncate(&item.position, 30);

        if i == state.cursor {
            lines.push(Line::from(vec![Span::styled(
                format!(
                    "> {date:<12} {status:<10} {company:<26} {position}",
                    status = item.status
                ),
                Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
            )]));
        } else {
            lines.push(Line::from(vec![
                Span::styled(format!("  {date:<12} "), Style::default().fg(C::SUBTEXT0)),
                Span::styled(
                    format!("{:<10} ", item.status),
                    Style::default()
                        .fg(status_color)
                        .add_modifier(Modifier::BOLD),
                ),
                Span::raw(format!("{company:<26} {position}")),
            ]));
        }
    }

    lines.push(Line::from(""));
    let help_text = if state.filtering {
        "  esc cancel  enter apply"
    } else {
        "  j/k navigate  enter open  / filter  R refresh"
    };
    lines.push(Line::from(Span::styled(
        help_text,
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), list_area);
}

fn render_detail(frame: &mut Frame, app: &App, area: Rect) {
    let Some(ref detail) = app.app_detail else {
        return;
    };

    if detail.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading application..."))
            .style(Style::default().fg(C::BLUE));
        frame.render_widget(msg, area);
        return;
    }

    if let Some(ref err) = detail.error {
        let msg = Paragraph::new(format!("Error: {err}")).style(Style::default().fg(C::RED));
        frame.render_widget(msg, area);
        return;
    }

    let Some(ref item) = detail.app else {
        frame.render_widget(
            Paragraph::new("No data").style(Style::default().fg(C::SUBTEXT0)),
            area,
        );
        return;
    };

    let mut lines: Vec<Line> = Vec::new();

    // Title
    lines.push(Line::from(Span::styled(
        format!("{} - {}", item.company, item.position),
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(""));

    // Meta
    lines.push(Line::from(vec![
        Span::styled("  Directory:  ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(&item.name, Style::default().fg(C::OVERLAY0)),
    ]));
    let sc = status_color(item.status.as_str());
    lines.push(Line::from(vec![
        Span::styled("  Status:     ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            &item.status,
            Style::default().fg(sc).add_modifier(Modifier::BOLD),
        ),
    ]));
    lines.push(Line::from(vec![
        Span::styled("  Created:    ", Style::default().fg(C::SUBTEXT1)),
        Span::raw(item.created_at.format("%Y-%m-%d %H:%M").to_string()),
    ]));
    if let Some(deadline) = item.deadline {
        lines.push(Line::from(vec![
            Span::styled("  Deadline:   ", Style::default().fg(C::SUBTEXT1)),
            Span::raw(deadline.format("%Y-%m-%d").to_string()),
        ]));
    }
    if let Some(ref outcome) = item.outcome {
        if !outcome.is_empty() {
            lines.push(Line::from(vec![
                Span::styled("  Outcome:    ", Style::default().fg(C::SUBTEXT1)),
                Span::raw(outcome.as_str()),
            ]));
        }
    }

    // Files
    if let Some(ref files) = item.files {
        if !files.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "  Files",
                Style::default().fg(C::SUBTEXT1),
            )));
            let mut file_names: Vec<&String> = files.keys().collect();
            file_names.sort();
            for name in file_names {
                let size = files[name].len();
                #[allow(clippy::cast_precision_loss)]
                let size_str = if size > 1024 {
                    format!("{:.1} KB", size as f64 / 1024.0)
                } else {
                    format!("{size} B")
                };
                let icon_color = file_icon_color(name);
                lines.push(Line::from(vec![
                    Span::styled("  * ", Style::default().fg(icon_color)),
                    Span::raw(format!("{name}  ")),
                    Span::styled(size_str, Style::default().fg(C::OVERLAY0)),
                ]));
            }
        }
    }

    lines.push(Line::from(""));
    // Action quick-launch bar.
    lines.push(Line::from(Span::styled(
        "  Actions:",
        Style::default()
            .fg(C::SUBTEXT1)
            .add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(vec![
        Span::styled(
            "  t",
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Tailor  ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "v",
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Review  ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "b",
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Build   ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "s",
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Score   ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "p",
            Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Prep    ", Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "a",
            Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
        ),
        Span::styled(" Audit", Style::default().fg(C::SUBTEXT1)),
    ]));
    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  n new  esc back  R refresh",
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), area);
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

fn file_icon_color(name: &str) -> ratatui::style::Color {
    use std::path::Path;
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "yml" | "yaml" => C::YELLOW,
        "md" => C::BLUE,
        "txt" => C::SUBTEXT0,
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
