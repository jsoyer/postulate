use std::collections::HashMap;

use tokio::sync::mpsc;

use crate::api::{
    models::{Application, DashboardData, StatsData, Target},
    ApiClient,
};
use crate::events::Action;

/// Which top-level view is currently displayed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum View {
    Dashboard = 0,
    Apps = 1,
    AppDetail = 2,
    Kanban = 3,
    Actions = 4,
    Stats = 5,
    /// Overlay view: run the audit Make target and display health results.
    Audit = 6,
    /// Overlay view: inline form to create a new application.
    NewApp = 7,
}

impl View {
    pub fn tab_index(self) -> usize {
        match self {
            View::Dashboard => 0,
            View::Apps | View::AppDetail => 1,
            View::Kanban => 2,
            View::Actions => 3,
            View::Stats => 4,
            // Overlay views: keep highlighting Stats tab while they're open.
            View::Audit | View::NewApp => 4,
        }
    }
}

/// The tab order for cycling with Tab key.
const TAB_ORDER: [View; 5] = [
    View::Dashboard,
    View::Apps,
    View::Kanban,
    View::Actions,
    View::Stats,
];

pub const TAB_NAMES: [&str; 5] = ["Dashboard", "Applications", "Kanban", "Actions", "Stats"];

// ---------------------------------------------------------------------------
// Per-view state structs
// ---------------------------------------------------------------------------

pub struct DashboardState {
    pub data: Option<DashboardData>,
    pub loading: bool,
    pub error: Option<String>,
}

impl Default for DashboardState {
    fn default() -> Self {
        Self {
            data: None,
            loading: true,
            error: None,
        }
    }
}

pub struct AppsState {
    pub apps: Vec<Application>,
    pub filtered: Vec<Application>,
    pub cursor: usize,
    pub offset: usize,
    pub loading: bool,
    pub error: Option<String>,
    pub filtering: bool,
    pub filter: String,
}

impl Default for AppsState {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            filtered: Vec::new(),
            cursor: 0,
            offset: 0,
            loading: true,
            error: None,
            filtering: false,
            filter: String::new(),
        }
    }
}

impl AppsState {
    pub fn apply_filter(&mut self) {
        let q = self.filter.to_lowercase();
        if q.is_empty() {
            self.filtered = self.apps.clone();
        } else {
            self.filtered = self
                .apps
                .iter()
                .filter(|a| {
                    a.company.to_lowercase().contains(&q)
                        || a.position.to_lowercase().contains(&q)
                        || a.name.to_lowercase().contains(&q)
                })
                .cloned()
                .collect();
        }
        self.cursor = 0;
        self.offset = 0;
    }

    pub fn ensure_visible(&mut self, visible_rows: usize) {
        if self.cursor < self.offset {
            self.offset = self.cursor;
        }
        if self.cursor >= self.offset + visible_rows {
            self.offset = self.cursor.saturating_sub(visible_rows) + 1;
        }
    }
}

pub struct AppDetailState {
    pub name: String,
    pub app: Option<Application>,
    pub loading: bool,
    pub error: Option<String>,
}

impl AppDetailState {
    pub fn new(name: String) -> Self {
        Self {
            name,
            app: None,
            loading: true,
            error: None,
        }
    }
}

pub struct KanbanState {
    pub apps: Vec<Application>,
    pub by_status: HashMap<String, Vec<Application>>,
    pub col: usize,
    pub row: usize,
    pub loading: bool,
    pub error: Option<String>,
}

impl Default for KanbanState {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            by_status: HashMap::new(),
            col: 0,
            row: 0,
            loading: true,
            error: None,
        }
    }
}

impl KanbanState {
    pub fn rebuild_by_status(&mut self) {
        self.by_status.clear();
        for app in &self.apps {
            self.by_status
                .entry(app.status.clone())
                .or_default()
                .push(app.clone());
        }
    }

    pub fn clamp_row(&mut self, columns: &[&str]) {
        if self.col < columns.len() {
            let col_len = self.by_status.get(columns[self.col]).map_or(0, Vec::len);
            if col_len == 0 {
                self.row = 0;
            } else if self.row >= col_len {
                self.row = col_len - 1;
            }
        }
    }
}

/// Phase of the actions runner.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionsPhase {
    SelectTarget,
    EnterArgs,
    Running,
}

pub struct ActionsState {
    pub targets: Vec<Target>,
    pub cursor: usize,
    pub selected: Option<usize>,
    pub phase: ActionsPhase,
    pub app_input: String,
    pub arg_inputs: HashMap<String, String>,
    pub output: Vec<String>,
    pub running: bool,
    pub done: bool,
    pub loading: bool,
    pub error: Option<String>,
    pub prefill_app: String,
}

impl Default for ActionsState {
    fn default() -> Self {
        Self {
            targets: Vec::new(),
            cursor: 0,
            selected: None,
            phase: ActionsPhase::SelectTarget,
            app_input: String::new(),
            arg_inputs: HashMap::new(),
            output: Vec::new(),
            running: false,
            done: false,
            loading: true,
            error: None,
            prefill_app: String::new(),
        }
    }
}

pub struct StatsState {
    pub data: Option<StatsData>,
    pub loading: bool,
    pub error: Option<String>,
}

impl Default for StatsState {
    fn default() -> Self {
        Self {
            data: None,
            loading: true,
            error: None,
        }
    }
}

/// Phase of the audit view.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditPhase {
    /// Browsing the list of applications to choose one.
    SelectApp,
    /// Audit is running; output is streaming in.
    Running,
}

pub struct AuditState {
    pub apps: Vec<Application>,
    pub cursor: usize,
    pub phase: AuditPhase,
    pub output: Vec<String>,
    pub score: Option<u8>,
    pub metrics: HashMap<String, f64>,
    pub duplicates: Vec<String>,
    pub overused: Vec<String>,
    pub loading: bool,
    pub running: bool,
    pub done: bool,
    pub error: Option<String>,
}

impl Default for AuditState {
    fn default() -> Self {
        Self {
            apps: Vec::new(),
            cursor: 0,
            phase: AuditPhase::SelectApp,
            output: Vec::new(),
            score: None,
            metrics: HashMap::new(),
            duplicates: Vec::new(),
            overused: Vec::new(),
            loading: true,
            running: false,
            done: false,
            error: None,
        }
    }
}

/// Which field the cursor is on in the New Application form.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NewAppField {
    Company,
    Position,
    Url,
}

pub struct NewAppState {
    pub company: String,
    pub position: String,
    pub url: String,
    pub active_field: NewAppField,
    pub submitting: bool,
    pub error: Option<String>,
    pub success: Option<String>,
}

impl Default for NewAppState {
    fn default() -> Self {
        Self {
            company: String::new(),
            position: String::new(),
            url: String::new(),
            active_field: NewAppField::Company,
            submitting: false,
            error: None,
            success: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Messages sent back from async tasks
// ---------------------------------------------------------------------------

pub enum AppMsg {
    DashboardLoaded(DashboardData),
    DashboardError(String),
    AppsLoaded(Vec<Application>),
    AppsError(String),
    AppDetailLoaded(Application),
    AppDetailError(String),
    KanbanLoaded(Vec<Application>),
    KanbanError(String),
    TargetsLoaded(Vec<Target>),
    TargetsError(String),
    ActionOutput(String),
    ActionDone,
    ActionError(String),
    StatsLoaded(StatsData),
    StatsError(String),
    // Audit view messages.
    AuditAppsLoaded(Vec<Application>),
    AuditAppsError(String),
    AuditOutput(String),
    AuditDone {
        score: Option<f64>,
        metrics: HashMap<String, f64>,
        duplicates: Vec<String>,
        overused: Vec<String>,
    },
    AuditError(String),
    /// A new application was successfully created.
    AppCreated(Application),
    /// Application creation failed.
    AppCreateError(String),
    /// Result of a health-check probe (`true` = reachable).
    HealthStatus(bool),
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

#[allow(clippy::struct_field_names)]
pub struct App {
    pub current_view: View,
    pub prev_view: View,
    pub running: bool,
    pub api: ApiClient,
    pub width: u16,
    pub height: u16,
    pub spinner_tick: u8,

    pub dashboard: DashboardState,
    pub apps: AppsState,
    pub app_detail: Option<AppDetailState>,
    pub kanban: KanbanState,
    pub actions: ActionsState,
    pub stats: StatsState,
    pub audit: AuditState,
    pub new_app: NewAppState,

    /// Channel receiver for messages from async tasks.
    pub rx: mpsc::UnboundedReceiver<AppMsg>,
    /// Sender cloned into spawned tasks.
    pub tx: mpsc::UnboundedSender<AppMsg>,

    initialized: [bool; 5],
}

impl App {
    pub fn new(api: ApiClient) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            current_view: View::Dashboard,
            prev_view: View::Dashboard,
            running: true,
            api,
            width: 80,
            height: 24,
            spinner_tick: 0,
            dashboard: DashboardState::default(),
            apps: AppsState::default(),
            app_detail: None,
            kanban: KanbanState::default(),
            actions: ActionsState::default(),
            stats: StatsState::default(),
            audit: AuditState::default(),
            new_app: NewAppState::default(),
            rx,
            tx,
            initialized: [false; 5],
        }
    }

    /// Drain all pending messages from async tasks and apply them.
    pub fn drain_messages(&mut self) {
        while let Ok(msg) = self.rx.try_recv() {
            self.apply_msg(msg);
        }
    }

    fn apply_msg(&mut self, msg: AppMsg) {
        match msg {
            AppMsg::DashboardLoaded(data) => {
                self.dashboard.data = Some(data);
                self.dashboard.loading = false;
                self.dashboard.error = None;
            }
            AppMsg::DashboardError(e) => {
                self.dashboard.error = Some(e);
                self.dashboard.loading = false;
            }
            AppMsg::AppsLoaded(apps) => {
                self.apps.apps = apps;
                self.apps.filtered = self.apps.apps.clone();
                self.apps.loading = false;
                self.apps.error = None;
                self.apps.cursor = 0;
                self.apps.offset = 0;
            }
            AppMsg::AppsError(e) => {
                self.apps.error = Some(e);
                self.apps.loading = false;
            }
            AppMsg::AppDetailLoaded(app) => {
                if let Some(ref mut state) = self.app_detail {
                    state.app = Some(app);
                    state.loading = false;
                    state.error = None;
                }
            }
            AppMsg::AppDetailError(e) => {
                if let Some(ref mut state) = self.app_detail {
                    state.error = Some(e);
                    state.loading = false;
                }
            }
            AppMsg::KanbanLoaded(apps) => {
                self.kanban.apps = apps;
                self.kanban.rebuild_by_status();
                self.kanban.loading = false;
                self.kanban.error = None;
            }
            AppMsg::KanbanError(e) => {
                self.kanban.error = Some(e);
                self.kanban.loading = false;
            }
            AppMsg::TargetsLoaded(targets) => {
                self.actions.targets = targets;
                self.actions.loading = false;
                self.actions.error = None;
            }
            AppMsg::TargetsError(e) => {
                self.actions.error = Some(e);
                self.actions.loading = false;
            }
            AppMsg::ActionOutput(line) => {
                if self.actions.output.len() < 10_000 {
                    self.actions.output.push(line);
                }
            }
            AppMsg::ActionDone => {
                self.actions.running = false;
                self.actions.done = true;
            }
            AppMsg::ActionError(e) => {
                self.actions.error = Some(e);
                self.actions.running = false;
            }
            AppMsg::StatsLoaded(data) => {
                self.stats.data = Some(data);
                self.stats.loading = false;
                self.stats.error = None;
            }
            AppMsg::StatsError(e) => {
                self.stats.error = Some(e);
                self.stats.loading = false;
            }
            AppMsg::AuditAppsLoaded(apps) => {
                // Check if we have a prefill name staged in the error field.
                let prefill = self
                    .audit
                    .error
                    .as_deref()
                    .and_then(|e| e.strip_prefix("__prefill__"))
                    .map(str::to_string);

                self.audit.apps = apps;
                self.audit.loading = false;
                self.audit.error = None;

                // If a prefill name was staged, find and set the cursor.
                if let Some(name) = prefill {
                    if let Some(idx) = self.audit.apps.iter().position(|a| a.name == name) {
                        self.audit.cursor = idx;
                    }
                }
            }
            AppMsg::AuditAppsError(e) => {
                self.audit.error = Some(e);
                self.audit.loading = false;
            }
            AppMsg::AuditOutput(line) => {
                self.audit.output.push(line);
            }
            AppMsg::AuditDone {
                score,
                metrics,
                duplicates,
                overused,
            } => {
                if let Some(s) = score {
                    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                    let clamped = (s.clamp(0.0, 100.0) as u8).min(100);
                    self.audit.score = Some(clamped);
                }
                self.audit.metrics = metrics;
                self.audit.duplicates = duplicates;
                self.audit.overused = overused;
                self.audit.running = false;
                self.audit.done = true;
            }
            AppMsg::AuditError(e) => {
                self.audit.error = Some(e);
                self.audit.running = false;
            }
            AppMsg::AppCreated(app) => {
                self.new_app.submitting = false;
                self.new_app.success = Some(format!("Created: {}", app.name));
                self.new_app.error = None;
                // Refresh the apps list so the new entry appears.
                self.fetch_apps();
            }
            AppMsg::AppCreateError(e) => {
                self.new_app.submitting = false;
                self.new_app.error = Some(e);
            }
            AppMsg::HealthStatus(_healthy) => {
                // Health status is informational; future views may display it.
            }
        }
    }

    /// Switch to a view, triggering a data fetch if it has not been initialized.
    pub fn switch_view(&mut self, view: View) {
        if view == self.current_view {
            return;
        }
        self.prev_view = self.current_view;
        self.current_view = view;

        // Overlay views handle their own initialization separately.
        if matches!(view, View::Audit | View::NewApp) {
            return;
        }

        let idx = view.tab_index();
        if !self.initialized[idx] {
            self.initialized[idx] = true;
            self.fetch_for_view(view);
        }
    }

    /// Fetch data for the given view.
    fn fetch_for_view(&mut self, view: View) {
        match view {
            View::Dashboard => self.fetch_dashboard(),
            View::Apps => self.fetch_apps(),
            View::AppDetail => {
                if let Some(ref state) = self.app_detail {
                    self.fetch_app_detail(state.name.clone());
                }
            }
            View::Kanban => self.fetch_kanban(),
            View::Actions => self.fetch_targets(),
            View::Stats => self.fetch_stats(),
            // Overlay views are handled outside switch_view.
            View::Audit | View::NewApp => {}
        }
    }

    /// Initialize the first view on startup.
    pub fn init(&mut self) {
        self.initialized[View::Dashboard.tab_index()] = true;
        self.fetch_dashboard();
    }

    pub fn next_tab(&mut self) {
        let current_tab = self.current_view.tab_index();
        let next_idx = (current_tab + 1) % TAB_ORDER.len();
        self.switch_view(TAB_ORDER[next_idx]);
    }

    /// Handle a mapped action from the event loop.
    pub fn handle_action(&mut self, action: Action) {
        match action {
            Action::Quit | Action::ForceQuit => {
                self.running = false;
            }
            Action::Tab => self.next_tab(),
            Action::JumpToView(idx) => {
                if idx < TAB_ORDER.len() {
                    self.switch_view(TAB_ORDER[idx]);
                }
            }
            Action::Back => self.handle_back(),
            Action::Refresh => self.handle_refresh(),
            Action::Up => self.handle_up(),
            Action::Down => self.handle_down(),
            Action::Left => self.handle_left(),
            Action::Right => self.handle_right(),
            Action::Top => self.handle_top(),
            Action::Bottom => self.handle_bottom(),
            Action::Select => self.handle_select(),
            Action::Filter => self.handle_filter(),
            Action::New => self.handle_new(),
            Action::Tailor => self.launch_action_for_target("tailor"),
            Action::Review => self.launch_action_for_target("review"),
            Action::Build => self.launch_action_for_target("app"),
            Action::Score => self.launch_action_for_target("score"),
            Action::Prep => self.launch_action_for_target("prep"),
            Action::Audit => self.handle_launch_audit(),
            _ => {}
        }
    }

    /// Handle typed character input when filtering in apps view or entering new-app fields.
    pub fn handle_filter_char(&mut self, ch: char) {
        if self.current_view == View::Apps && self.apps.filtering {
            self.apps.filter.push(ch);
            self.apps.apply_filter();
        } else if self.current_view == View::Actions
            && self.actions.phase == ActionsPhase::EnterArgs
        {
            self.actions.app_input.push(ch);
        } else if self.current_view == View::NewApp {
            match self.new_app.active_field {
                NewAppField::Company => {
                    if self.new_app.company.len() < 200 {
                        self.new_app.company.push(ch);
                    }
                }
                NewAppField::Position => {
                    if self.new_app.position.len() < 200 {
                        self.new_app.position.push(ch);
                    }
                }
                NewAppField::Url => {
                    if self.new_app.url.len() < 200 {
                        self.new_app.url.push(ch);
                    }
                }
            }
        }
    }

    pub fn handle_backspace(&mut self) {
        if self.current_view == View::Apps && self.apps.filtering {
            self.apps.filter.pop();
            self.apps.apply_filter();
        } else if self.current_view == View::Actions
            && self.actions.phase == ActionsPhase::EnterArgs
        {
            self.actions.app_input.pop();
        } else if self.current_view == View::NewApp {
            match self.new_app.active_field {
                NewAppField::Company => {
                    self.new_app.company.pop();
                }
                NewAppField::Position => {
                    self.new_app.position.pop();
                }
                NewAppField::Url => {
                    self.new_app.url.pop();
                }
            }
        }
    }

    fn handle_back(&mut self) {
        match self.current_view {
            View::AppDetail => {
                self.current_view = View::Apps;
            }
            View::Apps if self.apps.filtering => {
                self.apps.filtering = false;
                self.apps.filter.clear();
                self.apps.apply_filter();
            }
            View::Actions if self.actions.phase == ActionsPhase::EnterArgs => {
                self.actions.phase = ActionsPhase::SelectTarget;
                self.actions.selected = None;
            }
            View::Actions if self.actions.phase == ActionsPhase::Running => {
                self.actions.phase = ActionsPhase::SelectTarget;
                self.actions.selected = None;
                self.actions.output.clear();
                self.actions.done = false;
                self.actions.error = None;
            }
            View::Audit => {
                self.current_view = self.prev_view;
            }
            View::NewApp => {
                self.current_view = self.prev_view;
            }
            _ => {}
        }
    }

    fn handle_refresh(&mut self) {
        match self.current_view {
            View::Dashboard => {
                self.dashboard.loading = true;
                self.dashboard.error = None;
                self.fetch_dashboard();
            }
            View::Apps => {
                self.apps.loading = true;
                self.apps.error = None;
                self.fetch_apps();
            }
            View::AppDetail => {
                if let Some(ref state) = self.app_detail {
                    let name = state.name.clone();
                    if let Some(ref mut s) = self.app_detail {
                        s.loading = true;
                        s.error = None;
                    }
                    self.fetch_app_detail(name);
                }
            }
            View::Kanban => {
                self.kanban.loading = true;
                self.kanban.error = None;
                self.fetch_kanban();
            }
            View::Actions => {
                self.actions.loading = true;
                self.actions.error = None;
                self.fetch_targets();
            }
            View::Stats => {
                self.stats.loading = true;
                self.stats.error = None;
                self.fetch_stats();
            }
            View::Audit => {
                self.audit.loading = true;
                self.audit.error = None;
                self.fetch_audit_apps();
            }
            View::NewApp => {}
        }
    }

    fn handle_up(&mut self) {
        match self.current_view {
            View::Apps if !self.apps.filtering => {
                if self.apps.cursor > 0 {
                    self.apps.cursor -= 1;
                    let visible = self.visible_app_rows();
                    self.apps.ensure_visible(visible);
                }
            }
            View::Kanban => {
                if self.kanban.row > 0 {
                    self.kanban.row -= 1;
                }
            }
            View::Actions if self.actions.phase == ActionsPhase::SelectTarget => {
                if self.actions.cursor > 0 {
                    self.actions.cursor -= 1;
                }
            }
            View::Audit if self.audit.phase == AuditPhase::SelectApp => {
                if self.audit.cursor > 0 {
                    self.audit.cursor -= 1;
                }
            }
            _ => {}
        }
    }

    fn handle_down(&mut self) {
        match self.current_view {
            View::Apps if !self.apps.filtering => {
                if self.apps.cursor + 1 < self.apps.filtered.len() {
                    self.apps.cursor += 1;
                    let visible = self.visible_app_rows();
                    self.apps.ensure_visible(visible);
                }
            }
            View::Kanban => {
                let columns = ["applied", "interview", "offer", "rejected", "ghosted"];
                if self.kanban.col < columns.len() {
                    let col_len = self
                        .kanban
                        .by_status
                        .get(columns[self.kanban.col])
                        .map_or(0, Vec::len);
                    if self.kanban.row + 1 < col_len {
                        self.kanban.row += 1;
                    }
                }
            }
            View::Actions if self.actions.phase == ActionsPhase::SelectTarget => {
                if self.actions.cursor + 1 < self.actions.targets.len() {
                    self.actions.cursor += 1;
                }
            }
            View::Audit if self.audit.phase == AuditPhase::SelectApp => {
                if self.audit.cursor + 1 < self.audit.apps.len() {
                    self.audit.cursor += 1;
                }
            }
            _ => {}
        }
    }

    fn handle_left(&mut self) {
        if self.current_view == View::Kanban && self.kanban.col > 0 {
            self.kanban.col -= 1;
            let columns = ["applied", "interview", "offer", "rejected", "ghosted"];
            self.kanban.clamp_row(&columns);
        }
    }

    fn handle_right(&mut self) {
        if self.current_view == View::Kanban {
            let columns = ["applied", "interview", "offer", "rejected", "ghosted"];
            if self.kanban.col + 1 < columns.len() {
                self.kanban.col += 1;
                self.kanban.clamp_row(&columns);
            }
        }
    }

    fn handle_top(&mut self) {
        match self.current_view {
            View::Apps => {
                self.apps.cursor = 0;
                self.apps.offset = 0;
            }
            View::Actions if self.actions.phase == ActionsPhase::SelectTarget => {
                self.actions.cursor = 0;
            }
            _ => {}
        }
    }

    fn handle_bottom(&mut self) {
        match self.current_view {
            View::Apps => {
                let len = self.apps.filtered.len();
                if len > 0 {
                    self.apps.cursor = len - 1;
                    let visible = self.visible_app_rows();
                    self.apps.ensure_visible(visible);
                }
            }
            View::Actions if self.actions.phase == ActionsPhase::SelectTarget => {
                let len = self.actions.targets.len();
                if len > 0 {
                    self.actions.cursor = len - 1;
                }
            }
            _ => {}
        }
    }

    fn handle_select(&mut self) {
        match self.current_view {
            View::Apps if !self.apps.filtering => {
                if self.apps.cursor < self.apps.filtered.len() {
                    let app = self.apps.filtered[self.apps.cursor].clone();
                    let name = app.name.clone();
                    self.app_detail = Some(AppDetailState::new(name.clone()));
                    self.prev_view = self.current_view;
                    self.current_view = View::AppDetail;
                    self.fetch_app_detail(name);
                }
            }
            View::Apps if self.apps.filtering => {
                self.apps.filtering = false;
            }
            View::Actions if self.actions.phase == ActionsPhase::SelectTarget => {
                if self.actions.cursor < self.actions.targets.len() {
                    self.actions.selected = Some(self.actions.cursor);
                    let target = &self.actions.targets[self.actions.cursor];
                    let has_args = target.args.as_ref().is_some_and(|a| !a.is_empty());
                    if has_args {
                        self.actions.phase = ActionsPhase::EnterArgs;
                        self.actions.app_input.clear();
                        self.actions.arg_inputs.clear();
                        if !self.actions.prefill_app.is_empty() {
                            self.actions.app_input = self.actions.prefill_app.clone();
                        }
                    } else {
                        self.actions.phase = ActionsPhase::Running;
                        self.actions.running = true;
                        self.actions.done = false;
                        self.actions.output.clear();
                        self.actions.error = None;
                        self.spawn_action();
                    }
                }
            }
            View::Actions if self.actions.phase == ActionsPhase::EnterArgs => {
                self.actions.phase = ActionsPhase::Running;
                self.actions.running = true;
                self.actions.done = false;
                self.actions.output.clear();
                self.actions.error = None;
                self.spawn_action();
            }
            View::Audit if self.audit.phase == AuditPhase::SelectApp => {
                if self.audit.cursor < self.audit.apps.len() {
                    self.audit.phase = AuditPhase::Running;
                    self.audit.running = true;
                    self.audit.done = false;
                    self.audit.output.clear();
                    self.audit.score = None;
                    self.audit.metrics.clear();
                    self.audit.duplicates.clear();
                    self.audit.overused.clear();
                    self.audit.error = None;
                    self.spawn_audit();
                }
            }
            View::NewApp => {
                self.advance_new_app_field();
            }
            _ => {}
        }
    }

    fn handle_filter(&mut self) {
        if self.current_view == View::Apps {
            self.apps.filtering = true;
        }
    }

    fn visible_app_rows(&self) -> usize {
        (self.height as usize).saturating_sub(8).max(1)
    }

    // -----------------------------------------------------------------------
    // Async task spawners
    // -----------------------------------------------------------------------

    fn fetch_dashboard(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.get_dashboard().await {
                Ok(data) => {
                    let _ = tx.send(AppMsg::DashboardLoaded(data));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::DashboardError(e.to_string()));
                }
            }
        });
    }

    fn fetch_apps(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.list_applications().await {
                Ok(apps) => {
                    let _ = tx.send(AppMsg::AppsLoaded(apps));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::AppsError(e.to_string()));
                }
            }
        });
    }

    fn fetch_app_detail(&self, name: String) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.get_application(&name).await {
                Ok(app) => {
                    let _ = tx.send(AppMsg::AppDetailLoaded(app));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::AppDetailError(e.to_string()));
                }
            }
        });
    }

    fn fetch_kanban(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.list_applications().await {
                Ok(apps) => {
                    let _ = tx.send(AppMsg::KanbanLoaded(apps));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::KanbanError(e.to_string()));
                }
            }
        });
    }

    fn fetch_targets(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.list_targets().await {
                Ok(targets) => {
                    let _ = tx.send(AppMsg::TargetsLoaded(targets));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::TargetsError(e.to_string()));
                }
            }
        });
    }

    fn fetch_stats(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.get_stats().await {
                Ok(data) => {
                    let _ = tx.send(AppMsg::StatsLoaded(data));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::StatsError(e.to_string()));
                }
            }
        });
    }

    /// Try to stream the selected action over WebSocket, falling back to a
    /// blocking HTTP call if the WebSocket connection cannot be established.
    ///
    /// This is the main entry point used by [`handle_select`] when the user
    /// confirms an action.
    fn spawn_action(&self) {
        self.spawn_stream_action();
    }

    /// Spawn a task that streams action output via WebSocket and falls back to
    /// HTTP `execute_action` on connection failure.
    ///
    /// Messages are forwarded directly into the app channel:
    /// - [`AppMsg::ActionOutput`] for each line of stdout/stderr
    /// - [`AppMsg::ActionDone`] on clean completion
    /// - [`AppMsg::ActionError`] on error
    pub fn spawn_stream_action(&self) {
        let Some(selected_idx) = self.actions.selected else {
            return;
        };
        if selected_idx >= self.actions.targets.len() {
            return;
        }

        let target = self.actions.targets[selected_idx].clone();
        let app_name = if self.actions.app_input.is_empty() {
            None
        } else {
            Some(self.actions.app_input.clone())
        };
        let args = self.actions.arg_inputs.clone();
        let tx = self.tx.clone();
        let client = self.api.clone();

        tokio::spawn(async move {
            // Attempt WebSocket streaming first.
            let ws_result = client
                .stream_action(&target.name, app_name.as_deref(), tx.clone())
                .await;

            if let Err(ws_err) = ws_result {
                // WebSocket failed — fall back to blocking HTTP execute_action.
                let args_map = if args.is_empty() { None } else { Some(args) };
                match client
                    .execute_action(&target.name, app_name.as_deref(), args_map)
                    .await
                {
                    Ok(result) => {
                        if let Some(stdout) = result.stdout {
                            if !stdout.is_empty() {
                                for line in stdout.lines() {
                                    let _ = tx.send(AppMsg::ActionOutput(line.to_string()));
                                }
                            }
                        }
                        if let Some(stderr) = result.stderr {
                            if !stderr.is_empty() {
                                for line in stderr.lines() {
                                    let _ = tx.send(AppMsg::ActionOutput(line.to_string()));
                                }
                            }
                        }
                        let _ = tx.send(AppMsg::ActionDone);
                    }
                    Err(http_err) => {
                        // Report both transport errors so the user can diagnose.
                        let msg =
                            format!("WebSocket: {ws_err}; HTTP fallback: {http_err}");
                        let _ = tx.send(AppMsg::ActionError(msg));
                    }
                }
            }
        });
    }

    /// Fetch the application list for the Audit view.
    fn fetch_audit_apps(&self) {
        let tx = self.tx.clone();
        let client = self.api.clone();
        tokio::spawn(async move {
            match client.list_applications().await {
                Ok(apps) => {
                    let _ = tx.send(AppMsg::AuditAppsLoaded(apps));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::AuditAppsError(e.to_string()));
                }
            }
        });
    }

    /// Execute the "audit" target for the currently selected app in `self.audit`.
    fn spawn_audit(&self) {
        if self.audit.cursor >= self.audit.apps.len() {
            return;
        }
        let app_name = self.audit.apps[self.audit.cursor].name.clone();
        let tx = self.tx.clone();
        let client = self.api.clone();

        tokio::spawn(async move {
            match client
                .execute_action("audit", Some(app_name.as_str()), None)
                .await
            {
                Ok(result) => {
                    let mut combined = String::new();

                    if let Some(stdout) = &result.stdout {
                        if !stdout.is_empty() {
                            for line in stdout.lines() {
                                let _ = tx.send(AppMsg::AuditOutput(line.to_string()));
                            }
                            combined.push_str(stdout);
                        }
                    }
                    if let Some(stderr) = &result.stderr {
                        if !stderr.is_empty() {
                            for line in stderr.lines() {
                                let _ = tx.send(AppMsg::AuditOutput(line.to_string()));
                            }
                        }
                    }

                    // Try to parse JSON health report from stdout.
                    let (score, metrics, duplicates, overused) =
                        parse_audit_json(combined.trim());

                    let _ = tx.send(AppMsg::AuditDone {
                        score,
                        metrics,
                        duplicates,
                        overused,
                    });
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::AuditError(e.to_string()));
                }
            }
        });
    }

    /// Spawn a task to create a new application from the current `new_app` state.
    fn spawn_create_app(&self) {
        let company = self.new_app.company.clone();
        let position = self.new_app.position.clone();
        let url = self.new_app.url.clone();
        let tx = self.tx.clone();
        let client = self.api.clone();

        tokio::spawn(async move {
            let url_trimmed = url.trim().to_string();
            let url_opt: Option<&str> = if url_trimmed.is_empty() {
                None
            } else if url_trimmed.starts_with("http://") || url_trimmed.starts_with("https://") {
                Some(&url_trimmed)
            } else {
                let _ = tx.send(AppMsg::AppCreateError(
                    "URL must start with http:// or https://".to_string(),
                ));
                return;
            };
            match client
                .create_application(&company, &position, url_opt)
                .await
            {
                Ok(app) => {
                    let _ = tx.send(AppMsg::AppCreated(app));
                }
                Err(e) => {
                    let _ = tx.send(AppMsg::AppCreateError(e.to_string()));
                }
            }
        });
    }

    /// Open the Audit overlay view, pre-selecting the given app if coming from
    /// the detail screen.
    fn handle_launch_audit(&mut self) {
        let prefill_name = if self.current_view == View::AppDetail {
            self.app_detail
                .as_ref()
                .map(|s| s.name.clone())
                .unwrap_or_default()
        } else {
            String::new()
        };

        self.prev_view = self.current_view;
        self.audit = AuditState::default();
        self.current_view = View::Audit;
        self.fetch_audit_apps();

        // Tag the desired app name so `apply_msg` can set the cursor after
        // the list loads.  We reuse the `error` field with a sentinel prefix
        // to avoid adding a new field.
        if !prefill_name.is_empty() {
            self.audit.error = Some(format!("__prefill__{prefill_name}"));
        }
    }

    /// Open the New Application overlay view.
    fn handle_new(&mut self) {
        self.prev_view = self.current_view;
        self.new_app = NewAppState::default();
        self.current_view = View::NewApp;
    }

    /// Advance the active field in the NewApp form, or submit on the last field.
    fn advance_new_app_field(&mut self) {
        // If we already have a success result, navigate back.
        if self.new_app.success.is_some() {
            self.current_view = self.prev_view;
            return;
        }
        match self.new_app.active_field {
            NewAppField::Company => {
                self.new_app.active_field = NewAppField::Position;
            }
            NewAppField::Position => {
                self.new_app.active_field = NewAppField::Url;
            }
            NewAppField::Url => {
                if self.new_app.company.trim().is_empty()
                    || self.new_app.position.trim().is_empty()
                {
                    self.new_app.error =
                        Some("Company and Position are required.".to_string());
                    return;
                }
                self.new_app.submitting = true;
                self.new_app.error = None;
                self.spawn_create_app();
            }
        }
    }

    /// Switch to the Actions view pre-filling the given target and current app.
    ///
    /// If targets are already loaded the view jumps directly to EnterArgs or
    /// Running; otherwise the user lands on SelectTarget with prefill_app set.
    fn launch_action_for_target(&mut self, target_name: &str) {
        if self.current_view != View::AppDetail {
            return;
        }
        let app_name = self
            .app_detail
            .as_ref()
            .map(|s| s.name.clone())
            .unwrap_or_default();

        self.actions.prefill_app = app_name;
        self.switch_view(View::Actions);

        if let Some(idx) = self
            .actions
            .targets
            .iter()
            .position(|t| t.name == target_name)
        {
            self.actions.cursor = idx;
            self.actions.selected = Some(idx);
            let has_args = self.actions.targets[idx]
                .args
                .as_ref()
                .is_some_and(|a| !a.is_empty());
            if has_args {
                self.actions.phase = ActionsPhase::EnterArgs;
                self.actions.app_input = self.actions.prefill_app.clone();
                self.actions.arg_inputs.clear();
            } else {
                self.actions.phase = ActionsPhase::Running;
                self.actions.running = true;
                self.actions.done = false;
                self.actions.output.clear();
                self.actions.error = None;
                self.spawn_action();
            }
        }
    }
}

/// Parse the JSON health report that the audit target emits on stdout.
///
/// Returns `(score, metrics, duplicates, overused_words)`.
fn parse_audit_json(
    raw: &str,
) -> (
    Option<f64>,
    HashMap<String, f64>,
    Vec<String>,
    Vec<String>,
) {
    let mut score: Option<f64> = None;
    let mut metrics: HashMap<String, f64> = HashMap::new();
    let mut duplicates: Vec<String> = Vec::new();
    let mut overused: Vec<String> = Vec::new();

    if raw.is_empty() {
        return (score, metrics, duplicates, overused);
    }

    // The JSON may appear after other output — find the first `{`.
    let Some(start) = raw.find('{') else {
        return (score, metrics, duplicates, overused);
    };

    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw[start..]) else {
        return (score, metrics, duplicates, overused);
    };

    let Some(obj) = value.as_object() else {
        return (score, metrics, duplicates, overused);
    };

    if let Some(s) = obj.get("score").and_then(serde_json::Value::as_f64) {
        score = Some(s);
    }

    if let Some(m) = obj.get("metrics").and_then(serde_json::Value::as_object) {
        for (k, v) in m {
            if let Some(n) = v.as_f64() {
                metrics.insert(k.clone(), n);
            }
        }
    }

    if let Some(dups) = obj.get("duplicates").and_then(serde_json::Value::as_array) {
        for item in dups {
            if let Some(s) = item.as_str() {
                duplicates.push(s.to_string());
            }
        }
    }

    if let Some(ow) = obj
        .get("overused_words")
        .and_then(serde_json::Value::as_array)
    {
        for item in ow {
            if let Some(s) = item.as_str() {
                overused.push(s.to_string());
            }
        }
    }

    (score, metrics, duplicates, overused)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apply_filter_empty_returns_all() {
        let mut state = AppsState::default();
        state.apps = vec![];
        state.apply_filter();
        assert_eq!(state.filtered.len(), 0);
    }

    #[test]
    fn kanban_clamp_row_empty_col_resets_to_zero() {
        let mut state = KanbanState::default();
        state.row = 5;
        let columns = ["applied", "interview", "offer", "rejected", "ghosted"];
        state.clamp_row(&columns);
        assert_eq!(state.row, 0);
    }

    #[test]
    fn parse_audit_json_empty_string_returns_none_score() {
        let (score, metrics, dups, overused) = parse_audit_json("");
        assert!(score.is_none());
        assert!(metrics.is_empty());
        assert!(dups.is_empty());
        assert!(overused.is_empty());
    }

    #[test]
    fn parse_audit_json_valid_json_returns_score() {
        let json = r#"{"score": 85.5, "metrics": {"clarity": 0.9}, "duplicates": [], "overused_words": ["the"]}"#;
        let (score, metrics, _dups, overused) = parse_audit_json(json);
        assert_eq!(score, Some(85.5));
        assert_eq!(metrics.get("clarity"), Some(&0.9));
        assert_eq!(overused, vec!["the".to_string()]);
    }

    #[test]
    fn view_tab_index_overlay_returns_stats_tab() {
        assert_eq!(View::Audit.tab_index(), 4);
        assert_eq!(View::NewApp.tab_index(), 4);
        assert_eq!(View::Stats.tab_index(), 4);
    }
}
