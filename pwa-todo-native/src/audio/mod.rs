/// Alarm tone types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlarmType {
    /// Focus timer completed
    FocusComplete,
    /// Rest timer completed
    RestComplete,
    /// Micro-break bell
    MicroBreak,
    /// Assist timer completed
    AssistComplete,
}

/// Audio service (placeholder - requires rodio + libasound2-dev)
/// Full implementation will be enabled after system libraries are installed
pub struct AudioService {
    alarm_volume: f32,
}

impl AudioService {
    pub fn new() -> Self {
        Self {
            alarm_volume: 0.8,
        }
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.alarm_volume = volume.clamp(0.0, 1.0);
    }

    pub fn play_alarm(&self, _alarm_type: AlarmType) -> anyhow::Result<()> {
        // TODO: implement with rodio after installing libasound2-dev
        Ok(())
    }

    pub fn play_tone(&self, _freq: f32, _duration_ms: u64) -> anyhow::Result<()> {
        // TODO: implement with rodio after installing libasound2-dev
        Ok(())
    }

    pub fn volume(&self) -> f32 {
        self.alarm_volume
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_service_creation() {
        let service = AudioService::new();
        assert!((service.alarm_volume - 0.8).abs() < f32::EPSILON);
    }

    #[test]
    fn test_audio_volume_clamp() {
        let mut service = AudioService::new();
        service.set_volume(1.5);
        assert!((service.alarm_volume - 1.0).abs() < f32::EPSILON);
        service.set_volume(-0.5);
        assert!((service.alarm_volume - 0.0).abs() < f32::EPSILON);
        service.set_volume(0.5);
        assert!((service.alarm_volume - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_alarm_types_exist() {
        let _ = AlarmType::FocusComplete;
        let _ = AlarmType::RestComplete;
        let _ = AlarmType::MicroBreak;
        let _ = AlarmType::AssistComplete;
    }
}
