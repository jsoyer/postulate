pub mod actions;
pub mod apps;
pub mod audit;
pub mod dashboard;
pub mod kanban;
pub mod new_app;
pub mod stats;
pub mod theme;

use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::Paragraph,
    Frame,
};

use crate::app::{App, View, TAB_NAMES};
use crate::ui::theme::CatppuccinMocha as C;

/// Render the current view to the terminal frame.
pub fn render(frame: &mut Frame, app: &App) {
    let area = frame.area();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1), // tab bar
            Constraint::Min(1),    // content
            Constraint::Length(1), // status bar
        ])
        .split(area);

    render_tab_bar(frame, app, chunks[0]);

    let content = chunks[1];
    match app.current_view {
        View::Dashboard => dashboard::render(frame, app, content),
        View::Apps | View::AppDetail => apps::render(frame, app, content),
        View::Kanban => kanban::render(frame, app, content),
        View::Actions => actions::render(frame, app, content),
        View::Stats => stats::render(frame, app, content),
        View::Audit => audit::render(frame, app, content),
        View::NewApp => new_app::render(frame, app, content),
    }

    render_status_bar(frame, app, chunks[2]);
}

fn render_tab_bar(frame: &mut Frame, app: &App, area: ratatui::layout::Rect) {
    let active_tab = app.current_view.tab_index();

    let spans: Vec<Span> = TAB_NAMES
        .iter()
        .enumerate()
        .flat_map(|(i, &name)| {
            let label = format!(" {} {} ", i + 1, name);
            if i == active_tab {
                vec![Span::styled(
                    label,
                    Style::default()
                        .fg(C::BLUE)
                        .add_modifier(Modifier::BOLD)
                        .add_modifier(Modifier::UNDERLINED),
                )]
            } else {
                vec![Span::styled(label, Style::default().fg(C::SUBTEXT0))]
            }
        })
        .collect();

    frame.render_widget(Paragraph::new(Line::from(spans)), area);
}

fn render_status_bar(frame: &mut Frame, app: &App, area: ratatui::layout::Rect) {
    let left = "  q quit  tab next  1-5 views";
    let right = format!("  {}  ", app.api.base_url());

    let gap = (area.width as usize).saturating_sub(left.len() + right.len());

    let line = Line::from(vec![
        Span::styled(left, Style::default().fg(C::SUBTEXT0)),
        Span::raw(" ".repeat(gap)),
        Span::styled(right, Style::default().fg(C::SUBTEXT0)),
    ]);

    frame.render_widget(
        Paragraph::new(line).style(Style::default().bg(C::MANTLE)),
        area,
    );
}
