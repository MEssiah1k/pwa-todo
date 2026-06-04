use rusqlite::Connection;
use std::path::PathBuf;

use super::models::*;

/// Database manager for SQLite operations
pub struct Database {
    conn: Connection,
}

impl Database {
    /// Open or create the database at the given path
    pub fn open(path: &PathBuf) -> anyhow::Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let mut db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    /// Open an in-memory database (for testing)
    pub fn open_in_memory() -> anyhow::Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let mut db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    /// Run database migrations
    fn run_migrations(&mut self) -> anyhow::Result<()> {
        self.conn.execute_batch(MIGRATION_SQL)?;
        Ok(())
    }

    // ── Todo CRUD ────────────────────────────────────────────

    /// Get all todos for a specific date (non-deleted)
    pub fn get_todos_by_date(&self, date: &str) -> anyhow::Result<Vec<Todo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, date, text, completed, queued, queue_order, sort_order,
                    due_minutes, recurrence_rule_id, carried_from, parent_uuid, user_id,
                    created_at, updated_at, deleted_at
             FROM todos WHERE date = ? AND deleted_at IS NULL
             ORDER BY sort_order ASC, id ASC"
        )?;
        let todos = stmt.query_map([date], |row| {
            Ok(Todo {
                id: row.get(0)?,
                uuid: row.get(1)?,
                date: row.get(2)?,
                text: row.get(3)?,
                completed: row.get(4)?,
                queued: row.get(5)?,
                queue_order: row.get(6)?,
                sort_order: row.get(7)?,
                due_minutes: row.get(8)?,
                recurrence_rule_id: row.get(9)?,
                carried_from: row.get(10)?,
                parent_uuid: row.get(11)?,
                user_id: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                deleted_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(todos)
    }

    /// Get a todo by its UUID
    pub fn get_todo_by_uuid(&self, uuid: &str) -> anyhow::Result<Option<Todo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, date, text, completed, queued, queue_order, sort_order,
                    due_minutes, recurrence_rule_id, carried_from, parent_uuid, user_id,
                    created_at, updated_at, deleted_at
             FROM todos WHERE uuid = ?"
        )?;
        let mut todos = stmt.query_map([uuid], |row| {
            Ok(Todo {
                id: row.get(0)?,
                uuid: row.get(1)?,
                date: row.get(2)?,
                text: row.get(3)?,
                completed: row.get(4)?,
                queued: row.get(5)?,
                queue_order: row.get(6)?,
                sort_order: row.get(7)?,
                due_minutes: row.get(8)?,
                recurrence_rule_id: row.get(9)?,
                carried_from: row.get(10)?,
                parent_uuid: row.get(11)?,
                user_id: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                deleted_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(todos.pop())
    }

    /// Add a new todo
    pub fn add_todo(&self, todo: &Todo) -> anyhow::Result<i64> {
        self.conn.execute(
            "INSERT INTO todos (uuid, date, text, completed, queued, queue_order, sort_order,
             due_minutes, recurrence_rule_id, carried_from, parent_uuid, user_id,
             created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                &todo.uuid, &todo.date, &todo.text, &todo.completed, &todo.queued,
                &todo.queue_order, &todo.sort_order, &todo.due_minutes,
                &todo.recurrence_rule_id, &todo.carried_from, &todo.parent_uuid,
                &todo.user_id, &todo.created_at, &todo.updated_at, &todo.deleted_at,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Update an existing todo
    pub fn update_todo(&self, todo: &Todo) -> anyhow::Result<()> {
        self.conn.execute(
            "UPDATE todos SET date=?1, text=?2, completed=?3, queued=?4, queue_order=?5,
             sort_order=?6, due_minutes=?7, recurrence_rule_id=?8, carried_from=?9,
             parent_uuid=?10, user_id=?11, updated_at=?12, deleted_at=?13
             WHERE uuid=?14",
            rusqlite::params![
                &todo.date, &todo.text, &todo.completed, &todo.queued,
                &todo.queue_order, &todo.sort_order, &todo.due_minutes,
                &todo.recurrence_rule_id, &todo.carried_from, &todo.parent_uuid,
                &todo.user_id, &todo.updated_at, &todo.deleted_at, &todo.uuid,
            ],
        )?;
        Ok(())
    }

    /// Soft-delete a todo by UUID
    pub fn delete_todo(&self, uuid: &str, now: &str) -> anyhow::Result<()> {
        self.conn.execute(
            "UPDATE todos SET deleted_at=?1, updated_at=?1 WHERE uuid=?2",
            rusqlite::params![now, uuid],
        )?;
        Ok(())
    }

    /// Get all todos updated after a given timestamp (for sync)
    pub fn get_todos_updated_after(&self, since: &str) -> anyhow::Result<Vec<Todo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, date, text, completed, queued, queue_order, sort_order,
                    due_minutes, recurrence_rule_id, carried_from, parent_uuid, user_id,
                    created_at, updated_at, deleted_at
             FROM todos WHERE updated_at > ?"
        )?;
        let todos = stmt.query_map([since], |row| {
            Ok(Todo {
                id: row.get(0)?,
                uuid: row.get(1)?,
                date: row.get(2)?,
                text: row.get(3)?,
                completed: row.get(4)?,
                queued: row.get(5)?,
                queue_order: row.get(6)?,
                sort_order: row.get(7)?,
                due_minutes: row.get(8)?,
                recurrence_rule_id: row.get(9)?,
                carried_from: row.get(10)?,
                parent_uuid: row.get(11)?,
                user_id: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                deleted_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(todos)
    }

    /// Get child todos of a parent
    pub fn get_children_by_parent_uuid(&self, parent_uuid: &str) -> anyhow::Result<Vec<Todo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, date, text, completed, queued, queue_order, sort_order,
                    due_minutes, recurrence_rule_id, carried_from, parent_uuid, user_id,
                    created_at, updated_at, deleted_at
             FROM todos WHERE parent_uuid = ? AND deleted_at IS NULL
             ORDER BY id ASC"
        )?;
        let todos = stmt.query_map([parent_uuid], |row| {
            Ok(Todo {
                id: row.get(0)?,
                uuid: row.get(1)?,
                date: row.get(2)?,
                text: row.get(3)?,
                completed: row.get(4)?,
                queued: row.get(5)?,
                queue_order: row.get(6)?,
                sort_order: row.get(7)?,
                due_minutes: row.get(8)?,
                recurrence_rule_id: row.get(9)?,
                carried_from: row.get(10)?,
                parent_uuid: row.get(11)?,
                user_id: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
                deleted_at: row.get(15)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(todos)
    }

    // ── Summary CRUD ─────────────────────────────────────────

    /// Get summary for a specific date
    pub fn get_summary_by_date(&self, date: &str) -> anyhow::Result<Option<Summary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, date, text, rating, user_id, created_at, updated_at, deleted_at
             FROM summaries WHERE date = ? AND deleted_at IS NULL"
        )?;
        let mut summaries = stmt.query_map([date], |row| {
            Ok(Summary {
                id: row.get(0)?,
                uuid: row.get(1)?,
                date: row.get(2)?,
                text: row.get(3)?,
                rating: row.get(4)?,
                user_id: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
                deleted_at: row.get(8)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(summaries.pop())
    }

    /// Add a new summary
    pub fn add_summary(&self, summary: &Summary) -> anyhow::Result<i64> {
        self.conn.execute(
            "INSERT INTO summaries (uuid, date, text, rating, user_id, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                &summary.uuid, &summary.date, &summary.text, &summary.rating,
                &summary.user_id, &summary.created_at, &summary.updated_at, &summary.deleted_at,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Update an existing summary
    pub fn update_summary(&self, summary: &Summary) -> anyhow::Result<()> {
        self.conn.execute(
            "UPDATE summaries SET text=?1, rating=?2, updated_at=?3, deleted_at=?4 WHERE uuid=?5",
            rusqlite::params![
                &summary.text, &summary.rating, &summary.updated_at,
                &summary.deleted_at, &summary.uuid,
            ],
        )?;
        Ok(())
    }

    // ── Recurrence Rule CRUD ─────────────────────────────────

    /// Get all active recurrence rules
    pub fn get_recurrence_rules(&self) -> anyhow::Result<Vec<RecurrenceRule>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, text, type, weekdays, day, month, interval, unit, children,
                    created_at, updated_at, deleted_at
             FROM recurrence_rules WHERE deleted_at IS NULL
             ORDER BY id ASC"
        )?;
        let rules = stmt.query_map([], |row| {
            let weekdays_str: Option<String> = row.get(4)?;
            let children_str: Option<String> = row.get(9)?;
            Ok(RecurrenceRule {
                id: row.get(0)?,
                uuid: row.get(1)?,
                text: row.get(2)?,
                rule_type: RecurrenceType::from_str(&row.get::<_, String>(3)?)
                    .unwrap_or(RecurrenceType::Daily),
                weekdays: weekdays_str.as_ref().and_then(|s| serde_json::from_str(s).ok()),
                day: row.get(5)?,
                month: row.get(6)?,
                interval: row.get(7)?,
                unit: row.get::<_, Option<String>>(8)?.and_then(|s| IntervalUnit::from_str(&s)),
                children: children_str.as_ref().and_then(|s| serde_json::from_str(s).ok()),
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                deleted_at: row.get(12)?,
            })
        })?.collect::<Result<Vec<_>, _>>()?;
        Ok(rules)
    }

    /// Add a new recurrence rule
    pub fn add_recurrence_rule(&self, rule: &RecurrenceRule) -> anyhow::Result<i64> {
        let weekdays_json = rule.weekdays.as_ref().map(|w| serde_json::to_string(w).unwrap_or_default());
        let children_json = rule.children.as_ref().map(|c| serde_json::to_string(c).unwrap_or_default());
        let unit_str = rule.unit.as_ref().map(|u| u.as_str().to_string());
        self.conn.execute(
            "INSERT INTO recurrence_rules (uuid, text, type, weekdays, day, month, interval, unit, children,
             created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                &rule.uuid, &rule.text, rule.rule_type.as_str(), &weekdays_json,
                &rule.day, &rule.month, &rule.interval, &unit_str, &children_json,
                &rule.created_at, &rule.updated_at, &rule.deleted_at,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Soft-delete a recurrence rule by UUID
    pub fn delete_recurrence_rule(&self, uuid: &str, now: &str) -> anyhow::Result<()> {
        self.conn.execute(
            "UPDATE recurrence_rules SET deleted_at=?1, updated_at=?1 WHERE uuid=?2",
            rusqlite::params![now, uuid],
        )?;
        Ok(())
    }

    // ── Meta (Key-Value Store) ───────────────────────────────

    /// Get a meta value by key
    pub fn get_meta(&self, key: &str) -> anyhow::Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT value FROM meta WHERE key = ?1")?;
        let mut results = stmt.query_map([key], |row| row.get::<_, String>(0))?;
        match results.next() {
            Some(Ok(v)) => Ok(Some(v)),
            _ => Ok(None),
        }
    }

    /// Set a meta value
    pub fn set_meta(&self, key: &str, value: &str) -> anyhow::Result<()> {
        self.conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            rusqlite::params![key, value],
        )?;
        Ok(())
    }

    // ── Timer Timeline ───────────────────────────────────────

    /// Get timeline data for a date
    pub fn get_timeline(&self, date: &str) -> anyhow::Result<Option<String>> {
        let mut stmt = self.conn.prepare("SELECT data FROM timer_timeline WHERE date = ?1")?;
        let mut results = stmt.query_map([date], |row| row.get::<_, String>(0))?;
        match results.next() {
            Some(Ok(v)) => Ok(Some(v)),
            _ => Ok(None),
        }
    }

    /// Set timeline data for a date
    pub fn set_timeline(&self, date: &str, data: &str, now: &str) -> anyhow::Result<()> {
        self.conn.execute(
            "INSERT INTO timer_timeline (date, data, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(date) DO UPDATE SET data = ?2, updated_at = ?3",
            rusqlite::params![date, data, now],
        )?;
        Ok(())
    }

    // ── App Settings ─────────────────────────────────────────

    /// Get application settings
    pub fn get_settings(&self) -> anyhow::Result<AppSettings> {
        match self.get_meta("settings")? {
            Some(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
            None => Ok(AppSettings::default()),
        }
    }

    /// Save application settings
    pub fn save_settings(&self, settings: &AppSettings) -> anyhow::Result<()> {
        let json = serde_json::to_string(settings)?;
        self.set_meta("settings", &json)?;
        Ok(())
    }
}

/// SQL migration script for initial database schema
const MIGRATION_SQL: &str = "
CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    text TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    queued INTEGER NOT NULL DEFAULT 0,
    queue_order INTEGER,
    sort_order INTEGER,
    due_minutes INTEGER,
    recurrence_rule_id INTEGER REFERENCES recurrence_rules(id),
    carried_from TEXT,
    parent_uuid TEXT,
    user_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date);
CREATE INDEX IF NOT EXISTS idx_todos_parent_uuid ON todos(parent_uuid);
CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON todos(updated_at);
CREATE INDEX IF NOT EXISTS idx_todos_recurrence_rule_id ON todos(recurrence_rule_id);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    rating REAL NOT NULL DEFAULT 0,
    user_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_summaries_date ON summaries(date);
CREATE INDEX IF NOT EXISTS idx_summaries_updated_at ON summaries(updated_at);

CREATE TABLE IF NOT EXISTS recurrence_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    weekdays TEXT,
    day INTEGER,
    month INTEGER,
    interval INTEGER,
    unit TEXT,
    children TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timer_timeline (
    date TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
";

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Database {
        Database::open_in_memory().expect("Failed to create in-memory database")
    }

    fn now_iso() -> String {
        chrono::Utc::now().to_rfc3339()
    }

    fn make_todo(date: &str, text: &str) -> Todo {
        let now = now_iso();
        Todo {
            id: 0,
            uuid: uuid::Uuid::new_v4().to_string(),
            date: date.to_string(),
            text: text.to_string(),
            completed: false,
            queued: false,
            queue_order: None,
            sort_order: None,
            due_minutes: None,
            recurrence_rule_id: None,
            carried_from: None,
            parent_uuid: None,
            user_id: String::new(),
            created_at: now.clone(),
            updated_at: now,
            deleted_at: None,
        }
    }

    #[test]
    fn test_db_opens_and_migrates() {
        let db = create_test_db();
        let settings = db.get_settings().expect("Should get settings");
        assert_eq!(settings.theme, "dark");
    }

    #[test]
    fn test_add_and_get_todo() {
        let db = create_test_db();
        let todo = make_todo("2024-06-15", "Test task");
        let id = db.add_todo(&todo).expect("Should add todo");
        assert!(id > 0);

        let fetched = db.get_todo_by_uuid(&todo.uuid).expect("Should get todo")
            .expect("Todo should exist");
        assert_eq!(fetched.text, "Test task");
        assert_eq!(fetched.date, "2024-06-15");
        assert!(!fetched.completed);
    }

    #[test]
    fn test_get_todos_by_date() {
        let db = create_test_db();
        let t1 = make_todo("2024-06-15", "Task 1");
        let t2 = make_todo("2024-06-15", "Task 2");
        let t3 = make_todo("2024-06-16", "Task 3");
        db.add_todo(&t1).expect("add");
        db.add_todo(&t2).expect("add");
        db.add_todo(&t3).expect("add");

        let todos = db.get_todos_by_date("2024-06-15").expect("Should get todos");
        assert_eq!(todos.len(), 2);
    }

    #[test]
    fn test_update_todo() {
        let db = create_test_db();
        let mut todo = make_todo("2024-06-15", "Original");
        db.add_todo(&todo).expect("add");

        todo.completed = true;
        todo.text = "Updated".to_string();
        todo.updated_at = now_iso();
        db.update_todo(&todo).expect("Should update");

        let fetched = db.get_todo_by_uuid(&todo.uuid).expect("get").expect("exists");
        assert!(fetched.completed);
        assert_eq!(fetched.text, "Updated");
    }

    #[test]
    fn test_soft_delete_todo() {
        let db = create_test_db();
        let todo = make_todo("2024-06-15", "To delete");
        db.add_todo(&todo).expect("add");

        let now = now_iso();
        db.delete_todo(&todo.uuid, &now).expect("Should delete");

        let todos = db.get_todos_by_date("2024-06-15").expect("get");
        assert!(todos.is_empty());

        let fetched = db.get_todo_by_uuid(&todo.uuid).expect("get").expect("exists");
        assert!(fetched.deleted_at.is_some());
    }

    #[test]
    fn test_parent_child_relationship() {
        let db = create_test_db();
        let parent = make_todo("2024-06-15", "Parent task");
        db.add_todo(&parent).expect("add parent");

        let mut child = make_todo("2024-06-15", "Child task");
        child.parent_uuid = Some(parent.uuid.clone());
        db.add_todo(&child).expect("add child");

        let children = db.get_children_by_parent_uuid(&parent.uuid).expect("get children");
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].text, "Child task");
    }

    #[test]
    fn test_summary_crud() {
        let db = create_test_db();
        let now = now_iso();
        let summary = Summary {
            id: 0,
            uuid: uuid::Uuid::new_v4().to_string(),
            date: "2024-06-15".to_string(),
            text: "Good day".to_string(),
            rating: 4.0,
            user_id: String::new(),
            created_at: now.clone(),
            updated_at: now,
            deleted_at: None,
        };
        db.add_summary(&summary).expect("add summary");

        let fetched = db.get_summary_by_date("2024-06-15").expect("get").expect("exists");
        assert_eq!(fetched.text, "Good day");
        assert!((fetched.rating - 4.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_meta_key_value() {
        let db = create_test_db();
        assert!(db.get_meta("test_key").expect("get").is_none());

        db.set_meta("test_key", "test_value").expect("set");
        assert_eq!(db.get_meta("test_key").expect("get"), Some("test_value".to_string()));

        db.set_meta("test_key", "updated").expect("update");
        assert_eq!(db.get_meta("test_key").expect("get"), Some("updated".to_string()));
    }

    #[test]
    fn test_recurrence_rule() {
        let db = create_test_db();
        let now = now_iso();
        let rule = RecurrenceRule {
            id: 0,
            uuid: uuid::Uuid::new_v4().to_string(),
            text: "Daily standup".to_string(),
            rule_type: RecurrenceType::Workday,
            weekdays: None,
            day: None,
            month: None,
            interval: None,
            unit: None,
            children: Some(vec!["Sub task 1".to_string(), "Sub task 2".to_string()]),
            created_at: now.clone(),
            updated_at: now,
            deleted_at: None,
        };
        db.add_recurrence_rule(&rule).expect("add rule");

        let rules = db.get_recurrence_rules().expect("get rules");
        assert_eq!(rules.len(), 1);
        assert_eq!(rules[0].rule_type, RecurrenceType::Workday);
        assert_eq!(rules[0].children.as_ref().map(|c| c.len()), Some(2));
    }

    #[test]
    fn test_timer_timeline() {
        let db = create_test_db();
        let now = now_iso();
        let data = r#"{"segments":[]}"#;
        db.set_timeline("2024-06-15", data, &now).expect("set");

        let fetched = db.get_timeline("2024-06-15").expect("get").expect("exists");
        assert_eq!(fetched, data);
    }

    #[test]
    fn test_settings() {
        let db = create_test_db();
        let mut settings = db.get_settings().expect("get settings");
        assert_eq!(settings.theme, "dark");
        assert!(!settings.auto_start);

        settings.auto_start = true;
        settings.focus_duration_minutes = 120;
        db.save_settings(&settings).expect("save");

        let loaded = db.get_settings().expect("reload settings");
        assert!(loaded.auto_start);
        assert_eq!(loaded.focus_duration_minutes, 120);
    }

    #[test]
    fn test_category_parse() {
        let (cat, text) = Category::parse_from_text("Work:finish report").unwrap();
        assert_eq!(cat, Category::Work);
        assert_eq!(text, "finish report");

        assert!(Category::parse_from_text("No category here").is_none());
    }
}
