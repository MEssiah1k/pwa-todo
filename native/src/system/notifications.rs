use notify_rust::Notification;

/// Show a native desktop notification
pub fn notify(title: &str, body: &str) -> anyhow::Result<()> {
    Notification::new()
        .summary(title)
        .body(body)
        .show()?;
    Ok(())
}

/// Show focus timer completed notification
pub fn notify_focus_complete() -> anyhow::Result<()> {
    notify("Todo", "Focus session completed! Time for a break.")
}

/// Show rest timer completed notification
pub fn notify_rest_complete() -> anyhow::Result<()> {
    notify("Todo", "Rest is over. Ready for another focus session?")
}

/// Show assist timer completed notification
pub fn notify_assist_complete() -> anyhow::Result<()> {
    notify("Todo", "Assist timer completed.")
}

/// Show daily summary reminder
pub fn notify_daily_reminder(remaining_tasks: usize) -> anyhow::Result<()> {
    notify(
        "Todo",
        &format!("You have {} tasks remaining today. Write a summary?", remaining_tasks),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_notification_function_signatures() {
        // Just verify the functions compile - actual notification requires a desktop
        // These will fail in headless CI but that's expected
    }
}
