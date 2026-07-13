use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{App, AuditPhase};
use crate::ui::theme::CatppuccinMocha as C;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.audit;

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

    match state.phase {
        AuditPhase::SelectApp => render_select(frame, app, area),
        AuditPhase::Running => render_running(frame, app, area),
    }
}

fn render_select(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.audit;

    let mut lines: Vec<Line> = Vec::new();

    lines.push(Line::from(Span::styled(
        "CV Health Audit",
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(Span::styled(
        "  Select an application to audit:",
        Style::default().fg(C::SUBTEXT1),
    )));
    lines.push(Line::from(""));

    if state.apps.is_empty() {
        lines.push(Line::from(Span::styled(
            "  No applications found.",
            Style::default().fg(C::OVERLAY0),
        )));
    } else {
        let visible = (area.height as usize).saturating_sub(6).max(1);
        let offset = if state.cursor >= visible {
            state.cursor - visible + 1
        } else {
            0
        };
        let end = (offset + visible).min(state.apps.len());

        for i in offset..end {
            let app_item = &state.apps[i];
            if i == state.cursor {
                lines.push(Line::from(vec![Span::styled(
                    format!("> {}", app_item.name),
                    Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
                )]));
            } else {
                lines.push(Line::from(vec![Span::raw(format!("  {}", app_item.name))]));
            }
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  j/k navigate  Enter run  Esc back",
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), area);
}

fn render_running(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.audit;

    let mut lines: Vec<Line> = Vec::new();

    lines.push(Line::from(Span::styled(
        "CV Health Audit",
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));

    // Score bar at the top when we have a result.
    if let Some(score) = state.score {
        lines.push(Line::from(""));
        render_score_bar(&mut lines, score, area.width);
    }

    // Metric bars.
    if !state.metrics.is_empty() && state.done {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "  Metrics",
            Style::default().fg(C::SUBTEXT1).add_modifier(Modifier::BOLD),
        )));
        let mut sorted_metrics: Vec<(&String, &f64)> = state.metrics.iter().collect();
        sorted_metrics.sort_by_key(|(k, _)| k.as_str());
        for (name, &value) in &sorted_metrics {
            let clamped = value.clamp(0.0, 100.0);
            render_metric_bar(&mut lines, name, clamped, area.width);
        }
    }

    // Running / done status line.
    if state.running {
        let spinner = spinner_char(app.spinner_tick);
        lines.push(Line::from(Span::styled(
            format!("  {spinner} Running..."),
            Style::default().fg(C::GREEN),
        )));
    } else if state.done {
        lines.push(Line::from(Span::styled(
            "  Audit complete",
            Style::default().fg(C::GREEN).add_modifier(Modifier::BOLD),
        )));
    }
    lines.push(Line::from(""));

    if let Some(ref err) = state.error {
        lines.push(Line::from(Span::styled(
            format!("  Error: {err}"),
            Style::default().fg(C::RED),
        )));
    }

    // Output lines — show as many as fit.
    let header_lines = lines.len();
    let max_output = (area.height as usize).saturating_sub(header_lines + 4).max(1);
    let start = if state.output.len() > max_output {
        state.output.len() - max_output
    } else {
        0
    };

    for line in &state.output[start..] {
        lines.push(Line::from(format!("  {line}")));
    }

    // Duplicates and overused words — only shown after done.
    if state.done {
        if !state.duplicates.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "  Duplicates:",
                Style::default().fg(C::PEACH).add_modifier(Modifier::BOLD),
            )));
            for item in &state.duplicates {
                lines.push(Line::from(format!("    {item}")));
            }
        }

        if !state.overused.is_empty() {
            lines.push(Line::from(""));
            lines.push(Line::from(Span::styled(
                "  Overused words:",
                Style::default().fg(C::YELLOW).add_modifier(Modifier::BOLD),
            )));
            for item in &state.overused {
                lines.push(Line::from(format!("    {item}")));
            }
        }

        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "  Esc back",
            Style::default().fg(C::OVERLAY0),
        )));
    }

    frame.render_widget(Paragraph::new(lines), area);
}

/// Render an overall health score bar into `lines`.
fn render_score_bar(lines: &mut Vec<Line>, score: u8, total_width: u16) {
    let label = "  Overall Score  ";
    // Reserve space for label and percentage text; minimum 4 bar chars.
    let bar_width = (total_width as usize)
        .saturating_sub(label.len() + 8)
        .max(4);
    let filled = (score as usize * bar_width / 100).min(bar_width);
    let empty = bar_width - filled;

    let bar_color = if score > 70 {
        C::GREEN
    } else if score > 40 {
        C::YELLOW
    } else {
        C::RED
    };

    lines.push(Line::from(vec![
        Span::styled(label, Style::default().fg(C::SUBTEXT1)),
        Span::styled(
            "\u{2588}".repeat(filled),
            Style::default().fg(bar_color),
        ),
        Span::styled(
            "\u{2591}".repeat(empty),
            Style::default().fg(C::OVERLAY0),
        ),
        Span::styled(
            format!(" {score:>3}%"),
            Style::default()
                .fg(bar_color)
                .add_modifier(Modifier::BOLD),
        ),
    ]));
}

/// Render a single metric bar into `lines`.
fn render_metric_bar(lines: &mut Vec<Line>, name: &str, value: f64, total_width: u16) {
    let label = format!("    {name:<16}");
    let bar_width = (total_width as usize)
        .saturating_sub(label.len() + 12)
        .max(4);
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let filled = ((value / 100.0) * bar_width as f64).round() as usize;
    let filled = filled.min(bar_width);
    let empty = bar_width - filled;

    let bar_color = if value > 70.0 {
        C::GREEN
    } else if value > 40.0 {
        C::YELLOW
    } else {
        C::RED
    };

    lines.push(Line::from(vec![
        Span::styled(label, Style::default().fg(C::SUBTEXT0)),
        Span::styled(
            "\u{2588}".repeat(filled),
            Style::default().fg(bar_color),
        ),
        Span::styled(
            "\u{2591}".repeat(empty),
            Style::default().fg(C::OVERLAY0),
        ),
        Span::styled(
            format!(" {value:>5.0}/100"),
            Style::default().fg(bar_color),
        ),
    ]));
}

fn spinner_char(tick: u8) -> char {
    const FRAMES: [char; 4] = ['|', '/', '-', '\\'];
    FRAMES[(tick as usize) % FRAMES.len()]
}
