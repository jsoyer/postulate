"""Catppuccin Mocha color palette and Textual CSS for cv-tui."""

# Catppuccin Mocha palette
CRUST = "#11111b"
MANTLE = "#181825"
BASE = "#1e1e2e"
SURFACE0 = "#313244"
SURFACE1 = "#45475a"
SURFACE2 = "#585b70"
OVERLAY0 = "#6c7086"
OVERLAY1 = "#7f849c"
OVERLAY2 = "#9399b2"
SUBTEXT0 = "#a6adc8"
SUBTEXT1 = "#bac2de"
TEXT = "#cdd6f4"

LAVENDER = "#b4befe"
BLUE = "#89b4fa"
SAPPHIRE = "#74c7ec"
SKY = "#89dceb"
TEAL = "#94e2d5"
GREEN = "#a6e3a1"
YELLOW = "#f9e2af"
PEACH = "#fab387"
MAROON = "#eba0ac"
RED = "#f38ba8"
MAUVE = "#cba6f7"
PINK = "#f5c2e7"
FLAMINGO = "#f2cdcd"
ROSEWATER = "#f5e0dc"

CATPPUCCIN_CSS = f"""
Screen {{
    background: {BASE};
    color: {TEXT};
}}

Header {{
    background: {MANTLE};
    color: {TEXT};
    dock: top;
    height: 1;
}}

Footer {{
    background: {MANTLE};
    color: {SUBTEXT0};
    dock: bottom;
    height: 1;
}}

TabbedContent {{
    background: {BASE};
}}

TabbedContent TabPane {{
    padding: 0;
}}

Tabs {{
    background: {MANTLE};
    border-bottom: solid {SURFACE0};
    height: 3;
}}

Tab {{
    background: {MANTLE};
    color: {SUBTEXT0};
    padding: 0 2;
}}

Tab.-active {{
    background: {SURFACE0};
    color: {LAVENDER};
    text-style: bold;
}}

Tab:hover {{
    color: {TEXT};
}}

DataTable {{
    background: {BASE};
    color: {TEXT};
}}

DataTable > .datatable--header {{
    background: {SURFACE0};
    color: {LAVENDER};
    text-style: bold;
}}

DataTable > .datatable--cursor {{
    background: {SURFACE1};
    color: {TEXT};
}}

DataTable > .datatable--highlight {{
    background: {SURFACE0};
}}

Button {{
    background: {SURFACE0};
    color: {TEXT};
    border: tall {SURFACE1};
    margin: 0 0 1 0;
    width: 100%;
}}

Button:hover {{
    background: {SURFACE1};
    border: tall {LAVENDER};
}}

Button.-primary {{
    background: {BLUE};
    color: {CRUST};
    border: tall {SAPPHIRE};
}}

Button.-primary:hover {{
    background: {SAPPHIRE};
}}

Button.-success {{
    background: {GREEN};
    color: {CRUST};
    border: tall {TEAL};
}}

Button.-success:hover {{
    background: {TEAL};
}}

Button.-error {{
    background: {RED};
    color: {CRUST};
    border: tall {MAROON};
}}

Button.-error:hover {{
    background: {MAROON};
}}

Button.-warning {{
    background: {YELLOW};
    color: {CRUST};
    border: tall {PEACH};
}}

Button.-warning:hover {{
    background: {PEACH};
}}

Input {{
    background: {SURFACE0};
    color: {TEXT};
    border: tall {SURFACE1};
    margin: 1 0;
}}

Input:focus {{
    border: tall {LAVENDER};
}}

Select {{
    background: {SURFACE0};
    color: {TEXT};
    border: tall {SURFACE1};
    margin: 1 0;
}}

SelectOverlay {{
    background: {SURFACE0};
    border: tall {SURFACE1};
}}

SelectOverlay > .option-list--option-highlighted {{
    background: {SURFACE1};
    color: {TEXT};
}}

ListView {{
    background: {BASE};
}}

ListItem {{
    background: {BASE};
    color: {TEXT};
    padding: 0 1;
}}

ListItem:hover {{
    background: {SURFACE0};
}}

ListItem.-highlight {{
    background: {SURFACE1};
}}

Static.section-title {{
    color: {MAUVE};
    text-style: bold;
    margin: 1 0 0 0;
    padding: 0 1;
}}

Static.status-bar {{
    background: {MANTLE};
    color: {SUBTEXT0};
    padding: 0 1;
}}

#output-panel {{
    background: {MANTLE};
    border: solid {SURFACE0};
    padding: 1;
    color: {TEXT};
    overflow-y: scroll;
}}

.badge {{
    text-style: bold;
    padding: 0 1;
}}

.badge-applied    {{ background: {BLUE};   color: {CRUST}; }}
.badge-interview  {{ background: {YELLOW}; color: {CRUST}; }}
.badge-offer      {{ background: {GREEN};  color: {CRUST}; }}
.badge-rejected   {{ background: {RED};    color: {CRUST}; }}
.badge-ghosted    {{ background: {SURFACE2}; color: {TEXT}; }}
.badge-archived   {{ background: {SURFACE1}; color: {TEXT}; }}
.badge-unknown    {{ background: {SURFACE0}; color: {SUBTEXT0}; }}

.kanban-column {{
    background: {MANTLE};
    border: solid {SURFACE0};
    margin: 0 1;
    min-width: 22;
    padding: 1;
}}

.kanban-column-title {{
    text-style: bold;
    text-align: center;
    margin: 0 0 1 0;
}}

.kanban-card {{
    background: {SURFACE0};
    border: solid {SURFACE1};
    margin: 0 0 1 0;
    padding: 0 1;
}}

.kanban-card:hover {{
    border: solid {LAVENDER};
}}

.stat-label {{
    color: {SUBTEXT0};
}}

.stat-value {{
    color: {LAVENDER};
    text-style: bold;
}}

.funnel-bar {{
    color: {BLUE};
}}

#api-status-ok {{
    color: {GREEN};
}}

#api-status-err {{
    color: {RED};
}}

.target-category-title {{
    color: {PEACH};
    text-style: bold;
    margin: 1 0 0 0;
}}

.arg-label {{
    color: {SUBTEXT1};
    margin: 1 0 0 0;
}}
"""
