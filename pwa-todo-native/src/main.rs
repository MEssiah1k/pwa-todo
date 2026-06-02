mod db;
mod sync;
mod widget;
mod view;
mod audio;
mod system;
mod platform;

use db::Database;
use db::models::*;

use iced::widget::{button, column, row, text, text_input, Column};
use iced::{application, Element, Length, Theme};

/// Main application state
pub struct TodoApp {
    db: Database,
    current_date: String,
    todos: Vec<Todo>,
    new_task_text: String,
    settings: AppSettings,
}

/// User interface messages
#[derive(Debug, Clone)]
pub enum Message {
    NewTaskChanged(String),
    AddTask,
    ToggleComplete(String),
    DeleteTask(String),
    PreviousDay,
    NextDay,
    GoToToday,
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
            settings,
        }
    }
}

fn update(app: &mut TodoApp, message: Message) {
    match message {
        Message::NewTaskChanged(value) => {
            app.new_task_text = value;
        }
        Message::AddTask => {
            let task_text = app.new_task_text.trim().to_string();
            if task_text.is_empty() {
                return;
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
    }
}

fn view(app: &TodoApp) -> Column<'_, Message> {
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

    column![nav, input_row, todo_list]
        .spacing(16)
        .padding(20)
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
        .window_size(iced::Size::new(680.0, 600.0))
        .centered()
        .run()
}
