mod db;
mod sync;
mod widget;
mod view;
mod audio;
mod system;
mod platform;

use db::Database;
use db::models::*;
use system::{FocusTimer, TimerState, TimerEvent, AssistTimer, AssistTimerState};

use iced::widget::{button, column, row, text, text_input, Column, Space};
use iced::{application, Element, Length, Subscription, Task, Theme};
use iced::time::every;

/// Main application state
pub struct TodoApp {
    db: Database,
    current_date: String,
    todos: Vec<Todo>,
    new_task_text: String,
    settings: AppSettings,
    focus_timer: FocusTimer,
    assist_timer: AssistTimer,
    active_tab: ActiveTab,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActiveTab {
    Tasks,
    Timer,
}

/// User interface messages
#[derive(Debug, Clone)]
pub enum Message {
    // Task messages
    NewTaskChanged(String),
    AddTask,
    ToggleComplete(String),
    DeleteTask(String),
    PreviousDay,
    NextDay,
    GoToToday,
    // Tab navigation
    SwitchTab(ActiveTab),
    // Focus timer messages
    StartFocus,
    PauseFocus,
    ResumeFocus,
    StopFocus,
    StartRest,
    // Assist timer messages
    AssistStart(u64),
    AssistPause,
    AssistResume,
    AssistStop,
    // Timer tick
    TimerTick,
}

impl Default for TodoApp {
    fn default() -> Self {
        let db = Database::open_in_memory()
            .expect("Failed to open database");

        let settings = db.get_settings()
            .unwrap_or_default();

        let current_date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let todos = db.get_todos_by_date(&current_date)
            .unwrap_or_default();

        Self {
            db,
            current_date,
            todos,
            new_task_text: String::new(),
            focus_timer: FocusTimer::new(settings.focus_duration_minutes, settings.rest_duration_minutes),
            settings,
            assist_timer: AssistTimer::new(5),
            active_tab: ActiveTab::Tasks,
        }
    }
}

fn update(app: &mut TodoApp, message: Message) -> Task<Message> {
    match message {
        // ── Task messages ────────────────────────────────────
        Message::NewTaskChanged(value) => {
            app.new_task_text = value;
        }
        Message::AddTask => {
            let task_text = app.new_task_text.trim().to_string();
            if task_text.is_empty() {
                return Task::none();
            }
            let now = chrono::Utc::now().to_rfc3339();
            let todo = Todo {
                id: 0,
                uuid: uuid::Uuid::new_v4().to_string(),
                date: app.current_date.clone(),
                text: task_text,
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
            };
            if app.db.add_todo(&todo).is_ok() {
                app.todos = app.db.get_todos_by_date(&app.current_date)
                    .unwrap_or_default();
                app.new_task_text.clear();
            }
        }
        Message::ToggleComplete(uuid) => {
            if let Some(mut todo) = app.db.get_todo_by_uuid(&uuid).ok().flatten() {
                todo.completed = !todo.completed;
                todo.updated_at = chrono::Utc::now().to_rfc3339();
                let _ = app.db.update_todo(&todo);
                app.todos = app.db.get_todos_by_date(&app.current_date)
                    .unwrap_or_default();
            }
        }
        Message::DeleteTask(uuid) => {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = app.db.delete_todo(&uuid, &now);
            app.todos = app.db.get_todos_by_date(&app.current_date)
                    .unwrap_or_default();
        }
        Message::PreviousDay => {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&app.current_date, "%Y-%m-%d") {
                app.current_date = (d - chrono::Duration::days(1))
                    .format("%Y-%m-%d").to_string();
                app.todos = app.db.get_todos_by_date(&app.current_date)
                    .unwrap_or_default();
            }
        }
        Message::NextDay => {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&app.current_date, "%Y-%m-%d") {
                app.current_date = (d + chrono::Duration::days(1))
                    .format("%Y-%m-%d").to_string();
                app.todos = app.db.get_todos_by_date(&app.current_date)
                    .unwrap_or_default();
            }
        }
        Message::GoToToday => {
            app.current_date = chrono::Local::now().format("%Y-%m-%d").to_string();
            app.todos = app.db.get_todos_by_date(&app.current_date)
                .unwrap_or_default();
        }
        // ── Tab navigation ───────────────────────────────────
        Message::SwitchTab(tab) => {
            app.active_tab = tab;
        }
        // ── Focus timer messages ─────────────────────────────
        Message::StartFocus => {
            app.focus_timer.start_focus();
        }
        Message::PauseFocus => {
            app.focus_timer.pause();
        }
        Message::ResumeFocus => {
            app.focus_timer.resume();
        }
        Message::StopFocus => {
            app.focus_timer.stop();
        }
        Message::StartRest => {
            app.focus_timer.start_rest();
        }
        // ── Assist timer messages ────────────────────────────
        Message::AssistStart(mins) => {
            app.assist_timer.set_duration(mins);
            app.assist_timer.start();
        }
        Message::AssistPause => {
            app.assist_timer.pause();
        }
        Message::AssistResume => {
            app.assist_timer.resume();
        }
        Message::AssistStop => {
            app.assist_timer.stop();
        }
        // ── Timer tick ───────────────────────────────────────
        Message::TimerTick => {
            let _event = app.focus_timer.tick();
            let _completed = app.assist_timer.tick();
        }
    }
    Task::none()
}

fn view(app: &TodoApp) -> Element<'_, Message> {
    match app.active_tab {
        ActiveTab::Tasks => view_tasks(app).into(),
        ActiveTab::Timer => view_timer(app).into(),
    }
}

fn view_tasks(app: &TodoApp) -> Column<'_, Message> {
    let tabs = row![
        button("Tasks").on_press(Message::SwitchTab(ActiveTab::Tasks)),
        button("Timer").on_press(Message::SwitchTab(ActiveTab::Timer)),
    ]
    .spacing(8);

    let date_display = text(&app.current_date).size(20);

    let nav = row![
        button("<").on_press(Message::PreviousDay),
        date_display,
        button(">").on_press(Message::NextDay),
        button("Today").on_press(Message::GoToToday),
    ]
    .spacing(8)
    .align_y(iced::Alignment::Center);

    let input_row = row![
        text_input("Add a task...", &app.new_task_text)
            .on_input(Message::NewTaskChanged)
            .on_submit(Message::AddTask)
            .width(Length::Fill),
        button("+").on_press(Message::AddTask),
    ]
    .spacing(8);

    let todo_list: Element<Message> = if app.todos.is_empty() {
        text("No tasks for today").into()
    } else {
        app.todos.iter().fold(Column::new().spacing(4), |col, todo| {
            let check_label = if todo.completed { "☑" } else { "☐" };
            let task_row = row![
                button(text(check_label).size(16))
                    .on_press(Message::ToggleComplete(todo.uuid.clone()))
                    .padding(2),
                text(&todo.text).size(16),
                button("×")
                    .on_press(Message::DeleteTask(todo.uuid.clone()))
                    .padding(2),
            ]
            .spacing(8)
            .align_y(iced::Alignment::Center);
            col.push(task_row)
        }).into()
    };

    column![tabs, nav, input_row, todo_list]
        .spacing(16)
        .padding(20)
}

fn view_timer(app: &TodoApp) -> Column<'_, Message> {
    let tabs = row![
        button("Tasks").on_press(Message::SwitchTab(ActiveTab::Tasks)),
        button("Timer").on_press(Message::SwitchTab(ActiveTab::Timer)),
    ]
    .spacing(8);

    let progress = app.focus_timer.progress();
    let remaining = app.focus_timer.format_remaining();

    let state_label = match app.focus_timer.state {
        TimerState::Idle => "Ready",
        TimerState::Focusing => "Focusing",
        TimerState::FocusPaused => "Paused",
        TimerState::Resting => "Resting",
        TimerState::RestPaused => "Rest Paused",
    };

    let timer_display = column![
        text(state_label).size(16),
        text(remaining).size(40),
    ]
    .spacing(8)
    .align_x(iced::Alignment::Center);

    let controls: Element<Message> = match app.focus_timer.state {
        TimerState::Idle => {
            row![button("Start Focus").on_press(Message::StartFocus)]
                .spacing(8)
                .into()
        }
        TimerState::Focusing => {
            row![
                button("Pause").on_press(Message::PauseFocus),
                button("Stop").on_press(Message::StopFocus),
            ]
            .spacing(8)
            .into()
        }
        TimerState::FocusPaused => {
            row![
                button("Resume").on_press(Message::ResumeFocus),
                button("Stop").on_press(Message::StopFocus),
            ]
            .spacing(8)
            .into()
        }
        TimerState::Resting => {
            row![
                button("Pause").on_press(Message::PauseFocus),
                button("Stop").on_press(Message::StopFocus),
            ]
            .spacing(8)
            .into()
        }
        TimerState::RestPaused => {
            row![
                button("Resume").on_press(Message::ResumeFocus),
                button("Stop").on_press(Message::StopFocus),
            ]
            .spacing(8)
            .into()
        }
    };

    // Assist timer section
    let assist_progress = app.assist_timer.progress();
    let assist_remaining = app.assist_timer.format_remaining();

    let assist_display = column![
        text("Assist Timer").size(14),
        text(assist_remaining).size(24),
    ]
    .spacing(4)
    .align_x(iced::Alignment::Center);

    let assist_controls: Element<Message> = match app.assist_timer.state {
        AssistTimerState::Idle | AssistTimerState::Completed => {
            row![
                button("2m").on_press(Message::AssistStart(2)),
                button("5m").on_press(Message::AssistStart(5)),
                button("10m").on_press(Message::AssistStart(10)),
                button("15m").on_press(Message::AssistStart(15)),
                button("20m").on_press(Message::AssistStart(20)),
            ]
            .spacing(4)
            .into()
        }
        AssistTimerState::Running => {
            row![
                button("Pause").on_press(Message::AssistPause),
                button("Stop").on_press(Message::AssistStop),
            ]
            .spacing(4)
            .into()
        }
        AssistTimerState::Paused => {
            row![
                button("Resume").on_press(Message::AssistResume),
                button("Stop").on_press(Message::AssistStop),
            ]
            .spacing(4)
            .into()
        }
    };

    let assist_section = column![
        assist_display,
        assist_controls,
    ]
    .spacing(8)
    .align_x(iced::Alignment::Center);

    column![
        tabs,
        timer_display,
        controls,
        Space::new().height(Length::Fixed(20.0)),
        assist_section,
    ]
    .spacing(16)
    .padding(20)
    .align_x(iced::Alignment::Center)
}

fn subscription(app: &TodoApp) -> Subscription<Message> {
    match (app.focus_timer.state, app.assist_timer.state) {
        (TimerState::Idle, AssistTimerState::Idle | AssistTimerState::Completed) => {
            Subscription::none()
        }
        _ => {
            every(std::time::Duration::from_secs(1)).map(|_| Message::TimerTick)
        }
    }
}

fn app_theme(app: &TodoApp) -> Theme {
    if app.settings.theme == "light" {
        Theme::Light
    } else {
        Theme::Dark
    }
}

fn main() -> iced::Result {
    application(TodoApp::default, update, view)
        .title("Todo")
        .theme(app_theme)
        .subscription(subscription)
        .window_size(iced::Size::new(680.0, 600.0))
        .centered()
        .run()
}
