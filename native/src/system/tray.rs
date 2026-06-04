use tray_icon::{
    TrayIconBuilder, TrayIcon, Icon,
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
};

/// System tray manager
pub struct TrayManager {
    tray: Option<TrayIcon>,
    menu_show: MenuItem,
    menu_focus: MenuItem,
    menu_pause: MenuItem,
    menu_stop: MenuItem,
    menu_quit: MenuItem,
}

impl TrayManager {
    /// Create and setup the system tray
    pub fn new() -> Self {
        let menu = Menu::new();
        let menu_show = MenuItem::new("Show Window", true, None);
        let menu_focus = MenuItem::new("Start Focus", true, None);
        let menu_pause = MenuItem::new("Pause", true, None);
        let menu_stop = MenuItem::new("Stop Timer", true, None);
        let menu_quit = MenuItem::new("Quit", true, None);

        menu.append(&menu_show).ok();
        menu.append(&menu_focus).ok();
        menu.append(&menu_pause).ok();
        menu.append(&menu_stop).ok();
        menu.append(&PredefinedMenuItem::separator()).ok();
        menu.append(&menu_quit).ok();

        let icon = create_default_icon();

        let tray = TrayIconBuilder::new()
            .with_menu(Box::new(menu))
            .with_tooltip("Todo")
            .with_icon(icon)
            .build()
            .ok();

        Self {
            tray,
            menu_show,
            menu_focus,
            menu_pause,
            menu_stop,
            menu_quit,
        }
    }

    /// Update tray tooltip and menu state based on timer state
    pub fn update_state(&self, timer_running: bool, timer_label: &str) {
        if let Some(ref tray) = self.tray {
            let tooltip = if timer_running {
                format!("Todo - {}", timer_label)
            } else {
                "Todo".to_string()
            };
            tray.set_tooltip(Some(&tooltip)).ok();
        }
        self.menu_focus.set_enabled(!timer_running);
        self.menu_pause.set_enabled(timer_running);
        self.menu_stop.set_enabled(timer_running);
    }

    /// Poll for tray menu events (non-blocking)
    pub fn poll_menu_event(&self) -> Option<TrayAction> {
        match MenuEvent::receiver().try_recv() {
            Ok(event) => {
                let id = event.id;
                if id == self.menu_show.id() {
                    Some(TrayAction::ShowWindow)
                } else if id == self.menu_focus.id() {
                    Some(TrayAction::StartFocus)
                } else if id == self.menu_pause.id() {
                    Some(TrayAction::PauseResume)
                } else if id == self.menu_stop.id() {
                    Some(TrayAction::StopTimer)
                } else if id == self.menu_quit.id() {
                    Some(TrayAction::Quit)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }
}

/// Actions from the tray menu
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrayAction {
    ShowWindow,
    StartFocus,
    PauseResume,
    StopTimer,
    Quit,
}

/// Create a simple default tray icon (green circle)
fn create_default_icon() -> Icon {
    let size = 32u32;
    let mut rgba = Vec::with_capacity((size * size * 4) as usize);

    let cx = size as f32 / 2.0;
    let cy = size as f32 / 2.0;
    let radius = size as f32 / 2.0 - 2.0;

    for y in 0..size {
        for x in 0..size {
            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            if dist <= radius {
                rgba.push(76);
                rgba.push(175);
                rgba.push(80);
                rgba.push(255);
            } else {
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
            }
        }
    }

    Icon::from_rgba(rgba, size, size).unwrap_or_else(|_| {
        Icon::from_rgba(vec![0, 0, 0, 0], 1, 1).expect("fallback icon")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_default_icon() {
        let _icon = create_default_icon();
    }

    #[test]
    fn test_tray_action_variants() {
        let actions = vec![
            TrayAction::ShowWindow,
            TrayAction::StartFocus,
            TrayAction::PauseResume,
            TrayAction::StopTimer,
            TrayAction::Quit,
        ];
        assert_eq!(actions.len(), 5);
    }
}
