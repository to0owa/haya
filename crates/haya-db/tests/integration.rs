//! Integration tests against live servers started by the local Docker setup.
//!
//! PostgreSQL: localhost:5432, user postgres, password haya, database haya.
//! CrateDB:    localhost:5433 (wire protocol), user crate, no password.

use haya_db::{Connection, Dialect, Profile, quote_ident};

fn postgres_profile() -> Profile {
    Profile {
        name: "local-postgres".into(),
        dialect: Dialect::Postgres,
        host: "localhost".into(),
        port: 5432,
        user: "postgres".into(),
        password: Some("haya".into()),
        database: "haya".into(),
    }
}

fn crate_profile() -> Profile {
    Profile {
        name: "local-cratedb".into(),
        dialect: Dialect::CrateDb,
        host: "localhost".into(),
        port: 5433,
        user: "crate".into(),
        password: None,
        database: "crate".into(),
    }
}

async fn connect_or_skip(profile: &Profile) -> Option<Connection> {
    match Connection::connect(profile).await {
        Ok(conn) => Some(conn),
        Err(error) => {
            eprintln!("skipping {}: {error:#}", profile.name);
            None
        }
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn postgres_discovers_schemas_and_tables() {
    let Some(conn) = connect_or_skip(&postgres_profile()).await else { return };
    let schemas = conn.schemas().await.expect("schemas");
    assert!(schemas.contains(&"public".to_string()), "schemas: {schemas:?}");
    assert!(!schemas.iter().any(|s| s.starts_with("pg_")));
    conn.tables("public").await.expect("tables");
}

#[tokio::test(flavor = "multi_thread")]
async fn postgres_pages_quoted_names_and_caps_rows() {
    let Some(conn) = connect_or_skip(&postgres_profile()).await else { return };
    let table = "haya \"page\" test";
    let qualified = format!("public.{}", quote_ident(table));

    conn.execute(&format!("DROP TABLE IF EXISTS {qualified}"), 10).await.unwrap();
    conn.execute(&format!("CREATE TABLE {qualified} (id INT, note TEXT)"), 10).await.unwrap();
    let inserted = conn
        .execute(
            &format!("INSERT INTO {qualified} VALUES (1, 'one'), (2, NULL), (3, 'three')"),
            10,
        )
        .await
        .unwrap();
    assert_eq!(inserted.rows_affected, Some(3));

    let names = conn.tables("public").await.unwrap();
    assert!(names.contains(&table.to_string()), "tables: {names:?}");

    let page = conn.page("public", table, 0, 2).await.unwrap();
    assert_eq!(page.columns, vec!["id".to_string(), "note".to_string()]);
    assert_eq!(page.rows.len(), 2);
    assert_eq!(page.rows[1][1], None, "NULL must stay NULL");

    let second = conn.page("public", table, 2, 2).await.unwrap();
    assert_eq!(second.rows.len(), 1);
    assert_eq!(second.rows[0][1].as_deref(), Some("three"));

    let capped = conn.execute(&format!("SELECT * FROM {qualified}"), 1).await.unwrap();
    assert_eq!(capped.rows.len(), 1);
    assert!(capped.truncated, "capped result must report truncation");

    conn.execute(&format!("DROP TABLE {qualified}"), 10).await.unwrap();
}

#[tokio::test(flavor = "multi_thread")]
async fn postgres_reports_sql_errors_without_dropping_connection() {
    let Some(conn) = connect_or_skip(&postgres_profile()).await else { return };
    assert!(conn.execute("SELECT * FROM no_such_table_haya", 10).await.is_err());
    let ok = conn.execute("SELECT 1 AS one", 10).await.unwrap();
    assert_eq!(ok.rows[0][0].as_deref(), Some("1"));
}

#[tokio::test(flavor = "multi_thread")]
async fn cratedb_discovers_doc_schema_and_pages_a_table() {
    let Some(conn) = connect_or_skip(&crate_profile()).await else { return };
    assert_eq!(conn.dialect().default_schema(), "doc");

    conn.execute("DROP TABLE IF EXISTS doc.haya_test", 10).await.unwrap();
    conn.execute("CREATE TABLE doc.haya_test (id INT, name TEXT)", 10).await.unwrap();
    conn.execute("INSERT INTO doc.haya_test (id, name) VALUES (1, 'a'), (2, 'b')", 10)
        .await
        .unwrap();
    conn.execute("REFRESH TABLE doc.haya_test", 10).await.unwrap();

    let schemas = conn.schemas().await.unwrap();
    assert!(schemas.contains(&"doc".to_string()), "schemas: {schemas:?}");

    let tables = conn.tables("doc").await.unwrap();
    assert!(tables.contains(&"haya_test".to_string()), "tables: {tables:?}");

    let page = conn.page("doc", "haya_test", 0, 200).await.unwrap();
    assert_eq!(page.rows.len(), 2);

    conn.execute("DROP TABLE doc.haya_test", 10).await.unwrap();
}
