//! Database connections for Haya.
//!
//! Both PostgreSQL and CrateDB speak PostgreSQL wire protocol v3. Dialect differences
//! (default schema, catalog queries, identifier rules) live in this crate, not in the UI.

use std::time::{Duration, Instant};

use anyhow::{Context as _, Result, bail};
use futures_util::TryStreamExt;
pub use tokio_postgres::CancelToken;
use tokio_postgres::{Client, Config, NoTls, SimpleQueryMessage};

/// Which server dialect a connection talks to.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Dialect {
    Postgres,
    CrateDb,
}

impl Dialect {
    /// The schema a new connection starts in when none is named.
    pub fn default_schema(self) -> &'static str {
        match self {
            Dialect::Postgres => "public",
            Dialect::CrateDb => "doc",
        }
    }
}

/// Connection settings. The password is held only in memory; storing it is the caller's job (Keychain).
#[derive(Clone, Debug)]
pub struct Profile {
    pub name: String,
    pub dialect: Dialect,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    /// PostgreSQL database name. CrateDB ignores it and uses schemas instead.
    pub database: String,
}

/// Result of a query, with rows already capped to the caller's limit.
#[derive(Debug, Default)]
pub struct QueryResult {
    pub columns: Vec<String>,
    /// Text cells. `None` is SQL NULL.
    pub rows: Vec<Vec<Option<String>>>,
    /// True when the server returned more rows than were kept.
    pub truncated: bool,
    /// Rows counted by the server for non-SELECT statements.
    pub rows_affected: Option<u64>,
    pub elapsed: Duration,
}

/// Quotes an identifier (schema, table, column) for use in SQL.
///
/// Every generated statement must go through this function. Never splice raw names into SQL.
pub fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

/// A SQL string literal. Single quotes are doubled, so user text cannot end the literal early.
pub fn literal(text: &str) -> String {
    format!("'{}'", text.replace('\'', "''"))
}

/// A cell value as SQL: NULL, or a quoted literal that the column type will coerce.
pub fn value_literal(value: &Option<String>) -> String {
    match value {
        Some(text) => literal(text),
        None => "NULL".to_string(),
    }
}

/// An open connection to one database.
pub struct Connection {
    dialect: Dialect,
    client: Client,
}

impl Connection {
    /// Opens a connection. Must run inside a Tokio runtime, because the socket is driven by a spawned task.
    pub async fn connect(profile: &Profile) -> Result<Self> {
        let mut config = Config::new();
        config
            .host(&profile.host)
            .port(profile.port)
            .user(&profile.user)
            .dbname(&profile.database)
            .connect_timeout(Duration::from_secs(10));
        if let Some(password) = &profile.password {
            config.password(password);
        }

        // TLS is not wired yet. Only local development servers should use this path.
        let (client, connection) = config
            .connect(NoTls)
            .await
            .with_context(|| format!("connect to {}:{} failed", profile.host, profile.port))?;
        tokio::spawn(async move {
            let _ = connection.await;
        });

        Ok(Self { dialect: profile.dialect, client })
    }

    pub fn dialect(&self) -> Dialect {
        self.dialect
    }

    /// Token that cancels the statement currently running on this connection.
    pub fn cancel_token(&self) -> CancelToken {
        self.client.cancel_token()
    }

    /// Lists user schemas, excluding PostgreSQL system schemas.
    pub async fn schemas(&self) -> Result<Vec<String>> {
        let sql = match self.dialect {
            Dialect::Postgres => {
                "SELECT nspname FROM pg_namespace \
                 WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' \
                 ORDER BY nspname"
            }
            Dialect::CrateDb => {
                "SELECT DISTINCT table_schema FROM information_schema.tables \
                 WHERE table_schema NOT IN ('information_schema', 'sys') ORDER BY table_schema"
            }
        };
        self.single_column(sql).await
    }

    /// Lists tables and views in a schema.
    pub async fn tables(&self, schema: &str) -> Result<Vec<String>> {
        let sql = format!(
            "SELECT table_name FROM information_schema.tables \
             WHERE table_schema = '{}' ORDER BY table_name",
            schema.replace('\'', "''")
        );
        self.single_column(&sql).await
    }

    /// Reads one page of a table, server-side. `offset` and `limit` are numbers, not user text.
    pub async fn page(&self, schema: &str, table: &str, offset: u64, limit: u64) -> Result<QueryResult> {
        let sql = format!(
            "SELECT * FROM {}.{} LIMIT {limit} OFFSET {offset}",
            quote_ident(schema),
            quote_ident(table)
        );
        // A page is bounded by `limit`, so keeping every row it returns is safe.
        self.run(&sql, limit as usize).await
    }

    /// Column names of the primary key, in key order. Empty when the table has none.
    pub async fn primary_key(&self, schema: &str, table: &str) -> Result<Vec<String>> {
        if self.dialect() != Dialect::Postgres {
            return Ok(Vec::new());
        }
        let sql = format!(
            "SELECT kcu.column_name FROM information_schema.table_constraints tc \
             JOIN information_schema.key_column_usage kcu \
               ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema \
             WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = {} AND tc.table_name = {} \
             ORDER BY kcu.ordinal_position",
            literal(schema),
            literal(table)
        );
        self.single_column(&sql).await
    }

    /// Updates one row, found by its primary key. Values are text, or None for NULL.
    /// Only PostgreSQL writes are supported for now.
    pub async fn update_row(
        &self,
        schema: &str,
        table: &str,
        key: &[(String, Option<String>)],
        changes: &[(String, Option<String>)],
    ) -> Result<()> {
        self.require_write()?;
        anyhow::ensure!(!key.is_empty(), "this table has no primary key, so rows cannot be edited");
        anyhow::ensure!(!changes.is_empty(), "nothing to change");
        let set = changes
            .iter()
            .map(|(col, value)| format!("{} = {}", quote_ident(col), value_literal(value)))
            .collect::<Vec<_>>()
            .join(", ");
        let where_ = key
            .iter()
            .map(|(col, value)| match value {
                Some(_) => format!("{} = {}", quote_ident(col), value_literal(value)),
                None => format!("{} IS NULL", quote_ident(col)),
            })
            .collect::<Vec<_>>()
            .join(" AND ");
        let sql = format!("UPDATE {}.{} SET {set} WHERE {where_}", quote_ident(schema), quote_ident(table));
        self.run_write(&sql).await
    }

    /// Inserts one row. Columns left out are not sent, so the database defaults apply.
    pub async fn insert_row(&self, schema: &str, table: &str, values: &[(String, Option<String>)]) -> Result<()> {
        self.require_write()?;
        let cols = values.iter().map(|(c, _)| quote_ident(c)).collect::<Vec<_>>().join(", ");
        let vals = values.iter().map(|(_, v)| value_literal(v)).collect::<Vec<_>>().join(", ");
        let sql = if values.is_empty() {
            format!("INSERT INTO {}.{} DEFAULT VALUES", quote_ident(schema), quote_ident(table))
        } else {
            format!("INSERT INTO {}.{} ({cols}) VALUES ({vals})", quote_ident(schema), quote_ident(table))
        };
        self.run_write(&sql).await
    }

    fn require_write(&self) -> Result<()> {
        anyhow::ensure!(self.dialect() == Dialect::Postgres, "editing rows is only supported for PostgreSQL for now");
        Ok(())
    }

    /// Runs one write inside a transaction, so a failed statement changes nothing.
    async fn run_write(&self, sql: &str) -> Result<()> {
        let wrapped = format!("BEGIN; {sql}; COMMIT;");
        self.client.batch_execute(&wrapped).await.map_err(|e| {
            let _ = self.client.batch_execute("ROLLBACK;");
            anyhow::anyhow!(e.to_string())
        })
    }

    /// Runs user-authored SQL exactly as written. Keeps at most `row_cap` rows in memory.
    pub async fn execute(&self, sql: &str, row_cap: usize) -> Result<QueryResult> {
        self.run(sql, row_cap).await
    }

    async fn single_column(&self, sql: &str) -> Result<Vec<String>> {
        let result = self.run(sql, usize::MAX).await?;
        Ok(result
            .rows
            .into_iter()
            .filter_map(|row| row.into_iter().next().flatten())
            .collect())
    }

    /// Streams a statement and keeps at most `row_cap` rows. Remaining rows are drained, not stored,
    /// so the connection stays usable after a capped result.
    async fn run(&self, sql: &str, row_cap: usize) -> Result<QueryResult> {
        let started = Instant::now();
        let stream = self
            .client
            .simple_query_raw(sql)
            .await
            .context("query failed to start")?;
        let mut stream = std::pin::pin!(stream);

        let mut result = QueryResult::default();
        while let Some(message) = stream.try_next().await.context("query failed")? {
            match message {
                SimpleQueryMessage::RowDescription(columns) => {
                    result.columns = columns.iter().map(|c| c.name().to_string()).collect();
                }
                SimpleQueryMessage::Row(row) => {
                    if result.rows.len() < row_cap {
                        let cells = (0..row.len())
                            .map(|i| row.try_get(i).map(|v| v.map(str::to_string)))
                            .collect::<Result<Vec<_>, _>>()
                            .context("reading row failed")?;
                        result.rows.push(cells);
                    } else {
                        result.truncated = true;
                    }
                }
                SimpleQueryMessage::CommandComplete(count) => {
                    result.rows_affected = Some(count);
                }
                _ => {}
            }
        }
        result.elapsed = started.elapsed();
        Ok(result)
    }
}

/// Cancels a running statement using a token obtained from [`Connection::cancel_token`].
pub async fn cancel(token: &CancelToken) -> Result<()> {
    token.cancel_query(NoTls).await.context("cancel failed")?;
    Ok(())
}

/// Rejects a profile that cannot be used, before any network call.
pub fn validate(profile: &Profile) -> Result<()> {
    if profile.host.trim().is_empty() {
        bail!("host is empty");
    }
    if profile.user.trim().is_empty() {
        bail!("user is empty");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::quote_ident;

    #[test]
    fn quotes_plain_names() {
        assert_eq!(quote_ident("users"), "\"users\"");
    }

    #[test]
    fn escapes_embedded_quotes() {
        assert_eq!(quote_ident("we\"ird"), "\"we\"\"ird\"");
    }

    #[test]
    fn keeps_spaces_and_dots_inside_quotes() {
        assert_eq!(quote_ident("my table.v2"), "\"my table.v2\"");
    }
}

#[cfg(test)]
mod literal_tests {
    use super::*;

    #[test]
    fn quotes_are_doubled_so_text_cannot_end_the_literal() {
        assert_eq!(literal("o'brien"), "'o''brien'");
        assert_eq!(literal("x'; DROP TABLE t; --"), "'x''; DROP TABLE t; --'");
    }

    #[test]
    fn none_is_sql_null() {
        assert_eq!(value_literal(&None), "NULL");
        assert_eq!(value_literal(&Some("a".into())), "'a'");
    }
}
