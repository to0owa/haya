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
const BACKGROUND: u32 = 0x1e1e1e;
const FOREGROUND: u32 = 0xd4d4d4;

pub struct TerminalView {
    focus_handle: FocusHandle,
    pty: Option<PtySession>,
    term: Term<VoidListener>,
    parser: Processor,
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

impl Render for TerminalView {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
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
            .track_focus(&self.focus_handle)
            .on_key_down(cx.listener(Self::on_key))
            .size_full()
            .bg(rgb(BACKGROUND))
            .text_color(rgb(FOREGROUND))
            .font_family("Menlo")
            .text_size(px(13.))
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
        gpui_kit::open_window(WindowOptions::default(), cx, |window, cx| {
            let view = TerminalView::new(window, cx);
            cx.new(|_| RootView { terminal: view })
        })
        .expect("Failed to open window");
    });
}

struct RootView {
    terminal: Entity<TerminalView>,
}

impl Render for RootView {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        self.terminal.clone()
    }
}
