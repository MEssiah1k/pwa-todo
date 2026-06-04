use std::path::PathBuf;

/// Get the database file path based on platform
pub fn db_path() -> PathBuf {
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    let app_dir = data_dir.join("pwa-todo");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("todo.db")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_path_is_valid() {
        let path = db_path();
        assert!(path.to_string_lossy().contains("todo.db"));
        assert!(path.to_string_lossy().contains("pwa-todo"));
    }
}
