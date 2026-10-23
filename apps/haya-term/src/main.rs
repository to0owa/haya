//! Haya terminal prototype: one shell in a GPUI window, rendered from an alacritty_terminal grid.

use std::time::Duration;

use alacritty_terminal::{
    event::VoidListener,
    grid::Dimensions,
    term::{Config, Term, cell::Flags, test::TermSize},
    vte::ansi::{Color, NamedColor, Processor, Rgb},
};
use gpui_kit::*;
use gpui_kit::component::input::{Input, InputState};
use haya_pty::PtySession;

mod db;

const ROWS: u16 = 30;
const COLS: u16 = 100;
const FONT_FAMILY: &str = "Menlo";
const FONT_SIZE: f32 = 13.0;
const LINE_HEIGHT: f32 = 18.0;
const PADDING: f32 = 8.0;
const BACKGROUND: u32 = 0x1c1c1e;
const FOREGROUND: u32 = 0xd4d4d4;

// Chrome around the terminal grid, used to size the grid from the window.
const RAIL_WIDTH: f32 = 56.0;
const SIDEBAR_WIDTH: f32 = 240.0;
/// Absolute x where the toolbar starts, just right of the traffic lights.
const TOOLBAR_LEFT: f32 = 84.0;
/// Height of the top band that the traffic lights occupy.
const TITLEBAR_HEIGHT: f32 = 44.0;
const HEADER_HEIGHT: f32 = 44.0;
const STATUS_HEIGHT: f32 = 28.0;
const DETAILS_WIDTH: f32 = 300.0;

const RAIL_BG: u32 = 0x1f1f22;
const SIDEBAR_BG: u32 = 0x26262a;
const SIDEBAR_SELECTED: u32 = 0x37373c;
const SIDEBAR_HOVER: u32 = 0x2f2f34;
const BORDER: u32 = 0x2e2e33;
const TEXT_PRIMARY: u32 = 0xececec;
const TEXT_MUTED: u32 = 0x8e8e93;
const ACCENT: u32 = 0xe9a26a;

pub struct TerminalView {
    focus_handle: FocusHandle,
    pty: Option<PtySession>,
    term: Term<VoidListener>,
    parser: Processor,
    /// Current grid size as (cols, rows).
    size: (usize, usize),
    /// Width taken by the rail and sidebar to the left of the terminal, set by the root view.
    inset_left: f32,
}

impl TerminalView {
    pub fn new(window: &mut Window, cx: &mut App) -> Entity<Self> {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        let pty = PtySession::spawn(&shell, ROWS, COLS).ok();
        let size = TermSize::new(COLS as usize, ROWS as usize);
        let view = cx.new(|cx| {
            let view = Self {
                focus_handle: cx.focus_handle(),
                pty,
                term: Term::new(Config::default(), &size, VoidListener),
                parser: Processor::new(),
                size: (COLS as usize, ROWS as usize),
                inset_left: RAIL_WIDTH + SIDEBAR_WIDTH,
            };
            // Pump PTY output into the emulator about 60 times a second.
            cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
                loop {
                    cx.background_executor().timer(Duration::from_millis(16)).await;
                    if this.update(cx, |this: &mut Self, cx| this.pump(cx)).is_err() {
                        break;
                    }
                }
            })
            .detach();
            view
        });
        view.update(cx, |view, cx| {
            let handle = view.focus_handle.clone();
            window.focus(&handle, cx);
        });
        view
    }

    fn pump(&mut self, cx: &mut Context<Self>) {
        let Some(pty) = &self.pty else { return };
        let chunks = pty.drain_output();
        if chunks.is_empty() {
            return;
        }
        for chunk in chunks {
            self.parser.advance(&mut self.term, &chunk);
        }
        cx.notify();
    }

    fn on_key(&mut self, event: &KeyDownEvent, _: &mut Window, _: &mut Context<Self>) {
        if let Some(bytes) = key_bytes(event) {
            if let Some(pty) = self.pty.as_mut() {
                let _ = pty.write(&bytes);
            }
        }
    }
}

impl Focusable for TerminalView {
    fn focus_handle(&self, _: &App) -> FocusHandle {
        self.focus_handle.clone()
    }
}

impl TerminalView {
    /// Recomputes the grid size from the window and resizes the emulator and the PTY when it changes.
    fn sync_size(&mut self, window: &Window) {
        let text_system = window.text_system();
        let font_id = text_system.resolve_font(&font(FONT_FAMILY));
        let Ok(cell_width) = text_system.ch_advance(font_id, px(FONT_SIZE)) else { return };
        let cell_width = f32::from(cell_width);
        if cell_width <= 0.0 {
            return;
        }

        let viewport = window.viewport_size();
        let width = f32::from(viewport.width) - self.inset_left - PADDING * 2.0;
        let height = f32::from(viewport.height) - HEADER_HEIGHT - STATUS_HEIGHT - PADDING * 2.0;
        let cols = ((width / cell_width).floor() as usize).max(2);
        let rows = ((height / LINE_HEIGHT).floor() as usize).max(2);

        if (cols, rows) == self.size {
            return;
        }
        self.size = (cols, rows);
        self.term.resize(TermSize::new(cols, rows));
        if let Some(pty) = &self.pty {
            let _ = pty.resize(rows as u16, cols as u16);
        }
    }
}

impl Render for TerminalView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.sync_size(window);
        let content = self.term.renderable_content();
        let offset = content.display_offset as i32;
        let cursor = content.cursor.point;

        let mut lines: Vec<(String, Vec<(std::ops::Range<usize>, HighlightStyle)>)> =
            (0..self.term.screen_lines()).map(|_| (String::new(), Vec::new())).collect();

        for indexed in content.display_iter {
            let row = (indexed.point.line.0 + offset) as usize;
            let Some((text, highlights)) = lines.get_mut(row) else { continue };
            let is_cursor = indexed.point.line == cursor.line && indexed.point.column == cursor.column;
            let mut fg = resolve(indexed.cell.fg);
            let mut bg = resolve(indexed.cell.bg);
            if indexed.cell.flags.contains(Flags::INVERSE) ^ is_cursor {
                std::mem::swap(&mut fg, &mut bg);
            }
            let start = text.len();
            text.push(indexed.cell.c);
            let end = text.len();
            highlights.push((
                start..end,
                HighlightStyle {
                    color: Some(rgb(fg).into()),
                    background_color: Some(rgb(bg).into()),
                    ..Default::default()
                },
            ));
        }

        div()
            .flex()
            .flex_col()
            .id("terminal")
            .flex_1()
            .min_h_0()
            .track_focus(&self.focus_handle)
            .on_key_down(cx.listener(Self::on_key))
            .bg(rgb(BACKGROUND))
            .text_color(rgb(FOREGROUND))
            .font_family(FONT_FAMILY)
            .text_size(px(FONT_SIZE))
            .line_height(px(LINE_HEIGHT))
            .p_2()
            .children(lines.into_iter().map(|(text, highlights)| {
                let text = if text.is_empty() { " ".to_string() } else { text };
                StyledText::new(text).with_highlights(highlights)
            }))
    }
}

/// Maps a terminal color to RGB. Covers named colors, the 256-color palette and truecolor.
fn resolve(color: Color) -> u32 {
    match color {
        Color::Spec(Rgb { r, g, b }) => ((r as u32) << 16) | ((g as u32) << 8) | b as u32,
        Color::Indexed(index) => indexed(index),
        Color::Named(named) => match named {
            NamedColor::Foreground | NamedColor::BrightForeground => FOREGROUND,
            NamedColor::Background => BACKGROUND,
            other => indexed(other as u8),
        },
    }
}

fn indexed(index: u8) -> u32 {
    const BASE: [u32; 16] = [
        0x000000, 0xcd0000, 0x00cd00, 0xcdcd00, 0x0000ee, 0xcd00cd, 0x00cdcd, 0xe5e5e5,
        0x7f7f7f, 0xff0000, 0x00ff00, 0xffff00, 0x5c5cff, 0xff00ff, 0x00ffff, 0xffffff,
    ];
    match index {
        0..=15 => BASE[index as usize],
        16..=231 => {
            let i = index - 16;
            let level = |v: u8| if v == 0 { 0 } else { 55 + 40 * v as u32 };
            (level(i / 36) << 16) | (level((i / 6) % 6) << 8) | level(i % 6)
        }
        _ => {
            let v = 8 + 10 * (index as u32 - 232);
            (v << 16) | (v << 8) | v
        }
    }
}

/// Converts a keystroke into the bytes a terminal expects.
fn key_bytes(event: &KeyDownEvent) -> Option<Vec<u8>> {
    let key = event.keystroke.key.as_str();
    let mods = event.keystroke.modifiers;
    let seq: &[u8] = match key {
        "enter" => b"\r",
        "backspace" => b"\x7f",
        "tab" => b"\t",
        "escape" => b"\x1b",
        "up" => b"\x1b[A",
        "down" => b"\x1b[B",
        "right" => b"\x1b[C",
        "left" => b"\x1b[D",
        "home" => b"\x1b[H",
        "end" => b"\x1b[F",
        "delete" => b"\x1b[3~",
        _ => {
            if mods.control && key.len() == 1 {
                let c = key.as_bytes()[0].to_ascii_lowercase();
                if c.is_ascii_lowercase() {
                    return Some(vec![c - b'a' + 1]);
                }
            }
            return event.keystroke.key_char.as_ref().map(|s| s.as_bytes().to_vec());
        }
    };
    Some(seq.to_vec())
}

fn main() {
    gpui_kit::application().run(move |cx| {
        gpui_kit::init(cx);
        let options = WindowOptions {
            titlebar: Some(TitlebarOptions {
                title: Some("Haya".into()),
                appears_transparent: true,
                traffic_light_position: Some(point(px(16.), px(16.))),
            }),
            ..Default::default()
        };
        gpui_kit::open_window(options, cx, |window, cx| cx.new(|cx| RootView::new(window, cx)))
            .expect("Failed to open window");
    });
}

/// Top-level areas switched from the icon rail. They change the sidebar; tabs are shared.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Section {
    Terminal,
    Database,
}

/// One tab in the workspace strip.
enum WorkspaceTab {
    Terminal(Entity<TerminalView>),
    Db(Entity<db::DbTab>),
}

/// Window content: icon rail, sidebar for the active section, and one tab strip shared by all features.
struct RootView {
    section: Section,
    sidebar_open: bool,
    tabs: Vec<WorkspaceTab>,
    active_tab: usize,
    db: Entity<db::DbView>,
    plus_open: bool,
    details_open: bool,
    details_search: Entity<InputState>,
}

impl RootView {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let first = TerminalView::new(window, cx);
        let db = cx.new(|cx| db::DbView::new(window, cx));
        cx.subscribe_in(&db, window, |this, _, event, window, cx| {
            this.on_db_event(event, window, cx)
        })
        .detach();
        let details_search = cx.new(|cx| InputState::new(window, cx).placeholder("Search for field…"));
        Self {
            section: Section::Terminal,
            sidebar_open: true,
            tabs: vec![WorkspaceTab::Terminal(first)],
            active_tab: 0,
            db,
            plus_open: false,
            details_open: false,
            details_search,
        }
    }

    fn on_db_event(&mut self, event: &db::DbEvent, window: &mut Window, cx: &mut Context<Self>) {
        match event {
            db::DbEvent::OpenTable { profile, schema, table } => {
                let existing = self.tabs.iter().position(|tab| match tab {
                    WorkspaceTab::Db(entity) => entity.read(cx).shows_table(profile, schema, table),
                    WorkspaceTab::Terminal(_) => false,
                });
                if let Some(index) = existing {
                    self.select_tab(index, window, cx);
                    return;
                }
                let Some((_, conn)) = self.db.read(cx).connection() else { return };
                let tab = db::DbTab::open_table(profile.clone(), conn, schema.clone(), table.clone(), cx);
                self.push_tab(WorkspaceTab::Db(tab), window, cx);
            }
            db::DbEvent::NewQuery => {
                let Some((profile, conn)) = self.db.read(cx).connection() else { return };
                let number = self
                    .tabs
                    .iter()
                    .filter(|tab| matches!(tab, WorkspaceTab::Db(e) if e.read(cx).title().starts_with("Query")))
                    .count()
                    + 1;
                let tab = db::DbTab::new_query(profile, conn, format!("Query {number}"), "SELECT 1;", window, cx);
                self.push_tab(WorkspaceTab::Db(tab), window, cx);
            }
        }
    }

    fn push_tab(&mut self, tab: WorkspaceTab, window: &mut Window, cx: &mut Context<Self>) {
        self.tabs.push(tab);
        let index = self.tabs.len() - 1;
        self.select_tab(index, window, cx);
    }

    fn new_terminal(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        self.plus_open = false;
        let terminal = TerminalView::new(window, cx);
        self.push_tab(WorkspaceTab::Terminal(terminal), window, cx);
    }

    fn select_tab(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        if index >= self.tabs.len() {
            return;
        }
        self.active_tab = index;
        self.plus_open = false;
        if let WorkspaceTab::Terminal(terminal) = &self.tabs[index] {
            let handle = terminal.read(cx).focus_handle.clone();
            window.focus(&handle, cx);
        }
        cx.notify();
    }

    fn close_tab(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        self.tabs.remove(index);
        if self.tabs.is_empty() {
            self.new_terminal(window, cx);
            return;
        }
        let active = if index < self.active_tab {
            self.active_tab - 1
        } else {
            self.active_tab.min(self.tabs.len() - 1)
        };
        self.select_tab(active, window, cx);
    }

    fn switch_section(&mut self, section: Section, cx: &mut Context<Self>) {
        self.section = section;
        cx.notify();
    }

    fn terminal_tab_titles(&self) -> Vec<(usize, String)> {
        let mut titles = Vec::new();
        let mut number = 0;
        for (index, tab) in self.tabs.iter().enumerate() {
            if let WorkspaceTab::Terminal(_) = tab {
                number += 1;
                titles.push((index, format!("Terminal {number}")));
            }
        }
        titles
    }

    /// Left-most column with one button per section. Its top band is left empty for the traffic lights.
    fn render_rail(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let items = [
            (Section::Terminal, ">_", "rail-terminal"),
            (Section::Database, "DB", "rail-database"),
        ];
        div()
            .flex()
            .flex_col()
            .items_center()
            .w(px(RAIL_WIDTH))
            .h_full()
            .flex_shrink_0()
            .pt(px(TITLEBAR_HEIGHT))
            .gap_2()
            .bg(rgb(RAIL_BG))
            .border_r_1()
            .border_color(rgb(BORDER))
            .children(items.into_iter().map(|(section, glyph, id)| {
                let selected = self.section == section;
                div()
                    .id(id)
                    .flex()
                    .items_center()
                    .justify_center()
                    .size(px(36.))
                    .rounded_lg()
                    .cursor_pointer()
                    .text_size(px(12.))
                    .text_color(rgb(if selected { TEXT_PRIMARY } else { TEXT_MUTED }))
                    .bg(rgb(if selected { SIDEBAR_SELECTED } else { RAIL_BG }))
                    .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                    .on_click(cx.listener(move |this: &mut Self, _: &ClickEvent, _, cx| {
                        this.switch_section(section, cx);
                    }))
                    .child(glyph)
            }))
    }

    /// Sidebar toggle, back, and forward. Starts after the traffic lights, so it never overlaps them.
    fn render_toolbar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let icon = |id: &'static str, glyph: &'static str, enabled: bool| {
            let base = div()
                .id(id)
                .flex()
                .items_center()
                .justify_center()
                .size(px(26.))
                .rounded_md()
                .text_size(px(15.))
                .text_color(rgb(if enabled { TEXT_PRIMARY } else { TEXT_MUTED }));
            let base = if enabled {
                base.cursor_pointer().hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
            } else {
                base
            };
            base.child(glyph)
        };
        div()
            .flex()
            .items_center()
            .gap_1()
            .h(px(TITLEBAR_HEIGHT))
            .flex_shrink_0()
            .pl(px(TOOLBAR_LEFT - RAIL_WIDTH))
            .child(icon("toggle-sidebar", "▤", true).on_click(cx.listener(
                |this: &mut Self, _: &ClickEvent, _, cx| {
                    this.sidebar_open = !this.sidebar_open;
                    cx.notify();
                },
            )))
            .child(icon("back", "←", false))
            .child(icon("forward", "→", false))
    }

    fn render_nav_row(
        &self,
        id: &'static str,
        glyph: &'static str,
        label: &'static str,
        cx: &mut Context<Self>,
        on_click: impl Fn(&mut Self, &mut Window, &mut Context<Self>) + 'static,
    ) -> impl IntoElement {
        div()
            .id(id)
            .flex()
            .items_center()
            .gap_2()
            .px_3()
            .py_1p5()
            .rounded_md()
            .cursor_pointer()
            .text_size(px(13.))
            .text_color(rgb(TEXT_MUTED))
            .hover(|el| el.bg(rgb(SIDEBAR_HOVER)).text_color(rgb(TEXT_PRIMARY)))
            .on_click(cx.listener(move |this: &mut Self, _: &ClickEvent, window, cx| {
                on_click(this, window, cx);
            }))
            .child(div().w(px(22.)).whitespace_nowrap().text_color(rgb(TEXT_MUTED)).child(glyph))
            .child(label)
    }

    /// Sidebar content for the Terminal section: actions and the terminal list.
    fn render_terminal_sidebar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let mut sessions = Vec::new();
        for (index, title) in self.terminal_tab_titles() {
            let selected = index == self.active_tab;
            sessions.push(
                div()
                    .id(("session", index))
                    .ml_6()
                    .px_3()
                    .py_1p5()
                    .rounded_md()
                    .cursor_pointer()
                    .text_size(px(12.))
                    .text_color(rgb(if selected { TEXT_PRIMARY } else { TEXT_MUTED }))
                    .bg(rgb(if selected { SIDEBAR_SELECTED } else { SIDEBAR_BG }))
                    .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                    .on_click(cx.listener(move |this: &mut Self, _: &ClickEvent, window, cx| {
                        this.select_tab(index, window, cx);
                    }))
                    .child(title),
            );
        }

        div()
            .flex()
            .flex_col()
            .gap_0p5()
            .px_2()
            .pt_2()
            .child(self.render_nav_row("new-terminal", "+", "New Terminal", cx, |this, window, cx| {
                this.new_terminal(window, cx)
            }))
            .child(self.render_nav_row("search", "⌕", "Search", cx, |_, _, _| {}))
            .child(div().h_3())
            .child(
                div()
                    .px_3()
                    .pb_1()
                    .text_size(px(11.))
                    .text_color(rgb(TEXT_MUTED))
                    .child("Sessions"),
            )
            .children(sessions)
    }

    fn render_sidebar(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let content = match self.section {
            Section::Terminal => self.render_terminal_sidebar(cx).into_any_element(),
            Section::Database => self.db.update(cx, |db, cx| db.sidebar(window, cx)),
        };
        div()
            .flex()
            .flex_col()
            .w(px(SIDEBAR_WIDTH))
            .h_full()
            .flex_shrink_0()
            .bg(rgb(SIDEBAR_BG))
            .border_r_1()
            .border_color(rgb(BORDER))
            .child(self.render_toolbar(cx))
            .child(content)
    }

    /// Tab strip shared by every feature. While the sidebar is closed it starts with the toolbar.
    fn render_tab_strip(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let mut strip = div()
            .flex()
            .items_center()
            .gap_1()
            .h(px(TITLEBAR_HEIGHT))
            .flex_shrink_0()
            .border_b_1()
            .border_color(rgb(BORDER))
            .text_color(rgb(TEXT_PRIMARY))
            .text_size(px(12.));

        if !self.sidebar_open {
            strip = strip.child(self.render_toolbar(cx));
        } else {
            strip = strip.child(div().w(px(12.)));
        }

        let titles = self.terminal_tab_titles();
        for (index, tab) in self.tabs.iter().enumerate() {
            let title = match tab {
                WorkspaceTab::Terminal(_) => titles
                    .iter()
                    .find(|(i, _)| *i == index)
                    .map(|(_, t)| t.clone())
                    .unwrap_or_default(),
                WorkspaceTab::Db(entity) => entity.read(cx).title().to_string(),
            };
            let selected = index == self.active_tab;
            strip = strip.child(
                div()
                    .id(("tab", index))
                    .flex()
                    .items_center()
                    .gap_2()
                    .px_3()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .text_color(rgb(if selected { TEXT_PRIMARY } else { TEXT_MUTED }))
                    .bg(rgb(if selected { SIDEBAR_SELECTED } else { BACKGROUND }))
                    .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                    .on_click(cx.listener(move |this, _: &ClickEvent, window, cx| {
                        this.select_tab(index, window, cx);
                    }))
                    .child(title)
                    .child(
                        div()
                            .id(("tab-close", index))
                            .px_1()
                            .rounded_sm()
                            .text_color(rgb(TEXT_MUTED))
                            .hover(|el| el.text_color(rgb(TEXT_PRIMARY)))
                            .on_click(cx.listener(move |this, _: &ClickEvent, window, cx| {
                                cx.stop_propagation();
                                this.close_tab(index, window, cx);
                            }))
                            .child("×"),
                    ),
            );
        }

        strip.child(
            div()
                .id("tab-plus")
                .ml_1()
                .px_2()
                .py_1()
                .rounded_md()
                .cursor_pointer()
                .text_color(rgb(ACCENT))
                .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                    this.plus_open = !this.plus_open;
                    cx.notify();
                }))
                .child("+"),
        )
    }

    fn render_status(&self) -> impl IntoElement {
        div()
            .flex()
            .items_center()
            .gap_3()
            .h(px(STATUS_HEIGHT))
            .flex_shrink_0()
            .px_4()
            .border_t_1()
            .border_color(rgb(BORDER))
            .text_color(rgb(TEXT_MUTED))
            .text_size(px(11.))
            .child(div().text_color(rgb(ACCENT)).child("Local"))
            .child(match self.tabs.len() {
                1 => "1 tab".to_string(),
                n => format!("{n} tabs"),
            })
    }

    /// Status bar for a database tab: connection, result summary, and the details toggle.
    fn render_db_status(&self, tab: &Entity<db::DbTab>, cx: &mut Context<Self>) -> impl IntoElement {
        let tab_ref = tab.read(cx);
        let dialect = match tab_ref.dialect() {
            haya_db::Dialect::Postgres => "PostgreSQL",
            haya_db::Dialect::CrateDb => "CrateDB",
        };
        let summary = if tab_ref.is_running() {
            "Running…".to_string()
        } else if let Some(error) = tab_ref.error() {
            format!("Error: {}", error.lines().next().unwrap_or(""))
        } else if let Some(result) = tab_ref.result() {
            let rows = match result.rows_affected {
                Some(count) if result.columns.is_empty() => format!("{count} rows affected"),
                _ => format!(
                    "{} rows{}",
                    result.rows.len(),
                    if result.truncated { " (capped)" } else { "" }
                ),
            };
            let selected = match tab_ref.selected_row() {
                Some(row) => format!(" · row {} selected", row + 1),
                None => String::new(),
            };
            format!("{rows} · {} ms{selected}", result.elapsed.as_millis())
        } else {
            String::new()
        };
        let details_label = if self.details_open { "Details ▾" } else { "Details ▸" };

        div()
            .flex()
            .items_center()
            .gap_3()
            .h(px(STATUS_HEIGHT))
            .flex_shrink_0()
            .px_4()
            .border_t_1()
            .border_color(rgb(BORDER))
            .text_color(rgb(TEXT_MUTED))
            .text_size(px(11.))
            .child(div().text_color(rgb(ACCENT)).child(format!("{} · {dialect}", tab_ref.profile_name())))
            .child(summary)
            .child(div().flex_1())
            .child(
                div()
                    .id("db-details-toggle")
                    .px_2()
                    .rounded_sm()
                    .cursor_pointer()
                    .hover(|el| el.text_color(rgb(TEXT_PRIMARY)))
                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                        this.details_open = !this.details_open;
                        cx.notify();
                    }))
                    .child(details_label),
            )
    }

    /// Right-hand panel: the selected row as a list of fields, with a search box above.
    fn render_details(&self, tab: &Entity<db::DbTab>, cx: &mut Context<Self>) -> impl IntoElement {
        let tab_ref = tab.read(cx);
        let search = self.details_search.read(cx).value().to_lowercase();
        let mut body = div().flex().flex_col().gap_3().px_3().pb_3();

        match (tab_ref.result(), tab_ref.selected_row()) {
            (Some(result), Some(row)) => {
                for (column, name) in result.columns.iter().enumerate() {
                    if !search.is_empty() && !name.to_lowercase().contains(&search) {
                        continue;
                    }
                    let value = result.rows[row][column].clone();
                    let empty = value.is_none();
                    body = body.child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_1()
                            .child(div().text_size(px(11.)).text_color(rgb(TEXT_MUTED)).child(name.clone()))
                            .child(
                                div()
                                    .px_2()
                                    .py_1p5()
                                    .rounded_md()
                                    .border_1()
                                    .border_color(rgb(BORDER))
                                    .bg(rgb(SIDEBAR_BG))
                                    .font_family("Menlo")
                                    .text_size(px(12.))
                                    .text_color(rgb(if empty { TEXT_MUTED } else { TEXT_PRIMARY }))
                                    .child(value.unwrap_or_else(|| "NULL".into())),
                            ),
                    );
                }
            }
            _ => {
                body = body.child(
                    div()
                        .pt_4()
                        .text_size(px(12.))
                        .text_color(rgb(TEXT_MUTED))
                        .child("Select a row to see its fields."),
                );
            }
        }

        div()
            .flex()
            .flex_col()
            .w(px(DETAILS_WIDTH))
            .h_full()
            .flex_shrink_0()
            .bg(rgb(SIDEBAR_BG))
            .border_l_1()
            .border_color(rgb(BORDER))
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .p_3()
                    .border_b_1()
                    .border_color(rgb(BORDER))
                    .child(div().text_size(px(12.)).text_color(rgb(TEXT_PRIMARY)).child("Details"))
                    .child(Input::new(&self.details_search)),
            )
            .child(
                div()
                    .id("details-scroll")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .pt_3()
                    .child(body),
            )
    }

    /// Menu opened by the strip's + button.
    fn render_plus_menu(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let item = |id: &'static str, label: &'static str| {
            div()
                .id(id)
                .px_3()
                .py_1p5()
                .rounded_md()
                .cursor_pointer()
                .text_size(px(12.))
                .text_color(rgb(TEXT_PRIMARY))
                .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                .child(label)
        };
        div()
            .absolute()
            .top(px(TITLEBAR_HEIGHT + 4.))
            .right(px(12.))
            .w(px(180.))
            .p_1()
            .rounded_lg()
            .border_1()
            .border_color(rgb(BORDER))
            .bg(rgb(SIDEBAR_BG))
            .flex()
            .flex_col()
            .child(item("plus-terminal", "New Terminal").on_click(cx.listener(
                |this, _: &ClickEvent, window, cx| this.new_terminal(window, cx),
            )))
            .child(item("plus-query", "New Query").on_click(cx.listener(|this, _: &ClickEvent, _, cx| {
                this.plus_open = false;
                this.db.update(cx, |db, cx| db.new_query_from_menu(cx));
            })))
    }
}

impl Render for RootView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // Keep every terminal's grid in sync with the space it actually gets.
        let inset = RAIL_WIDTH + if self.sidebar_open { SIDEBAR_WIDTH } else { 0.0 };
        for tab in &self.tabs {
            if let WorkspaceTab::Terminal(terminal) = tab {
                terminal.update(cx, |terminal, _| terminal.inset_left = inset);
            }
        }

        let content: AnyElement = match self.tabs.get(self.active_tab) {
            Some(WorkspaceTab::Terminal(terminal)) => div()
                .flex()
                .flex_col()
                .flex_1()
                .min_w_0()
                .child(terminal.clone())
                .child(self.render_status())
                .into_any_element(),
            Some(WorkspaceTab::Db(tab)) => div()
                .flex()
                .flex_col()
                .flex_1()
                .min_w_0()
                .child(tab.clone())
                .child(self.render_db_status(tab, cx))
                .into_any_element(),
            None => div().flex_1().into_any_element(),
        };

        let main = div()
            .relative()
            .flex()
            .flex_col()
            .flex_1()
            .min_w_0()
            .child(self.render_tab_strip(cx))
            .child(content)
            ;
        let main = if self.plus_open { main.child(self.render_plus_menu(cx)) } else { main };

        let root = div()
            .flex()
            .size_full()
            .bg(rgb(BACKGROUND))
            .child(self.render_rail(cx));
        let root = if self.sidebar_open { root.child(self.render_sidebar(window, cx)) } else { root };
        let details_tab = match self.tabs.get(self.active_tab) {
            Some(WorkspaceTab::Db(tab)) if self.details_open => Some(tab.clone()),
            _ => None,
        };
        let root = root.child(main);
        match details_tab {
            Some(tab) => root.child(self.render_details(&tab, cx)),
            None => root,
        }
    }
}
