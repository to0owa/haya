//! Haya terminal prototype: one shell in a GPUI window, rendered from an alacritty_terminal grid.

use std::time::Duration;

use alacritty_terminal::{
    event::VoidListener,
    grid::Dimensions,
    term::{Config, Term, cell::Flags, test::TermSize},
    vte::ansi::{Color, NamedColor, Processor, Rgb},
};
use gpui_kit::*;
use haya_pty::PtySession;

const ROWS: u16 = 30;
const COLS: u16 = 100;
const FONT_FAMILY: &str = "Menlo";
const FONT_SIZE: f32 = 13.0;
const LINE_HEIGHT: f32 = 18.0;
const PADDING: f32 = 8.0;
const BACKGROUND: u32 = 0x1c1c1e;
const FOREGROUND: u32 = 0xd4d4d4;

// Chrome around the terminal grid, used to size the grid from the window.
const SIDEBAR_WIDTH: f32 = 240.0;
/// Space reserved for the traffic lights and toolbar when the sidebar is collapsed.
const TOOLBAR_INSET: f32 = 84.0;
const HEADER_HEIGHT: f32 = 44.0;
const STATUS_HEIGHT: f32 = 28.0;

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
    /// Width taken by the sidebar to the left of the terminal, set by the root view.
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
                inset_left: SIDEBAR_WIDTH,
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

/// Top-level areas switched from the icon rail.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Section {
    Terminal,
    Database,
}

/// Window content: icon rail, a sidebar for the active section, then the section's main area.
struct RootView {
    section: Section,
    sidebar_open: bool,
    sessions: Vec<Entity<TerminalView>>,
    active: usize,
}

impl RootView {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        let first = TerminalView::new(window, cx);
        Self { section: Section::Terminal, sidebar_open: true, sessions: vec![first], active: 0 }
    }

    fn switch_section(&mut self, section: Section, window: &mut Window, cx: &mut Context<Self>) {
        self.section = section;
        if section == Section::Terminal {
            let handle = self.sessions[self.active].read(cx).focus_handle.clone();
            window.focus(&handle, cx);
        }
        cx.notify();
    }

    fn render_database_placeholder(&self) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .items_center()
            .justify_center()
            .size_full()
            .gap_2()
            .text_color(rgb(TEXT_MUTED))
            .child(div().text_color(rgb(TEXT_PRIMARY)).text_size(px(14.)).child("Database"))
            .child(div().text_size(px(12.)).child("CrateDB connections will appear here."))
    }

    fn new_session(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let session = TerminalView::new(window, cx);
        self.sessions.push(session);
        self.select(self.sessions.len() - 1, window, cx);
    }

    fn select(&mut self, index: usize, window: &mut Window, cx: &mut Context<Self>) {
        self.active = index;
        let handle = self.sessions[index].read(cx).focus_handle.clone();
        window.focus(&handle, cx);
        cx.notify();
    }

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
            .h(px(44.))
            .flex_shrink_0()
            .pl(px(TOOLBAR_INSET))
            .pr_2()
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
        selected: bool,
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
            .text_color(rgb(if selected { TEXT_PRIMARY } else { TEXT_MUTED }))
            .bg(rgb(if selected { SIDEBAR_SELECTED } else { SIDEBAR_BG }))
            .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
            .on_click(cx.listener(move |this: &mut Self, _: &ClickEvent, window, cx| {
                on_click(this, window, cx);
            }))
            .child(
                div()
                    .w(px(22.))
                    .whitespace_nowrap()
                    .text_color(rgb(TEXT_MUTED))
                    .child(glyph),
            )
            .child(label)
    }

    fn render_sidebar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let terminal_selected = self.section == Section::Terminal;
        let mut sessions = Vec::new();
        for index in 0..self.sessions.len() {
            let selected = terminal_selected && index == self.active;
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
                        this.section = Section::Terminal;
                        this.select(index, window, cx);
                    }))
                    .child(format!("Terminal {}", index + 1)),
            );
        }

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
            .child(
                div()
                    .flex()
                    .flex_col()
                    .gap_0p5()
                    .px_2()
                    .pt_2()
                    .child(self.render_nav_row(
                        "new-terminal",
                        "+",
                        "New Terminal",
                        false,
                        cx,
                        |this, window, cx| this.new_session(window, cx),
                    ))
                    .child(self.render_nav_row(
                        "search",
                        "⌕",
                        "Search",
                        false,
                        cx,
                        |_, _, _| {},
                    ))
                    .child(div().h_3())
                    .child(self.render_nav_row(
                        "section-terminal",
                        ">_",
                        "Terminal",
                        terminal_selected,
                        cx,
                        |this, window, cx| this.switch_section(Section::Terminal, window, cx),
                    ))
                    .children(sessions)
                    .child(self.render_nav_row(
                        "section-database",
                        "DB",
                        "Database",
                        self.section == Section::Database,
                        cx,
                        |this, window, cx| this.switch_section(Section::Database, window, cx),
                    )),
            )
    }

    /// Title bar above the terminal. While the sidebar is closed it also hosts the toolbar,
    /// so the sidebar can be reopened.
    fn render_header(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let leading = if self.sidebar_open {
            div().into_any_element()
        } else {
            self.render_toolbar(cx).into_any_element()
        };
        div()
            .flex()
            .items_center()
            .h(px(HEADER_HEIGHT))
            .flex_shrink_0()
            .border_b_1()
            .border_color(rgb(BORDER))
            .text_color(rgb(TEXT_PRIMARY))
            .text_size(px(13.))
            .child(leading)
            .child(div().px_4().child(format!("Terminal {}", self.active + 1)))
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
            .child(match self.sessions.len() {
                1 => "1 session".to_string(),
                n => format!("{n} sessions"),
            })
    }
}

impl Render for RootView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let inset = if self.sidebar_open { SIDEBAR_WIDTH } else { 0.0 };
        for session in &self.sessions {
            session.update(cx, |session, _| session.inset_left = inset);
        }

        let body = match self.section {
            Section::Terminal => div()
                .flex()
                .flex_col()
                .flex_1()
                .min_w_0()
                .child(self.render_header(cx))
                .child(self.sessions[self.active].clone())
                .child(self.render_status())
                .into_any_element(),
            Section::Database => div()
                .flex()
                .flex_col()
                .flex_1()
                .min_w_0()
                .child(self.render_database_placeholder())
                .into_any_element(),
        };

        let root = div().flex().size_full().bg(rgb(BACKGROUND));
        let root = if self.sidebar_open { root.child(self.render_sidebar(cx)) } else { root };
        root.child(body)
    }
}
