use global_hotkey::{GlobalHotKeyManager, GlobalHotKeyEvent, hotkey::{Code, HotKey, Modifiers}};

/// Global hotkey manager
pub struct HotKeyManager {
    manager: GlobalHotKeyManager,
    hotkey_add: HotKey,
    hotkey_focus: HotKey,
    hotkey_toggle: HotKey,
}

/// Actions triggered by global hotkeys
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotKeyAction {
    QuickAdd,
    ToggleFocus,
    ToggleWindow,
}

impl HotKeyManager {
    /// Create and register global hotkeys
    pub fn new() -> anyhow::Result<Self> {
        let manager = GlobalHotKeyManager::new()?;

        let hotkey_add = HotKey::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyA,
        );
        let hotkey_focus = HotKey::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::Space,
        );
        let hotkey_toggle = HotKey::new(
            Some(Modifiers::CONTROL | Modifiers::SHIFT),
            Code::KeyT,
        );

        manager.register(hotkey_add)?;
        manager.register(hotkey_focus)?;
        manager.register(hotkey_toggle)?;

        Ok(Self {
            manager,
            hotkey_add,
            hotkey_focus,
            hotkey_toggle,
        })
    }

    /// Poll for global hotkey events (non-blocking)
    pub fn poll_event(&self) -> Option<HotKeyAction> {
        match GlobalHotKeyEvent::receiver().try_recv() {
            Ok(event) => {
                if event.id == self.hotkey_add.id() {
                    Some(HotKeyAction::QuickAdd)
                } else if event.id == self.hotkey_focus.id() {
                    Some(HotKeyAction::ToggleFocus)
                } else if event.id == self.hotkey_toggle.id() {
                    Some(HotKeyAction::ToggleWindow)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }
}

impl Drop for HotKeyManager {
    fn drop(&mut self) {
        let _ = self.manager.unregister(self.hotkey_add);
        let _ = self.manager.unregister(self.hotkey_focus);
        let _ = self.manager.unregister(self.hotkey_toggle);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotkey_action_variants() {
        let actions = vec![
            HotKeyAction::QuickAdd,
            HotKeyAction::ToggleFocus,
            HotKeyAction::ToggleWindow,
        ];
        assert_eq!(actions.len(), 3);
    }
}
