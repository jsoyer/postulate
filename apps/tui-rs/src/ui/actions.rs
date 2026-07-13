use ratatui::{
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{ActionsPhase, App};
use crate::ui::theme::CatppuccinMocha as C;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.actions;

    if state.loading {
        let spinner = spinner_char(app.spinner_tick);
        let msg = Paragraph::new(format!("{spinner} Loading targets..."))
            .style(Style::default().fg(C::BLUE));
        frame.render_widget(msg, area);
        return;
    }

    if let Some(ref err) = state.error {
        if state.phase != ActionsPhase::Running {
            let msg = Paragraph::new(format!("Error: {err}")).style(Style::default().fg(C::RED));
            frame.render_widget(msg, area);
            return;
        }
    }

    match state.phase {
        ActionsPhase::SelectTarget => render_target_select(frame, app, area),
        ActionsPhase::EnterArgs => render_arg_input(frame, app, area),
        ActionsPhase::Running => render_output(frame, app, area),
    }
}

fn render_target_select(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.actions;

    let visible = (area.height as usize).saturating_sub(4).max(1);
    let offset = if state.cursor >= visible {
        state.cursor - visible + 1
    } else {
        0
    };
    let end = (offset + visible).min(state.targets.len());

    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(Span::styled(
        "Run Action",
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(""));

    for i in offset..end {
        let t = &state.targets[i];
        let cat = format!("[{}]", t.category);
        if i == state.cursor {
            lines.push(Line::from(vec![
                Span::styled(
                    format!("> {:<20} ", t.name),
                    Style::default().fg(C::BLUE).add_modifier(Modifier::BOLD),
                ),
                Span::styled(format!("{cat} "), Style::default().fg(C::OVERLAY0)),
                Span::styled(&t.description, Style::default().fg(C::BLUE)),
            ]));
        } else {
            lines.push(Line::from(vec![
                Span::raw(format!("  {:<20} ", t.name)),
                Span::styled(format!("{cat} "), Style::default().fg(C::OVERLAY0)),
                Span::raw(&t.description),
            ]));
        }
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  j/k navigate  enter select",
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), area);
}

fn render_arg_input(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.actions;

    let Some(selected_idx) = state.selected else {
        return;
    };
    if selected_idx >= state.targets.len() {
        return;
    }
    let target = &state.targets[selected_idx];

    let mut lines: Vec<Line> = Vec::new();

    lines.push(Line::from(Span::styled(
        format!("Run: {}", target.name),
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));
    lines.push(Line::from(Span::styled(
        format!("  {}", target.description),
        Style::default().fg(C::OVERLAY0),
    )));
    lines.push(Line::from(""));

    let args = target.args.as_deref().unwrap_or(&[]);
    let has_app_arg = args.contains(&"app".to_string());

    if has_app_arg {
        lines.push(Line::from(vec![
            Span::styled("  Application: ", Style::default().fg(C::SUBTEXT1)),
            Span::styled(
                format!("{}_", state.app_input),
                Style::default().fg(C::TEXT),
            ),
        ]));
    }

    for arg in args {
        if arg == "app" {
            continue;
        }
        let val = state.arg_inputs.get(arg).map_or("", String::as_str);
        lines.push(Line::from(vec![
            Span::styled(format!("  {arg}: "), Style::default().fg(C::SUBTEXT1)),
            Span::styled(format!("{val}_"), Style::default().fg(C::TEXT)),
        ]));
    }

    lines.push(Line::from(""));
    lines.push(Line::from(Span::styled(
        "  enter run  esc cancel",
        Style::default().fg(C::OVERLAY0),
    )));

    frame.render_widget(Paragraph::new(lines), area);
}

fn render_output(frame: &mut Frame, app: &App, area: Rect) {
    let state = &app.actions;

    let Some(selected_idx) = state.selected else {
        return;
    };
    let target_name = if selected_idx < state.targets.len() {
        state.targets[selected_idx].name.as_str()
    } else {
        "action"
    };

    let mut lines: Vec<Line> = Vec::new();

    lines.push(Line::from(Span::styled(
        format!("Output: {target_name}"),
        Style::default().fg(C::MAUVE).add_modifier(Modifier::BOLD),
    )));

    if state.running {
        let spinner = spinner_char(app.spinner_tick);
        lines.push(Line::from(Span::styled(
            format!("  {spinner} Running..."),
            Style::default().fg(C::GREEN),
        )));
    } else if state.done {
        lines.push(Line::from(Span::styled(
            "  Done",
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

    let max_lines = (area.height as usize)
        .saturating_sub(lines.len() + 3)
        .max(1);
    let start = if state.output.len() > max_lines {
        state.output.len() - max_lines
    } else {
        0
    };

    for line in &state.output[start..] {
        lines.push(Line::from(format!("  {line}")));
    }

    if state.done {
        lines.push(Line::from(""));
        lines.push(Line::from(Span::styled(
            "  esc back  r re-run",
            Style::default().fg(C::OVERLAY0),
        )));
    }

    frame.render_widget(Paragraph::new(lines), area);
}

fn spinner_char(tick: u8) -> char {
    const FRAMES: [char; 4] = ['|', '/', '-', '\\'];
    FRAMES[(tick as usize) % FRAMES.len()]
}
