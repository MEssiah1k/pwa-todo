use chrono::{Datelike, Duration, NaiveDate, Weekday};
use crate::db::models::{RecurrenceRule, RecurrenceType, Todo};
use std::collections::HashSet;

/// Check if a recurrence rule should generate a todo on the given date
pub fn should_generate_on_date(rule: &RecurrenceRule, date: NaiveDate) -> bool {
    match rule.rule_type {
        RecurrenceType::Daily => true,
        RecurrenceType::Workday => !is_weekend(date),
        RecurrenceType::Weekly => {
            let weekday_num = date.weekday().num_days_from_monday() as i64;
            rule.weekdays
                .as_ref()
                .map(|days| days.contains(&weekday_num))
                .unwrap_or(false)
        }
        RecurrenceType::Monthly => {
            let day = date.day() as i64;
            rule.day == Some(day)
        }
        RecurrenceType::Yearly => {
            let day = date.day() as i64;
            let month = date.month() as i64;
            rule.day == Some(day) && rule.month == Some(month)
        }
        RecurrenceType::Custom => {
            let interval = rule.interval.unwrap_or(1);
            if interval == 0 {
                return false;
            }
            // Calculate days since the rule was created
            let created = NaiveDate::parse_from_str(&rule.created_at[..10], "%Y-%m-%d")
                .unwrap_or(date);
            let days_since_creation = (date - created).num_days();
            if days_since_creation < 0 {
                return false;
            }
            match rule.unit.as_ref() {
                Some(crate::db::models::IntervalUnit::Day) => {
                    days_since_creation % interval == 0
                }
                Some(crate::db::models::IntervalUnit::Week) => {
                    let weeks = days_since_creation / 7;
                    days_since_creation % 7 == 0 && weeks % interval == 0
                }
                Some(crate::db::models::IntervalUnit::Month) => {
                    // Approximate: same day of month, every N months
                    let months_since = (date.year() - created.year()) * 12
                        + (date.month() as i32 - created.month() as i32);
                    date.day() == created.day()
                        && months_since >= 0
                        && (months_since as i64) % interval == 0
                }
                Some(crate::db::models::IntervalUnit::Year) => {
                    let years_since = date.year() - created.year();
                    date.day() == created.day()
                        && date.month() == created.month()
                        && years_since >= 0
                        && (years_since as i64) % interval == 0
                }
                None => false,
            }
        }
    }
}

/// Generate todos for a given date from all active recurrence rules
pub fn generate_todos_for_date(
    rules: &[RecurrenceRule],
    date: NaiveDate,
    existing_texts: &HashSet<String>,
    skip_rules: &HashSet<(String, i64)>, // (date_str, rule_id)
    user_id: &str,
) -> Vec<Todo> {
    let date_str = date.format("%Y-%m-%d").to_string();
    let now = chrono::Utc::now().to_rfc3339();

    rules
        .iter()
        .filter(|rule| rule.deleted_at.is_none())
        .filter(|rule| !skip_rules.contains(&(date_str.clone(), rule.id)))
        .filter(|rule| should_generate_on_date(rule, date))
        .filter(|rule| {
            // Deduplicate: don't generate if a task with same text already exists for this date
            let fingerprint = format!("{}:{}", date_str, rule.text);
            !existing_texts.contains(&fingerprint)
        })
        .map(|rule| {
            let uuid = uuid::Uuid::new_v4().to_string();
            Todo {
                id: 0,
                uuid,
                date: date_str.clone(),
                text: rule.text.clone(),
                completed: false,
                queued: false,
                queue_order: None,
                sort_order: None,
                due_minutes: None,
                recurrence_rule_id: Some(rule.id),
                carried_from: None,
                parent_uuid: None,
                user_id: user_id.to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
                deleted_at: None,
            }
        })
        .collect()
}

/// Generate child todos from a parent's recurrence rule children templates
pub fn generate_children_for_todo(
    parent_uuid: &str,
    date: &str,
    children_templates: &[String],
    user_id: &str,
) -> Vec<Todo> {
    let now = chrono::Utc::now().to_rfc3339();
    children_templates
        .iter()
        .map(|template| {
            Todo {
                id: 0,
                uuid: uuid::Uuid::new_v4().to_string(),
                date: date.to_string(),
                text: template.clone(),
                completed: false,
                queued: false,
                queue_order: None,
                sort_order: None,
                due_minutes: None,
                recurrence_rule_id: None,
                carried_from: None,
                parent_uuid: Some(parent_uuid.to_string()),
                user_id: user_id.to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
                deleted_at: None,
            }
        })
        .collect()
}

/// Carry over incomplete todos from yesterday to today
pub fn carry_over_todos(todos: &[Todo], target_date: &str, user_id: &str) -> Vec<Todo> {
    let now = chrono::Utc::now().to_rfc3339();
    todos
        .iter()
        .filter(|t| !t.completed && t.deleted_at.is_none())
        .map(|t| {
            let mut carried = t.clone();
            carried.id = 0;
            carried.uuid = uuid::Uuid::new_v4().to_string();
            carried.date = target_date.to_string();
            carried.carried_from = Some(t.uuid.clone());
            carried.completed = false;
            carried.created_at = now.clone();
            carried.updated_at = now.clone();
            carried
        })
        .collect()
}

fn is_weekend(date: NaiveDate) -> bool {
    matches!(date.weekday(), Weekday::Sat | Weekday::Sun)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::IntervalUnit;

    fn make_rule(rule_type: RecurrenceType) -> RecurrenceRule {
        let now = chrono::Utc::now().to_rfc3339();
        RecurrenceRule {
            id: 1,
            uuid: uuid::Uuid::new_v4().to_string(),
            text: "Test rule".to_string(),
            rule_type,
            weekdays: None,
            day: None,
            month: None,
            interval: None,
            unit: None,
            children: None,
            created_at: now.clone(),
            updated_at: now,
            deleted_at: None,
        }
    }

    #[test]
    fn test_daily_rule_matches_every_day() {
        let rule = make_rule(RecurrenceType::Daily);
        let date = NaiveDate::from_ymd_opt(2024, 6, 15).unwrap();
        assert!(should_generate_on_date(&rule, date));
        let date2 = NaiveDate::from_ymd_opt(2024, 6, 16).unwrap();
        assert!(should_generate_on_date(&rule, date2));
    }

    #[test]
    fn test_workday_rule_skips_weekends() {
        let rule = make_rule(RecurrenceType::Workday);
        // Monday
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 17).unwrap()));
        // Friday
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 14).unwrap()));
        // Saturday
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 15).unwrap()));
        // Sunday
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 16).unwrap()));
    }

    #[test]
    fn test_weekly_rule_matches_specific_days() {
        let mut rule = make_rule(RecurrenceType::Weekly);
        rule.weekdays = Some(vec![0, 2, 4]); // Mon, Wed, Fri
        // Monday (0)
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 17).unwrap()));
        // Tuesday (1)
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 18).unwrap()));
        // Wednesday (2)
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 19).unwrap()));
    }

    #[test]
    fn test_monthly_rule() {
        let mut rule = make_rule(RecurrenceType::Monthly);
        rule.day = Some(15);
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 15).unwrap()));
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 16).unwrap()));
    }

    #[test]
    fn test_yearly_rule() {
        let mut rule = make_rule(RecurrenceType::Yearly);
        rule.day = Some(1);
        rule.month = Some(1);
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()));
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 2, 1).unwrap()));
    }

    #[test]
    fn test_custom_daily_interval() {
        let mut rule = make_rule(RecurrenceType::Custom);
        rule.interval = Some(3);
        rule.unit = Some(IntervalUnit::Day);
        rule.created_at = "2024-06-01T00:00:00Z".to_string();

        // Day 0 (creation day)
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 1).unwrap()));
        // Day 3
        assert!(should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 4).unwrap()));
        // Day 1 (should not match)
        assert!(!should_generate_on_date(&rule, NaiveDate::from_ymd_opt(2024, 6, 2).unwrap()));
    }

    #[test]
    fn test_generate_todos_for_date() {
        let mut rule = make_rule(RecurrenceType::Workday);
        rule.text = "Standup".to_string();
        let rules = vec![rule];
        let date = NaiveDate::from_ymd_opt(2024, 6, 17).unwrap(); // Monday
        let existing = HashSet::new();
        let skips = HashSet::new();

        let todos = generate_todos_for_date(&rules, date, &existing, &skips, "");
        assert_eq!(todos.len(), 1);
        assert_eq!(todos[0].text, "Standup");
    }

    #[test]
    fn test_generate_todos_deduplication() {
        let mut rule = make_rule(RecurrenceType::Daily);
        rule.text = "Existing task".to_string();
        let rules = vec![rule];
        let date = NaiveDate::from_ymd_opt(2024, 6, 17).unwrap();

        let mut existing = HashSet::new();
        existing.insert("2024-06-17:Existing task".to_string());

        let todos = generate_todos_for_date(&rules, date, &existing, &HashSet::new(), "");
        assert!(todos.is_empty());
    }

    #[test]
    fn test_generate_todos_skip() {
        let mut rule = make_rule(RecurrenceType::Daily);
        rule.text = "Skipped task".to_string();
        let rules = vec![rule];
        let date = NaiveDate::from_ymd_opt(2024, 6, 17).unwrap();

        let mut skips = HashSet::new();
        skips.insert(("2024-06-17".to_string(), 1i64));

        let todos = generate_todos_for_date(&rules, date, &HashSet::new(), &skips, "");
        assert!(todos.is_empty());
    }

    #[test]
    fn test_generate_children() {
        let children = generate_children_for_todo(
            "parent-uuid",
            "2024-06-17",
            &["Sub 1".to_string(), "Sub 2".to_string()],
            "",
        );
        assert_eq!(children.len(), 2);
        assert_eq!(children[0].text, "Sub 1");
        assert_eq!(children[0].parent_uuid, Some("parent-uuid".to_string()));
        assert_eq!(children[1].text, "Sub 2");
    }

    #[test]
    fn test_carry_over_todos() {
        let now = chrono::Utc::now().to_rfc3339();
        let todos = vec![
            Todo {
                id: 1, uuid: "uuid1".to_string(), date: "2024-06-16".to_string(),
                text: "Incomplete task".to_string(), completed: false,
                queued: false, queue_order: None, sort_order: None, due_minutes: None,
                recurrence_rule_id: None, carried_from: None, parent_uuid: None,
                user_id: String::new(), created_at: now.clone(), updated_at: now.clone(), deleted_at: None,
            },
            Todo {
                id: 2, uuid: "uuid2".to_string(), date: "2024-06-16".to_string(),
                text: "Completed task".to_string(), completed: true,
                queued: false, queue_order: None, sort_order: None, due_minutes: None,
                recurrence_rule_id: None, carried_from: None, parent_uuid: None,
                user_id: String::new(), created_at: now.clone(), updated_at: now.clone(), deleted_at: None,
            },
        ];

        let carried = carry_over_todos(&todos, "2024-06-17", "");
        assert_eq!(carried.len(), 1); // Only incomplete task carried
        assert_eq!(carried[0].text, "Incomplete task");
        assert_eq!(carried[0].date, "2024-06-17");
        assert_eq!(carried[0].carried_from, Some("uuid1".to_string()));
    }
}
