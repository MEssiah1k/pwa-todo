use anyhow::Result;
use chrono::Local;
use rfd::AsyncFileDialog;
use std::path::{Path, PathBuf};
use std::sync::mpsc;

use crate::db::Database;
use crate::db::models::*;

/// Get the default backup directory
pub fn backup_dir() -> PathBuf {
    let docs = dirs::document_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    docs.join("TodoBackup")
}

/// Export all data as JSON
pub fn export_all_json(db: &Database) -> Result<String> {
    let todos = db.get_todos_updated_after("1970-01-01T00:00:00Z")?;
    let summaries = export_summaries_json(db)?;
    let rules = db.get_recurrence_rules()?;

    let export = serde_json::json!({
        "version": "1.0",
        "exported_at": Local::now().to_rfc3339(),
        "todos": todos,
        "summaries": summaries,
        "recurrence_rules": rules,
    });

    Ok(serde_json::to_string_pretty(&export)?)
}

/// Export summaries as JSON (helper)
fn export_summaries_json(db: &Database) -> Result<Vec<serde_json::Value>> {
    // Get all summaries by iterating through meta keys
    // For now, we'll use a simple approach: export all summaries
    let summaries: Vec<serde_json::Value> = Vec::new();
    // TODO: Add a get_all_summaries method to Database
    Ok(summaries)
}

/// Import data from JSON
pub fn import_json(db: &Database, json_str: &str) -> Result<ImportResult> {
    let data: serde_json::Value = serde_json::from_str(json_str)?;

    let mut result = ImportResult::default();

    if let Some(todos) = data.get("todos").and_then(|t| t.as_array()) {
        for todo_val in todos {
            if let Ok(todo) = serde_json::from_value::<Todo>(todo_val.clone()) {
                match db.get_todo_by_uuid(&todo.uuid)? {
                    Some(existing) => {
                        // Merge: newer updatedAt wins
                        if todo.updated_at > existing.updated_at {
                            db.update_todo(&todo)?;
                            result.updated += 1;
                        } else {
                            result.skipped += 1;
                        }
                    }
                    None => {
                        db.add_todo(&todo)?;
                        result.added += 1;
                    }
                }
            }
        }
    }

    if let Some(rules) = data.get("recurrence_rules").and_then(|r| r.as_array()) {
        for rule_val in rules {
            if let Ok(rule) = serde_json::from_value::<RecurrenceRule>(rule_val.clone()) {
                db.add_recurrence_rule(&rule)?;
                result.rules_added += 1;
            }
        }
    }

    Ok(result)
}

/// Import result summary
#[derive(Debug, Default)]
pub struct ImportResult {
    pub added: usize,
    pub updated: usize,
    pub skipped: usize,
    pub rules_added: usize,
}

/// Export todos as CSV
pub fn export_todos_csv(db: &Database, start_date: &str, end_date: &str) -> Result<String> {
    let todos = db.get_todos_updated_after("1970-01-01T00:00:00Z")?;

    let mut csv = String::from("date,text,completed,queued,due_minutes,category,parent_uuid\n");

    for todo in &todos {
        if todo.date.as_str() >= start_date && todo.date.as_str() <= end_date && todo.deleted_at.is_none() {
            let text = todo.text.replace('"', "\"\"");
            csv.push_str(&format!(
                "{},\"{}\",{},{},{},{}\n",
                todo.date,
                text,
                todo.completed,
                todo.queued,
                todo.due_minutes.map_or(String::new(), |m| m.to_string()),
                todo.parent_uuid.as_deref().unwrap_or(""),
            ));
        }
    }

    Ok(csv)
}

/// Auto-backup: save current database to backup directory
pub fn auto_backup(db: &Database) -> Result<PathBuf> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir)?;

    let date = Local::now().format("%Y-%m-%d_%H%M%S").to_string();
    let path = dir.join(format!("todo_backup_{}.json", date));

    let json = export_all_json(db)?;
    std::fs::write(&path, json)?;

    // Clean up old backups (keep last 30 days)
    cleanup_old_backups(&dir, 30)?;

    Ok(path)
}

/// Remove backup files older than N days
fn cleanup_old_backups(dir: &Path, keep_days: usize) -> Result<()> {
    let cutoff = Local::now() - chrono::Duration::days(keep_days as i64);
    let cutoff_str = cutoff.format("%Y-%m-%d").to_string();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("todo_backup_") && name.ends_with(".json") {
                // Extract date from filename: todo_backup_2024-06-15_120000.json
                if let Some(date_part) = name.strip_prefix("todo_backup_").and_then(|s| s.split('_').next()) {
                    if date_part < cutoff_str.as_str() {
                        std::fs::remove_file(entry.path())?;
                    }
                }
            }
        }
    }

    Ok(())
}

/// Open a native file save dialog and write data
pub fn save_file_dialog(content: &str, filename: &str) -> Result<()> {
    // Synchronous approach using rfd
    let file = rfd::FileDialog::new()
        .set_file_name(filename)
        .save_file();

    if let Some(path) = file {
        std::fs::write(&path, content)?;
    }

    Ok(())
}

/// Open a native file open dialog and read content
pub fn open_file_dialog() -> Result<Option<String>> {
    let file = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .add_filter("CSV", &["csv"])
        .pick_file();

    match file {
        Some(path) => {
            let content = std::fs::read_to_string(&path)?;
            Ok(Some(content))
        }
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn test_db() -> Database {
        Database::open_in_memory().expect("db")
    }

    fn make_todo(date: &str, text: &str) -> Todo {
        let now = chrono::Utc::now().to_rfc3339();
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
    fn test_export_json() {
        let db = test_db();
        let todo = make_todo("2024-06-15", "Test export");
        db.add_todo(&todo).expect("add");

        let json = export_all_json(&db).expect("export");
        assert!(json.contains("Test export"));
        assert!(json.contains("\"version\": \"1.0\""));
    }

    #[test]
    fn test_import_json() {
        let db = test_db();

        // First export
        let todo = make_todo("2024-06-15", "Original");
        db.add_todo(&todo).expect("add");
        let json = export_all_json(&db).expect("export");

        // Import into fresh db
        let db2 = test_db();
        let result = import_json(&db2, &json).expect("import");
        assert_eq!(result.added, 1);

        // Verify
        let todos = db2.get_todos_by_date("2024-06-15").expect("get");
        assert_eq!(todos.len(), 1);
        assert_eq!(todos[0].text, "Original");
    }

    #[test]
    fn test_import_merge() {
        let db = test_db();
        let todo = make_todo("2024-06-15", "Original");
        db.add_todo(&todo).expect("add");

        // Modify and export
        let mut updated = todo.clone();
        updated.text = "Updated".to_string();
        updated.updated_at = chrono::Utc::now().to_rfc3339();
        db.update_todo(&updated).expect("update");

        let json = export_all_json(&db).expect("export");

        // Import into db with older version
        let db2 = test_db();
        let old_todo = make_todo("2024-06-15", "Old");
        // Same UUID but older
        let mut old_with_uuid = old_todo;
        old_with_uuid.uuid = todo.uuid.clone();
        old_with_uuid.updated_at = "2020-01-01T00:00:00Z".to_string();
        db2.add_todo(&old_with_uuid).expect("add");

        let result = import_json(&db2, &json).expect("import");
        assert_eq!(result.updated, 1);
    }

    #[test]
    fn test_export_csv() {
        let db = test_db();
        let todo = make_todo("2024-06-15", "CSV task");
        db.add_todo(&todo).expect("add");

        let csv = export_todos_csv(&db, "2024-06-01", "2024-06-30").expect("csv");
        assert!(csv.contains("date,text,completed"));
        assert!(csv.contains("CSV task"));
    }

    #[test]
    fn test_backup_dir() {
        let dir = backup_dir();
        assert!(dir.to_string_lossy().contains("TodoBackup"));
    }

    #[test]
    fn test_auto_backup() {
        let db = test_db();
        let todo = make_todo("2024-06-15", "Backup test");
        db.add_todo(&todo).expect("add");

        let path = auto_backup(&db).expect("backup");
        assert!(path.exists());

        // Verify content
        let content = std::fs::read_to_string(&path).expect("read");
        assert!(content.contains("Backup test"));

        // Cleanup
        std::fs::remove_file(&path).ok();
        // Try to remove the backup dir if empty
        std::fs::remove_dir(backup_dir()).ok();
    }
}
