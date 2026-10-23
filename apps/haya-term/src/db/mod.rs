//! Database section: saved connections and the schema navigator. Tabs live in the workspace strip.

mod bridge;
mod store;
mod tab;

use std::sync::Arc;

use gpui_kit::component::input::{Input, InputState};
use gpui_kit::*;
use haya_db::{Connection, Dialect, Profile};

pub use tab::DbTab;

use crate::{ACCENT, BORDER, SIDEBAR_BG, SIDEBAR_HOVER, SIDEBAR_SELECTED, TEXT_MUTED, TEXT_PRIMARY};

const ERROR: u32 = 0xff6b6b;

/// Events the navigator sends to the workspace, which owns the tab strip.
pub enum DbEvent {
    OpenTable { profile: String, schema: String, table: String },
    NewQuery,
}

impl EventEmitter<DbEvent> for DbView {}

struct SchemaNode {
    name: String,
    tables: Option<Vec<String>>,
    expanded: bool,
}

/// The live connection. Opening a second profile replaces it.
struct Active {
    profile: usize,
    conn: Arc<Connection>,
    schemas: Vec<SchemaNode>,
}

struct Form {
    name: Entity<InputState>,
    host: Entity<InputState>,
    port: Entity<InputState>,
    user: Entity<InputState>,
    password: Entity<InputState>,
    database: Entity<InputState>,
    dialect: Dialect,
    error: Option<String>,
}

pub struct DbView {
    profiles: Vec<Profile>,
    active: Option<Active>,
    form: Option<Form>,
    status: Option<String>,
}

impl DbView {
    pub fn new(_window: &mut Window, _cx: &mut Context<Self>) -> Self {
        Self { profiles: store::load(), active: None, form: None, status: None }
    }

    /// The active connection, for tabs that need to run SQL.
    pub fn connection(&self) -> Option<(String, Arc<Connection>)> {
        let active = self.active.as_ref()?;
        Some((self.profiles[active.profile].name.clone(), active.conn.clone()))
    }

    fn connect(&mut self, index: usize, cx: &mut Context<Self>) {
        let Some(mut profile) = self.profiles.get(index).cloned() else { return };
        profile.password = store::password(&profile.name);
        self.status = Some(format!("Connecting to {}…", profile.name));
        cx.notify();

        bridge::run(
            cx,
            async move {
                let conn = Connection::connect(&profile).await?;
                let schemas = conn.schemas().await?;
                Ok((conn, schemas))
            },
            move |view, result, cx| {
                match result {
                    Ok((conn, schemas)) => {
                        view.status = None;
                        view.active = Some(Active {
                            profile: index,
                            conn: Arc::new(conn),
                            schemas: schemas
                                .into_iter()
                                .map(|name| SchemaNode { name, tables: None, expanded: false })
                                .collect(),
                        });
                    }
                    Err(error) => view.status = Some(format!("{error:#}")),
                }
                cx.notify();
            },
        );
    }

    fn toggle_schema(&mut self, schema: usize, cx: &mut Context<Self>) {
        let Some(active) = self.active.as_mut() else { return };
        let Some(node) = active.schemas.get_mut(schema) else { return };
        node.expanded = !node.expanded;
        if !node.expanded || node.tables.is_some() {
            cx.notify();
            return;
        }

        let conn = active.conn.clone();
        let name = node.name.clone();
        bridge::run(
            cx,
            async move { conn.tables(&name).await },
            move |view, result, cx| {
                if let (Some(active), Ok(tables)) = (view.active.as_mut(), result) {
                    if let Some(node) = active.schemas.get_mut(schema) {
                        node.tables = Some(tables);
                    }
                }
                cx.notify();
            },
        );
        cx.notify();
    }

    fn open_table(&mut self, schema: String, table: String, cx: &mut Context<Self>) {
        let Some(active) = self.active.as_ref() else { return };
        let profile = self.profiles[active.profile].name.clone();
        cx.emit(DbEvent::OpenTable { profile, schema, table });
    }

    /// Called from the workspace + menu; same as the navigator's "New query".
    pub fn new_query_from_menu(&mut self, cx: &mut Context<Self>) {
        self.new_query(cx);
    }

    fn new_query(&mut self, cx: &mut Context<Self>) {
        if self.active.is_none() {
            self.status = Some("Connect to a database first".into());
            cx.notify();
            return;
        }
        cx.emit(DbEvent::NewQuery);
    }

    // ----- connection form -----------------------------------------------------------------

    fn open_form(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let field = |window: &mut Window, cx: &mut Context<Self>, value: &str, placeholder: &str| {
            cx.new(|cx| {
                InputState::new(window, cx)
                    .placeholder(placeholder.to_string())
                    .default_value(value.to_string())
            })
        };
        self.form = Some(Form {
            name: field(window, cx, "", "Name"),
            host: field(window, cx, "localhost", "Host"),
            port: field(window, cx, "5432", "Port"),
            user: field(window, cx, "postgres", "User"),
            password: field(window, cx, "", "Password"),
            database: field(window, cx, "haya", "Database"),
            dialect: Dialect::Postgres,
            error: None,
        });
        cx.notify();
    }

    fn save_form(&mut self, cx: &mut Context<Self>) {
        let Some(form) = self.form.as_mut() else { return };
        let read = |state: &Entity<InputState>| state.read(cx).value().trim().to_string();
        let port: u16 = match read(&form.port).parse() {
            Ok(port) => port,
            Err(_) => {
                form.error = Some("Port must be a number".into());
                cx.notify();
                return;
            }
        };
        let name = read(&form.name);
        let profile = Profile {
            name: if name.is_empty() { read(&form.host) } else { name },
            dialect: form.dialect,
            host: read(&form.host),
            port,
            user: read(&form.user),
            password: None,
            database: read(&form.database),
        };
        if let Err(error) = haya_db::validate(&profile) {
            form.error = Some(format!("{error:#}"));
            cx.notify();
            return;
        }
        let password = read(&form.password);
        if !password.is_empty() {
            if let Err(error) = store::set_password(&profile.name, &password) {
                form.error = Some(format!("Keychain: {error:#}"));
                cx.notify();
                return;
            }
        }
        self.profiles.retain(|p| p.name != profile.name);
        self.profiles.push(profile);
        if let Err(error) = store::save(&self.profiles) {
            self.status = Some(format!("Could not save connections: {error:#}"));
        }
        self.form = None;
        cx.notify();
    }

    fn set_dialect(&mut self, dialect: Dialect, cx: &mut Context<Self>) {
        if let Some(form) = self.form.as_mut() {
            form.dialect = dialect;
        }
        cx.notify();
    }

    fn close_form(&mut self, cx: &mut Context<Self>) {
        self.form = None;
        cx.notify();
    }

    // ----- rendering -----------------------------------------------------------------------

    /// Sidebar: saved connections, then the schema tree of the active connection.
    pub fn sidebar(&self, _window: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        if let Some(form) = &self.form {
            return self.render_form(form, cx);
        }

        let mut list = div().flex().flex_col().gap_0p5().px_2().pt_2();
        list = list.child(
            div()
                .id("db-new-connection")
                .px_3()
                .py_1p5()
                .rounded_md()
                .cursor_pointer()
                .text_size(px(13.))
                .text_color(rgb(TEXT_PRIMARY))
                .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                .on_click(cx.listener(|this, _: &ClickEvent, window, cx| this.open_form(window, cx)))
                .child("+  New connection"),
        );
        list = list.child(section_label("Connections"));
        if self.profiles.is_empty() {
            list = list.child(muted_text("No connections yet"));
        }
        for (index, profile) in self.profiles.iter().enumerate() {
            let connected = self.active.as_ref().is_some_and(|a| a.profile == index);
            list = list.child(
                div()
                    .id(("db-profile", index))
                    .px_3()
                    .py_1p5()
                    .rounded_md()
                    .cursor_pointer()
                    .text_size(px(13.))
                    .text_color(rgb(if connected { TEXT_PRIMARY } else { TEXT_MUTED }))
                    .bg(rgb(if connected { SIDEBAR_SELECTED } else { SIDEBAR_BG }))
                    .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                    .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| this.connect(index, cx)))
                    .child(format!("{}  ·  {}", profile.name, dialect_label(profile.dialect))),
            );
        }
        if let Some(status) = &self.status {
            list = list.child(div().px_3().text_size(px(12.)).text_color(rgb(ERROR)).child(status.clone()));
        }

        if let Some(active) = &self.active {
            list = list.child(section_label("Schemas"));
            for (index, schema) in active.schemas.iter().enumerate() {
                list = list.child(
                    div()
                        .id(("db-schema", index))
                        .px_3()
                        .py_1()
                        .rounded_md()
                        .cursor_pointer()
                        .text_size(px(12.))
                        .text_color(rgb(TEXT_PRIMARY))
                        .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                        .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| this.toggle_schema(index, cx)))
                        .child(format!("{} {}", if schema.expanded { "▾" } else { "▸" }, schema.name)),
                );
                if schema.expanded {
                    for (table_index, table) in schema.tables.iter().flatten().enumerate() {
                        let schema_name = schema.name.clone();
                        let table_name = table.clone();
                        list = list.child(
                            div()
                                .id(("db-table", index * 10_000 + table_index))
                                .ml_5()
                                .px_2()
                                .py_0p5()
                                .rounded_md()
                                .cursor_pointer()
                                .text_size(px(12.))
                                .text_color(rgb(TEXT_MUTED))
                                .hover(|el| el.bg(rgb(SIDEBAR_HOVER)).text_color(rgb(TEXT_PRIMARY)))
                                .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| {
                                    this.open_table(schema_name.clone(), table_name.clone(), cx)
                                }))
                                .child(table.clone()),
                        );
                    }
                }
            }
            list = list.child(
                div()
                    .id("db-sidebar-query")
                    .mt_2()
                    .px_3()
                    .py_1p5()
                    .rounded_md()
                    .cursor_pointer()
                    .text_size(px(12.))
                    .text_color(rgb(ACCENT))
                    .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                    .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.new_query(cx)))
                    .child("+ New query"),
            );
        }
        list.into_any_element()
    }

    fn render_form(&self, form: &Form, cx: &mut Context<Self>) -> AnyElement {
        let dialect_button = |label: &'static str, dialect: Dialect, selected: bool| {
            div()
                .id(label)
                .flex_1()
                .px_2()
                .py_1()
                .rounded_md()
                .cursor_pointer()
                .text_size(px(12.))
                .text_center()
                .text_color(rgb(if selected { TEXT_PRIMARY } else { TEXT_MUTED }))
                .bg(rgb(if selected { SIDEBAR_SELECTED } else { SIDEBAR_BG }))
                .hover(|el| el.bg(rgb(SIDEBAR_HOVER)))
                .on_click(cx.listener(move |this, _: &ClickEvent, _, cx| this.set_dialect(dialect, cx)))
                .child(label)
        };

        let mut column = div().flex().flex_col().gap_2().px_3().pt_2();
        column = column.child(section_label("New connection"));
        column = column.child(
            div()
                .flex()
                .gap_1()
                .child(dialect_button("PostgreSQL", Dialect::Postgres, form.dialect == Dialect::Postgres))
                .child(dialect_button("CrateDB", Dialect::CrateDb, form.dialect == Dialect::CrateDb)),
        );
        for (label, state) in [
            ("Name", &form.name),
            ("Host", &form.host),
            ("Port", &form.port),
            ("User", &form.user),
            ("Password", &form.password),
            ("Database", &form.database),
        ] {
            column = column.child(
                div()
                    .flex()
                    .flex_col()
                    .gap_0p5()
                    .child(div().text_size(px(11.)).text_color(rgb(TEXT_MUTED)).child(label))
                    .child(Input::new(state)),
            );
        }
        if let Some(error) = &form.error {
            column = column.child(div().text_size(px(12.)).text_color(rgb(ERROR)).child(error.clone()));
        }
        column = column.child(
            div()
                .flex()
                .gap_2()
                .pt_2()
                .child(
                    div()
                        .id("db-form-save")
                        .flex_1()
                        .px_3()
                        .py_1()
                        .rounded_md()
                        .cursor_pointer()
                        .bg(rgb(ACCENT))
                        .text_color(rgb(0x1c1c1e))
                        .text_size(px(12.))
                        .text_center()
                        .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.save_form(cx)))
                        .child("Save"),
                )
                .child(
                    div()
                        .id("db-form-cancel")
                        .flex_1()
                        .px_3()
                        .py_1()
                        .rounded_md()
                        .cursor_pointer()
                        .border_1()
                        .border_color(rgb(BORDER))
                        .text_color(rgb(TEXT_PRIMARY))
                        .text_size(px(12.))
                        .text_center()
                        .on_click(cx.listener(|this, _: &ClickEvent, _, cx| this.close_form(cx)))
                        .child("Cancel"),
                ),
        );
        column.into_any_element()
    }
}

fn dialect_label(dialect: Dialect) -> &'static str {
    match dialect {
        Dialect::Postgres => "PostgreSQL",
        Dialect::CrateDb => "CrateDB",
    }
}

fn section_label(text: &str) -> impl IntoElement {
    div()
        .px_3()
        .pt_3()
        .pb_1()
        .text_size(px(11.))
        .text_color(rgb(TEXT_MUTED))
        .child(text.to_string())
}

fn muted_text(text: &str) -> impl IntoElement {
    div().px_3().text_size(px(12.)).text_color(rgb(TEXT_MUTED)).child(text.to_string())
}
