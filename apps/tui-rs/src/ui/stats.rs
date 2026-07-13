use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::App;
use crate::ui::theme::CatppuccinMocha as C;

const STAGES: [&str; 5] = ["applied", "interview", "offer", "rejected", "ghosted"];

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.stats;

    if state.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading statistics..."))
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

    let bar_width = (area.width as usize).saturating_sub(35).max(20);

    let total: i32 = data.funnel.values().sum();

    let mut lines: Vec<Line> = vec![
        Line::from(Span::styled(
            "Pipeline Statistics",
            Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from(Span::styled("  Funnel", Style::default().fg(C::SUBTEXT1))),
        Line::from(""),
    ];

    for &stage in &STAGES {
        let count = data.funnel.get(stage).copied().unwrap_or(0);
        let color = stage_color(stage);
        #[allow(clippy::cast_sign_loss)]
        let filled = if total > 0 {
            ((count as usize) * bar_width) / (total as usize)
        } else {
            0
        };
        let pct = if total > 0 {
            format!("{:.0}%", (f64::from(count) / f64::from(total)) * 100.0)
        } else {
            "0%".to_string()
        };

        lines.push(Line::from(vec![
            Span::styled(
                format!("  {stage:<10} "),
                Style::default().fg(color).add_modifier(Modifier::BOLD),
            ),
            Span::styled("█".repeat(filled), Style::default().fg(color)),
            Span::styled(
                format!(" {count} ({pct})"),
                Style::default().fg(C::SUBTEXT0),
            ),
        ]));
    }

    if !data.timeline.is_empty() {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "  Monthly Activity",
            Style::default().fg(C::SUBTEXT1),
        )));
        lines.push(Line::from(""));

        let max_count = data
            .timeline
            .iter()
            .map(|e| e.count)
            .max()
            .unwrap_or(1)
            .max(1);
        let timeline_bar_width = (area.width as usize).saturating_sub(25).max(10);

        for entry in &data.timeline {
            #[allow(clippy::cast_sign_loss)]
            let bar_len = ((entry.count as usize) * timeline_bar_width) / (max_count as usize);
            lines.push(Line::from(vec![
                Span::styled(
                    format!("  {}  ", entry.date),
                    Style::default().fg(C::SUBTEXT0),
                ),
                Span::styled("▓".repeat(bar_len), Style::default().fg(C::TEAL)),
                Span::styled(
                    format!(" {}", entry.count),
                    Style::default().fg(C::OVERLAY0),
                ),
            ]));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  R refresh",
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), area);
}

fn stage_color(stage: &str) -> ratatui::style::Color {
    match stage {
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
