use std::time::{Duration, Instant};

/// Focus timer state machine
#[derive(Debug, Clone)]
pub struct FocusTimer {
    /// Current state of the timer
    pub state: TimerState,
    /// Focus duration in seconds
    pub focus_duration_secs: u64,
    /// Rest duration in seconds
    pub rest_duration_secs: u64,
    /// When the current segment started (for calculating elapsed)
    started_at: Option<Instant>,
    /// Total elapsed seconds before the current running segment
    pre_elapsed_secs: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TimerState {
    /// Timer is not running
    Idle,
    /// Focus timer is running
    Focusing,
    /// Focus timer is paused
    FocusPaused,
    /// Rest timer is running
    Resting,
    /// Rest timer is paused
    RestPaused,
}

impl FocusTimer {
    /// Create a new timer with default durations
    pub fn new(focus_mins: u64, rest_mins: u64) -> Self {
        Self {
            state: TimerState::Idle,
            focus_duration_secs: focus_mins * 60,
            rest_duration_secs: rest_mins * 60,
            started_at: None,
            pre_elapsed_secs: 0,
        }
    }

    /// Start focus timer
    pub fn start_focus(&mut self) {
        if self.state == TimerState::Idle || self.state == TimerState::FocusPaused {
            self.started_at = Some(Instant::now());
            self.state = TimerState::Focusing;
        }
    }

    /// Pause the current timer
    pub fn pause(&mut self) {
        self.pre_elapsed_secs = self.total_elapsed_secs();
        self.started_at = None;
        match self.state {
            TimerState::Focusing => self.state = TimerState::FocusPaused,
            TimerState::Resting => self.state = TimerState::RestPaused,
            _ => {}
        }
    }

    /// Resume paused timer
    pub fn resume(&mut self) {
        match self.state {
            TimerState::FocusPaused => {
                self.started_at = Some(Instant::now());
                self.state = TimerState::Focusing;
            }
            TimerState::RestPaused => {
                self.started_at = Some(Instant::now());
                self.state = TimerState::Resting;
            }
            _ => {}
        }
    }

    /// Stop and reset the timer
    pub fn stop(&mut self) {
        self.state = TimerState::Idle;
        self.started_at = None;
        self.pre_elapsed_secs = 0;
    }

    /// Transition from focus to rest
    pub fn start_rest(&mut self) {
        self.pre_elapsed_secs = 0;
        self.started_at = Some(Instant::now());
        self.state = TimerState::Resting;
    }

    /// Get total elapsed seconds in current phase
    pub fn total_elapsed_secs(&self) -> u64 {
        let current = match self.started_at {
            Some(instant) => instant.elapsed().as_secs(),
            None => 0,
        };
        self.pre_elapsed_secs.saturating_add(current)
    }

    /// Get remaining seconds in current phase
    pub fn remaining_secs(&self) -> u64 {
        let duration = match self.state {
            TimerState::Focusing | TimerState::FocusPaused => self.focus_duration_secs,
            TimerState::Resting | TimerState::RestPaused => self.rest_duration_secs,
            TimerState::Idle => self.focus_duration_secs,
        };
        duration.saturating_sub(self.total_elapsed_secs())
    }

    /// Get progress as a value between 0.0 and 1.0
    pub fn progress(&self) -> f32 {
        let duration = match self.state {
            TimerState::Focusing | TimerState::FocusPaused => self.focus_duration_secs,
            TimerState::Resting | TimerState::RestPaused => self.rest_duration_secs,
            TimerState::Idle => return 0.0,
        };
        if duration == 0 {
            return 1.0;
        }
        (self.total_elapsed_secs() as f32 / duration as f32).min(1.0)
    }

    /// Check if the current phase has completed
    pub fn is_completed(&self) -> bool {
        self.remaining_secs() == 0 && self.state != TimerState::Idle
    }

    /// Format remaining time as MM:SS
    pub fn format_remaining(&self) -> String {
        let secs = self.remaining_secs();
        format!("{:02}:{:02}", secs / 60, secs % 60)
    }

    /// Tick: check if timer completed and auto-transition
    /// Returns what event occurred
    pub fn tick(&mut self) -> TimerEvent {
        if self.state == TimerState::Focusing && self.is_completed() {
            self.stop();
            return TimerEvent::FocusCompleted;
        }
        if self.state == TimerState::Resting && self.is_completed() {
            self.stop();
            return TimerEvent::RestCompleted;
        }
        TimerEvent::None
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TimerEvent {
    None,
    FocusCompleted,
    RestCompleted,
}

/// Assist (secondary) timer
#[derive(Debug, Clone)]
pub struct AssistTimer {
    pub state: AssistTimerState,
    pub duration_secs: u64,
    started_at: Option<Instant>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssistTimerState {
    Idle,
    Running,
    Paused,
    Completed,
}

impl AssistTimer {
    pub fn new(duration_mins: u64) -> Self {
        Self {
            state: AssistTimerState::Idle,
            duration_secs: duration_mins * 60,
            started_at: None,
        }
    }

    pub fn set_duration(&mut self, mins: u64) {
        self.duration_secs = mins * 60;
    }

    pub fn start(&mut self) {
        self.started_at = Some(Instant::now());
        self.state = AssistTimerState::Running;
    }

    pub fn pause(&mut self) {
        self.state = AssistTimerState::Paused;
        // Keep started_at for elapsed calculation
    }

    pub fn resume(&mut self) {
        if self.state == AssistTimerState::Paused {
            // Adjust started_at to account for pause time
            if let Some(at) = self.started_at {
                let elapsed_before_pause = at.elapsed().as_secs();
                let remaining = self.duration_secs.saturating_sub(elapsed_before_pause);
                // Reset as if starting fresh with remaining time
                self.duration_secs = remaining;
                self.started_at = Some(Instant::now());
            }
            self.state = AssistTimerState::Running;
        }
    }

    pub fn stop(&mut self) {
        self.state = AssistTimerState::Idle;
        self.started_at = None;
    }

    pub fn elapsed_secs(&self) -> u64 {
        match self.started_at {
            Some(at) => at.elapsed().as_secs(),
            None => 0,
        }
    }

    pub fn remaining_secs(&self) -> u64 {
        self.duration_secs.saturating_sub(self.elapsed_secs())
    }

    pub fn progress(&self) -> f32 {
        if self.duration_secs == 0 {
            return 1.0;
        }
        (self.elapsed_secs() as f32 / self.duration_secs as f32).min(1.0)
    }

    pub fn format_remaining(&self) -> String {
        let secs = self.remaining_secs();
        format!("{:02}:{:02}", secs / 60, secs % 60)
    }

    pub fn tick(&mut self) -> bool {
        if self.state == AssistTimerState::Running && self.remaining_secs() == 0 {
            self.state = AssistTimerState::Completed;
            return true;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_focus_timer_new() {
        let timer = FocusTimer::new(90, 20);
        assert_eq!(timer.focus_duration_secs, 5400);
        assert_eq!(timer.rest_duration_secs, 1200);
        assert_eq!(timer.state, TimerState::Idle);
        assert_eq!(timer.remaining_secs(), 5400);
        assert_eq!(timer.progress(), 0.0);
    }

    #[test]
    fn test_focus_timer_start() {
        let mut timer = FocusTimer::new(1, 1); // 1 min each
        timer.start_focus();
        assert_eq!(timer.state, TimerState::Focusing);
        assert!(timer.remaining_secs() <= 60);
        assert!(timer.progress() < 0.1); // Just started
    }

    #[test]
    fn test_focus_timer_pause_resume() {
        let mut timer = FocusTimer::new(5, 2);
        timer.start_focus();
        assert_eq!(timer.state, TimerState::Focusing);

        timer.pause();
        assert_eq!(timer.state, TimerState::FocusPaused);
        let elapsed_after_pause = timer.total_elapsed_secs();

        timer.resume();
        assert_eq!(timer.state, TimerState::Focusing);
        // Elapsed should include pre-elapsed + current segment
        assert!(timer.total_elapsed_secs() >= elapsed_after_pause);
    }

    #[test]
    fn test_focus_timer_stop() {
        let mut timer = FocusTimer::new(5, 2);
        timer.start_focus();
        timer.stop();
        assert_eq!(timer.state, TimerState::Idle);
        assert_eq!(timer.total_elapsed_secs(), 0);
    }

    #[test]
    fn test_focus_timer_transition_to_rest() {
        let mut timer = FocusTimer::new(5, 2);
        timer.start_focus();
        timer.stop();
        timer.start_rest();
        assert_eq!(timer.state, TimerState::Resting);
        assert!(timer.remaining_secs() <= 120);
    }

    #[test]
    fn test_focus_timer_format() {
        let timer = FocusTimer::new(90, 20);
        assert_eq!(timer.format_remaining(), "90:00");
    }

    #[test]
    fn test_focus_timer_tick_idle() {
        let mut timer = FocusTimer::new(1, 1);
        assert_eq!(timer.tick(), TimerEvent::None);
    }

    #[test]
    fn test_assist_timer_new() {
        let timer = AssistTimer::new(5);
        assert_eq!(timer.duration_secs, 300);
        assert_eq!(timer.state, AssistTimerState::Idle);
    }

    #[test]
    fn test_assist_timer_start() {
        let mut timer = AssistTimer::new(5);
        timer.start();
        assert_eq!(timer.state, AssistTimerState::Running);
    }

    #[test]
    fn test_assist_timer_pause_resume() {
        let mut timer = AssistTimer::new(5);
        timer.start();
        timer.pause();
        assert_eq!(timer.state, AssistTimerState::Paused);
        timer.resume();
        assert_eq!(timer.state, AssistTimerState::Running);
    }

    #[test]
    fn test_assist_timer_format() {
        let timer = AssistTimer::new(5);
        assert_eq!(timer.format_remaining(), "05:00");
    }
}
