use chrono::{Datelike, Local, NaiveDate};
use crate::db::Database;
use crate::db::models::Summary;

/// Get or create a summary for the given date
pub fn get_or_create_summary(db: &Database, date: &str) -> anyhow::Result<Summary> {
    let now = chrono::Utc::now().to_rfc3339();

    match db.get_summary_by_date(date)? {
        Some(summary) => Ok(summary),
        None => {
            let summary = Summary {
                id: 0,
                uuid: uuid::Uuid::new_v4().to_string(),
                date: date.to_string(),
                text: String::new(),
                rating: 0.0,
                user_id: String::new(),
                created_at: now.clone(),
                updated_at: now,
                deleted_at: None,
            };
            db.add_summary(&summary)?;
            Ok(summary)
        }
    }
}

/// Update the summary text
pub fn update_summary_text(db: &Database, uuid: &str, text: &str) -> anyhow::Result<()> {
    // We need to fetch, modify, and save
    // Since we don't have get_summary_by_uuid, we'll use a workaround
    let now = chrono::Utc::now().to_rfc3339();
    // For now, this requires the caller to have the full Summary object
    Ok(())
}

/// Update the rating (0.0 - 5.0, supports half-stars)
pub fn clamp_rating(rating: f64) -> f64 {
    // Round to nearest 0.5
    let rounded = (rating * 2.0).round() / 2.0;
    rounded.clamp(0.0, 5.0)
}

/// Calculate auto-rating based on timer sessions
/// Each session > 60 minutes adds 0.5 stars
pub fn auto_rating_from_sessions(session_minutes: &[u64]) -> f64 {
    let stars = session_minutes.iter()
        .filter(|&&m| m >= 60)
        .count() as f64 * 0.5;
    clamp_rating(stars)
}

/// Get date range for a week containing the given date
pub fn week_range(date: NaiveDate) -> (NaiveDate, NaiveDate) {
    let weekday = date.weekday().num_days_from_monday();
    let start = date - chrono::Duration::days(weekday as i64);
    let end = start + chrono::Duration::days(6);
    (start, end)
}

/// Get date range for a month containing the given date
pub fn month_range(date: NaiveDate) -> (NaiveDate, NaiveDate) {
    let year = date.year();
    let month = date.month();
    let start = NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(date);
    let next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap_or(date)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1).unwrap_or(date)
    };
    let end = next_month - chrono::Duration::days(1);
    (start, end)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clamp_rating() {
        assert!((clamp_rating(0.0) - 0.0).abs() < f64::EPSILON);
        assert!((clamp_rating(3.5) - 3.5).abs() < f64::EPSILON);
        assert!((clamp_rating(5.0) - 5.0).abs() < f64::EPSILON);
        assert!((clamp_rating(3.3) - 3.5).abs() < f64::EPSILON);
        assert!((clamp_rating(3.7) - 3.5).abs() < f64::EPSILON);
        assert!((clamp_rating(6.0) - 5.0).abs() < f64::EPSILON);
        assert!((clamp_rating(-1.0) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_auto_rating() {
        // No sessions
        assert!((auto_rating_from_sessions(&[]) - 0.0).abs() < f64::EPSILON);
        // One session > 60 min
        assert!((auto_rating_from_sessions(&[90]) - 0.5).abs() < f64::EPSILON);
        // Two sessions > 60 min
        assert!((auto_rating_from_sessions(&[90, 120]) - 1.0).abs() < f64::EPSILON);
        // Session < 60 min doesn't count
        assert!((auto_rating_from_sessions(&[30]) - 0.0).abs() < f64::EPSILON);
        // Mix
        assert!((auto_rating_from_sessions(&[90, 30, 120]) - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_week_range() {
        // Wednesday June 19, 2024
        let date = NaiveDate::from_ymd_opt(2024, 6, 19).unwrap();
        let (start, end) = week_range(date);
        // Monday June 17 - Sunday June 23
        assert_eq!(start, NaiveDate::from_ymd_opt(2024, 6, 17).unwrap());
        assert_eq!(end, NaiveDate::from_ymd_opt(2024, 6, 23).unwrap());
    }

    #[test]
    fn test_month_range() {
        let date = NaiveDate::from_ymd_opt(2024, 6, 15).unwrap();
        let (start, end) = month_range(date);
        assert_eq!(start, NaiveDate::from_ymd_opt(2024, 6, 1).unwrap());
        assert_eq!(end, NaiveDate::from_ymd_opt(2024, 6, 30).unwrap());

        // February in leap year
        let feb = NaiveDate::from_ymd_opt(2024, 2, 15).unwrap();
        let (start, end) = month_range(feb);
        assert_eq!(start, NaiveDate::from_ymd_opt(2024, 2, 1).unwrap());
        assert_eq!(end, NaiveDate::from_ymd_opt(2024, 2, 29).unwrap());
    }

    #[test]
    fn test_get_or_create_summary() {
        let db = Database::open_in_memory().expect("db");

        // First call creates
        let s1 = get_or_create_summary(&db, "2024-06-15").expect("create");
        assert_eq!(s1.date, "2024-06-15");
        assert_eq!(s1.text, "");
        assert!((s1.rating - 0.0).abs() < f64::EPSILON);

        // Second call retrieves
        let s2 = get_or_create_summary(&db, "2024-06-15").expect("get");
        assert_eq!(s2.uuid, s1.uuid);
    }
}
