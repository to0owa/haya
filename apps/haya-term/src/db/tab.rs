//! A database tab: either a paged table grid or a SQL query with its results.

use std::sync::Arc;

use gpui_kit::component::input::{Textarea, TextareaState};
use gpui_kit::*;
use haya_db::{CancelToken, Connection, QueryResult};

use super::bridge;
use crate::{ACCENT, BORDER, SIDEBAR_HOVER, TEXT_MUTED, TEXT_PRIMARY};

const PAGE_SIZE: u64 = 200;
/// Rows kept in memory for a query result. The SQL itself is never rewritten.
const ROW_CAP_CHOICES: [usize; 3] = [100, 1000, 10_000];
const ROW_HEIGHT: f32 = 26.0;
const HEADER_HEIGHT: f32 = 28.0;
const GUTTER_WIDTH: f32 = 56.0;
const CHAR_WIDTH: f32 = 7.4;
const MIN_COLUMN: f32 = 80.0;
const MAX_COLUMN: f32 = 360.0;
const ERROR: u32 = 0xff6b6b;
const GRID_BG: u32 = 0x1c1c1e;
const GRID_ALT: u32 = 0x202024;
const GRID_HEADER: u32 = 0x26262a;
const GRID_BORDER: u32 = 0x333338;
const GRID_SELECTED: u32 = 0x2a5bd7;
const GRID_MUTED: u32 = 0x6e6e76;

enum Kind {
    Table { schema: String, table: String },
    Query { editor: Entity<TextareaState> },
}

pub struct DbTab {
    /// Name of the connection profile this tab belongs to.
    profile: String,
    title: String,
    kind: Kind,
    conn: Arc<Connection>,
    result: Option<Arc<QueryResult>>,
    error: Option<String>,
    running: bool,
    cancel: Option<CancelToken>,
    selected_row: Option<usize>,
    row_cap: usize,
}

/// The statement under the cursor, or the selected text when something is selected.
///
/// Statements are split on `;`. A `;` inside a string or comment is not special-cased yet.
pub fn statement_at(text: &str, cursor: usize, selection: Option<&str>) -> String {
    if let Some(selected) = selection.map(str::trim).filter(|s| !s.is_empty()) {
        return selected.to_string();
    }
    let cursor = cursor.min(text.len());
    let cursor = (0..=cursor).rev().find(|&i| text.is_char_boundary(i)).unwrap_or(0);
    let start = text[..cursor].rfind(';').map_or(0, |i| i + 1);
    let end = text[cursor..].find(';').map_or(text.len(), |i| cursor + i + 1);
    let statement = text[start..end].trim();
    if statement.is_empty() { text.trim().to_string() } else { statement.to_string() }
}

#[cfg(test)]
mod tests {
    use super::statement_at;

    #[test]
    fn picks_the_statement_under_the_cursor() {
        let text = "SELECT 1;
SELECT 2;
SELECT 3";
        assert_eq!(statement_at(text, 3, None), "SELECT 1;");
        assert_eq!(statement_at(text, 14, None), "SELECT 2;");
        assert_eq!(statement_at(text, text.len(), None), "SELECT 3");
    }

    #[test]
    fn selection_wins_over_cursor() {
        assert_eq!(statement_at("SELECT 1; SELECT 2;", 0, Some("  SELECT 2  ")), "SELECT 2");
    }

    #[test]
    fn empty_cursor_statement_falls_back_to_whole_text() {
        assert_eq!(statement_at("  ;  ", 2, None), ";");
    }
}

impl DbTab {
    /// Opens a paged, read-only view of a table and loads its first page.
    pub fn open_table(
        profile: String,
        conn: Arc<Connection>,
        schema: String,
        table: String,
        cx: &mut App,
    ) -> Entity<Self> {
        let tab = cx.new(|_| Self {
            profile,
            title: format!("{schema}.{table}"),
            kind: Kind::Table { schema: schema.clone(), table: table.clone() },
            conn: conn.clone(),
            result: None,
            error: None,
            running: true,
            cancel: None,
            selected_row: None,
            row_cap: ROW_CAP_CHOICES[1],
        });
        tab.update(cx, |_, cx| {
            bridge::run(
                cx,
                async move { conn.page(&schema, &table, 0, PAGE_SIZE).await },
                |tab, result, cx| {
                    tab.running = false;
                    match result {
                        Ok(page) => tab.result = Some(Arc::new(page)),
                        Err(error) => tab.error = Some(format!("{error:#}")),
                    }
                    cx.notify();
                },
            );
        });
        tab
    }

    /// Creates an empty SQL editor tab on the given connection.
    pub fn new_query(
        profile: String,
        conn: Arc<Connection>,
        title: String,
        initial_sql: &str,
        window: &mut Window,
        cx: &mut App,
    ) -> Entity<Self> {
        let editor = cx.new(|cx| {
            TextareaState::new(window, cx)
                .placeholder("Write SQL here, then press Run")
                .default_value(initial_sql.to_string())
        });
        cx.new(|_| Self {
            profile,
            title,
            kind: Kind::Query { editor },
            conn,
            result: None,
            error: None,
            running: false,
            cancel: None,
            selected_row: None,
            row_cap: ROW_CAP_CHOICES[1],
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn profile_name(&self) -> &str {
        &self.profile
    }

    pub fn dialect(&self) -> haya_db::Dialect {
        self.conn.dialect()
    }

    pub fn result(&self) -> Option<Arc<QueryResult>> {
        self.result.clone()
    }

    pub fn selected_row(&self) -> Option<usize> {
        self.selected_row
    }

    pub fn is_running(&self) -> bool {
        self.running
    }

    pub fn error(&self) -> Option<&str> {
        self.error.as_deref()
    }

    /// True when this tab shows the given table on the given profile.
    pub fn shows_table(&self, profile: &str, schema: &str, table: &str) -> bool {
        matches!(&self.kind, Kind::Table { schema: s, table: t } if s == schema && t == table)
            && self.profile == profile
    }

    fn run_query(&mut self, cx: &mut Context<Self>) {
        let Kind::Query { editor } = &self.kind else { return };
        let state = editor.read(cx);
        let text = state.value().to_string();
        let selection = state.selected_text().to_string();
        let selection = (!state.selected_range().is_empty()).then_some(selection);
        let sql = statement_at(&text, state.cursor(), selection.as_deref());
        if sql.trim().is_empty() {
            return;
        }
        let row_cap = self.row_cap;
        let conn = self.conn.clone();
        self.running = true;
        self.error = None;
        self.result = None;
        self.cancel = Some(conn.cancel_token());
        cx.notify();

        bridge::run(
            cx,
            async move { conn.execute(&sql, row_cap).await },
            |tab, result, cx| {
                tab.running = false;
                tab.cancel = None;
                match result {
                    Ok(query) => tab.result = Some(Arc::new(query)),
                    Err(error) => tab.error = Some(format!("{error:#}")),
                }
                cx.notify();
            },
        );
    }

    fn cycle_row_cap(&mut self, cx: &mut Context<Self>) {
        let index = ROW_CAP_CHOICES.iter().position(|&c| c == self.row_cap).unwrap_or(0);
        self.row_cap = ROW_CAP_CHOICES[(index + 1) % ROW_CAP_CHOICES.len()];
        cx.notify();
    }

    fn cancel_query(&mut self, cx: &mut Context<Self>) {
        let Some(token) = self.cancel.clone() else { return };
        bridge::run(cx, async move { haya_db::cancel(&token).await }, |_, _, _| {});
    }

    fn render_query_toolbar(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let run = div()
            .id("db-run")
            .px_3()
            .py_1()
            .rounded_md()
            .text_size(px(12.))
            .bg(rgb(ACCENT))
            .text_color(rgb(0x1c1c1e));
        let run = if self.running {
            run.opacity(0.5).child("Running…")
        } else {
            run.cursor_pointer()
                .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.run_query(cx)))
                .child("Run")
        };

        let cap = div()
            .id("db-row-cap")
            .px_3()
            .py_1()
            .rounded_md()
            .cursor_pointer()
            .border_1()
            .border_color(rgb(BORDER))
            .text_color(rgb(TEXT_PRIMARY))
            .text_size(px(12.))
            .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
            .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.cycle_row_cap(cx)))
            .child(format!("Keep {} rows", self.row_cap));

        let mut toolbar = div()
            .flex()
            .items_center()
            .gap_2()
            .px_3()
            .py_2()
            .border_b_1()
            .border_color(rgb(BORDER))
            .child(run)
            .child(cap);
        if self.running {
            toolbar = toolbar.child(
                div()
                    .id("db-cancel")
                    .px_3()
                    .py_1()
                    .rounded_md()
                    .cursor_pointer()
                    .border_1()
                    .border_color(rgb(BORDER))
                    .text_color(rgb(TEXT_PRIMARY))
                    .text_size(px(12.))
                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.cancel_query(cx)))
                    .child("Cancel"),
            );
        }
        toolbar
    }

    fn render_result(&self, cx: &mut Context<Self>) -> AnyElement {
        if self.running && self.result.is_none() {
            return status_line("Loading…", TEXT_MUTED);
        }
        if let Some(error) = &self.error {
            return status_line(error, ERROR);
        }
        let Some(result) = self.result.clone() else {
            return status_line("Nothing to show yet", TEXT_MUTED);
        };

        let summary = match result.rows_affected {
            Some(count) if result.columns.is_empty() => format!("{count} rows affected"),
            _ => format!(
                "{} rows{} · {} ms",
                result.rows.len(),
                if result.truncated { " (capped)" } else { "" },
                result.elapsed.as_millis()
            ),
        };
        let mut column = div().flex().flex_col().flex_1().min_h_0().child(
            div()
                .px_3()
                .py_1()
                .text_size(px(11.))
                .text_color(rgb(TEXT_MUTED))
                .border_b_1()
                .border_color(rgb(BORDER))
                .child(summary),
        );
        if !result.columns.is_empty() {
            column = column.child(grid(&result, self.selected_row, cx.entity().downgrade()));
        }
        column.into_any_element()
    }
}

impl Render for DbTab {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let mut column = div().flex().flex_col().flex_1().min_h_0().bg(rgb(GRID_BG));
        if let Kind::Query { editor } = &self.kind {
            column = column
                .child(
                    div()
                        .h(px(160.))
                        .flex_shrink_0()
                        .border_b_1()
                        .border_color(rgb(BORDER))
                        .child(Textarea::new(editor).bordered(false).h(relative(1.))),
                )
                .child(self.render_query_toolbar(cx));
        }
        column.child(self.render_result(cx))
    }
}

fn status_line(text: &str, color: u32) -> AnyElement {
    div()
        .px_3()
        .py_2()
        .text_size(px(12.))
        .text_color(rgb(color))
        .child(text.to_string())
        .into_any_element()
}

/// Estimated pixel width of a column from its header and the first rows.
fn column_width(result: &QueryResult, column: usize) -> f32 {
    let header = result.columns[column].chars().count();
    let widest = result
        .rows
        .iter()
        .take(200)
        .filter_map(|row| row.get(column).and_then(|cell| cell.as_ref()))
        .map(|cell| cell.chars().count())
        .max()
        .unwrap_or(0);
    let chars = header.max(widest) as f32;
    (chars * CHAR_WIDTH + 24.0).clamp(MIN_COLUMN, MAX_COLUMN)
}

/// A column is numeric when every non-null sample parses as a number. Numbers align right.
fn is_numeric(result: &QueryResult, column: usize) -> bool {
    let mut seen = false;
    for row in result.rows.iter().take(200) {
        if let Some(Some(cell)) = row.get(column) {
            seen = true;
            if cell.parse::<f64>().is_err() {
                return false;
            }
        }
    }
    seen
}

/// Virtualized result grid: row numbers, header, banded rows, monospace cells, and row selection.
fn grid(result: &Arc<QueryResult>, selected: Option<usize>, weak: WeakEntity<DbTab>) -> AnyElement {
    let columns = result.columns.clone();
    let widths: Vec<f32> = (0..columns.len()).map(|c| column_width(result, c)).collect();
    let numeric: Vec<bool> = (0..columns.len()).map(|c| is_numeric(result, c)).collect();
    let total = GUTTER_WIDTH + widths.iter().sum::<f32>();
    let last_column = columns.len().saturating_sub(1);
    let rows = result.clone();
    let body_widths = widths.clone();

    let header = div()
        .flex()
        .flex_shrink_0()
        .h(px(HEADER_HEIGHT))
        .bg(rgb(GRID_HEADER))
        .border_b_1()
        .border_color(rgb(GRID_BORDER))
        .text_size(px(12.))
        .text_color(rgb(TEXT_MUTED))
        .child(div().w(px(GUTTER_WIDTH)).flex_shrink_0().border_r_1().border_color(rgb(GRID_BORDER)))
        .children(columns.iter().zip(&widths).enumerate().map(|(index, (name, width))| {
            let cell = div()
                .px_2()
                .flex()
                .items_center()
                .overflow_hidden()
                .text_ellipsis()
                .border_r_1()
                .border_color(rgb(GRID_BORDER))
                .child(name.clone());
            fill_or_fixed(cell, index == last_column, *width)
        }));

    let body = uniform_list(("db-grid", Arc::as_ptr(result) as usize), rows.rows.len(), move |range, _, _| {
        range
            .map(|index| {
                let row = &rows.rows[index];
                let is_selected = selected == Some(index);
                let background = if is_selected {
                    GRID_SELECTED
                } else if index % 2 == 1 {
                    GRID_ALT
                } else {
                    GRID_BG
                };
                let weak = weak.clone();
                let mut line = div()
                    .id(("db-row", index))
                    .flex()
                    .flex_shrink_0()
                    .h(px(ROW_HEIGHT))
                    .bg(rgb(background))
                    .text_size(px(12.))
                    .font_family("Menlo")
                    .text_color(rgb(if is_selected { 0xffffff } else { TEXT_PRIMARY }))
                    .on_click(move |_, _, cx| {
                        let _ = weak.update(cx, |tab, cx| {
                            tab.selected_row = Some(index);
                            cx.notify();
                        });
                    })
                    .child(
                        div()
                            .w(px(GUTTER_WIDTH))
                            .flex_shrink_0()
                            .px_2()
                            .flex()
                            .items_center()
                            .justify_end()
                            .border_r_1()
                            .border_color(rgb(GRID_BORDER))
                            .text_color(rgb(if is_selected { 0xdfe7ff } else { GRID_MUTED }))
                            .child((index + 1).to_string()),
                    );
                for (column, cell) in row.iter().enumerate() {
                    let empty = cell.is_none();
                    let text = cell.clone().unwrap_or_else(|| "NULL".into());
                    let mut cell_el = div()
                        .px_2()
                        .flex()
                        .items_center()
                        .overflow_hidden()
                        .text_ellipsis()
                        .border_r_1()
                        .border_color(rgb(GRID_BORDER));
                    if numeric[column] {
                        cell_el = cell_el.justify_end();
                    }
                    if empty && !is_selected {
                        cell_el = cell_el.text_color(rgb(GRID_MUTED));
                    }
                    let fixed_width = body_widths[column];
                    line = line.child(fill_or_fixed(cell_el.child(text), column == last_column, fixed_width));
                }
                line
            })
            .collect()
    })
    .flex_1();

    // The grid always fills the pane. When the columns are narrower than the pane, the last column grows;
    // when they are wider, the pane scrolls horizontally.
    div()
        .flex()
        .flex_col()
        .flex_1()
        .min_h_0()
        .w_full()
        .id(("db-grid-scroll", Arc::as_ptr(result) as usize))
        .overflow_x_scroll()
        .child(
            div()
                .flex()
                .flex_col()
                .flex_1()
                .min_h_0()
                .w(relative(1.))
                .min_w(px(total))
                .child(header)
                .child(body),
        )
        .into_any_element()
}

/// A grid cell that either keeps a fixed width or, for the last column, grows to fill the pane.
fn fill_or_fixed(cell: Div, grow: bool, width: f32) -> Div {
    if grow {
        cell.flex_1().min_w(px(width))
    } else {
        cell.w(px(width)).flex_shrink_0()
    }
}
