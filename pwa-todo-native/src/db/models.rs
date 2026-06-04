use serde::{Deserialize, Serialize};

/// Task category types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Category {
    Work,
    Life,
    Health,
    Social,
    Growth,
    Leisure,
    Plan,
}

impl Category {
    /// All available categories
    pub fn all() -> &'static [Category] {
        &[
            Category::Work,
            Category::Life,
            Category::Health,
            Category::Social,
            Category::Growth,
            Category::Leisure,
            Category::Plan,
        ]
    }

    /// Display name in Chinese
    pub fn display_name(&self) -> &'static str {
        match self {
            Category::Work => "工作",
            Category::Life => "生活",
            Category::Health => "健康",
            Category::Social => "社交",
            Category::Growth => "成长",
            Category::Leisure => "休闲",
            Category::Plan => "计划",
        }
    }

    /// Parse category from task text prefix like "Work:some task"
    pub fn parse_from_text(text: &str) -> Option<(Category, &str)> {
        for cat in Self::all() {
            let prefix = format!("{:?}:", cat);
            if text.starts_with(&prefix) {
                return Some((cat.clone(), &text[prefix.len()..]));
            }
            // Also support Chinese prefix
            let cn_prefix = format!("{}:", cat.display_name());
            if text.starts_with(&cn_prefix) {
                return Some((cat.clone(), &text[cn_prefix.len()..]));
            }
        }
        None
    }
}

/// A todo task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub uuid: String,
    pub date: String,
    pub text: String,
    pub completed: bool,
    pub queued: bool,
    pub queue_order: Option<i64>,
    pub sort_order: Option<i64>,
    pub due_minutes: Option<i64>,
    pub recurrence_rule_id: Option<i64>,
    pub carried_from: Option<String>,
    pub parent_uuid: Option<String>,
    pub user_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

/// A daily summary with rating
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Summary {
    pub id: i64,
    pub uuid: String,
    pub date: String,
    pub text: String,
    pub rating: f64,
    pub user_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

/// Recurrence rule type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecurrenceType {
    Daily,
    Weekly,
    Monthly,
    Yearly,
    Workday,
    Custom,
}

impl RecurrenceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            RecurrenceType::Daily => "daily",
            RecurrenceType::Weekly => "weekly",
            RecurrenceType::Monthly => "monthly",
            RecurrenceType::Yearly => "yearly",
            RecurrenceType::Workday => "workday",
            RecurrenceType::Custom => "custom",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "daily" => Some(RecurrenceType::Daily),
            "weekly" => Some(RecurrenceType::Weekly),
            "monthly" => Some(RecurrenceType::Monthly),
            "yearly" => Some(RecurrenceType::Yearly),
            "workday" => Some(RecurrenceType::Workday),
            "custom" => Some(RecurrenceType::Custom),
            _ => None,
        }
    }
}

/// Custom interval unit
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum IntervalUnit {
    Day,
    Week,
    Month,
    Year,
}

impl IntervalUnit {
    pub fn as_str(&self) -> &'static str {
        match self {
            IntervalUnit::Day => "day",
            IntervalUnit::Week => "week",
            IntervalUnit::Month => "month",
            IntervalUnit::Year => "year",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "day" => Some(IntervalUnit::Day),
            "week" => Some(IntervalUnit::Week),
            "month" => Some(IntervalUnit::Month),
            "year" => Some(IntervalUnit::Year),
            _ => None,
        }
    }
}

/// A recurrence rule for generating repeating tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub id: i64,
    pub uuid: String,
    pub text: String,
    pub rule_type: RecurrenceType,
    pub weekdays: Option<Vec<i64>>,
    pub day: Option<i64>,
    pub month: Option<i64>,
    pub interval: Option<i64>,
    pub unit: Option<IntervalUnit>,
    pub children: Option<Vec<String>>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

/// Timer state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TimerState {
    Idle,
    Running { started_at: String, duration_secs: u64, elapsed_secs: u64 },
    Paused { duration_secs: u64, elapsed_secs: u64 },
}

/// Timer type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TimerKind {
    Focus,
    Rest,
    Assist,
}

/// Application-wide settings stored in meta table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub auto_start: bool,
    pub hide_on_focus_loss: bool,
    pub daily_reminder_enabled: bool,
    pub daily_reminder_hour: u8,
    pub daily_reminder_minute: u8,
    pub focus_duration_minutes: u64,
    pub rest_duration_minutes: u64,
    pub alarm_volume: u8,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            auto_start: false,
            hide_on_focus_loss: true,
            daily_reminder_enabled: true,
            daily_reminder_hour: 22,
            daily_reminder_minute: 0,
            focus_duration_minutes: 90,
            rest_duration_minutes: 20,
            alarm_volume: 80,
        }
    }
}

/// Timer timeline segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineSegment {
    pub id: String,
    pub started_at: String,
    pub ended_at: String,
    pub kind: TimerKind,
    pub paused_intervals: Vec<(String, String)>,
}
