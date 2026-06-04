use rodio::{OutputStream, OutputStreamHandle, Sink, Source};

/// Alarm tone types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlarmType {
    FocusComplete,
    RestComplete,
    MicroBreak,
    AssistComplete,
}

/// Audio service for playing alarm sounds
pub struct AudioService {
    _stream: Option<OutputStream>,
    _stream_handle: Option<OutputStreamHandle>,
    alarm_volume: f32,
}

impl AudioService {
    /// Create a new audio service
    pub fn new() -> Self {
        let (stream, stream_handle) = OutputStream::try_default()
            .map(|(s, h)| (Some(s), Some(h)))
            .unwrap_or((None, None));

        Self {
            _stream: stream,
            _stream_handle: stream_handle,
            alarm_volume: 0.8,
        }
    }

    /// Set alarm volume (0.0 - 1.0)
    pub fn set_volume(&mut self, volume: f32) {
        self.alarm_volume = volume.clamp(0.0, 1.0);
    }

    /// Get current volume
    pub fn volume(&self) -> f32 {
        self.alarm_volume
    }

    /// Play an alarm tone
    pub fn play_alarm(&self, alarm_type: AlarmType) -> anyhow::Result<()> {
        let handle = self._stream_handle.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No audio output available"))?;

        let sink = Sink::try_new(handle)?;
        let source = generate_tone(alarm_type);
        sink.set_volume(self.alarm_volume);
        sink.append(source);
        sink.detach();

        Ok(())
    }

    /// Play a single tone at given frequency for given duration
    pub fn play_tone(&self, freq: f32, duration_ms: u64) -> anyhow::Result<()> {
        let handle = self._stream_handle.as_ref()
            .ok_or_else(|| anyhow::anyhow!("No audio output available"))?;

        let sink = Sink::try_new(handle)?;
        let sample_rate = 44100u32;
        let duration_samples = (sample_rate as f32 * duration_ms as f32 / 1000.0) as usize;
        let total_secs = duration_ms as f32 / 1000.0;

        let samples: Vec<f32> = (0..duration_samples)
            .map(|i| {
                let t = i as f32 / sample_rate as f32;
                let envelope = envelope(t, total_secs);
                (2.0 * std::f32::consts::PI * freq * t).sin() * envelope * 0.3
            })
            .collect();

        let source = rodio::buffer::SamplesBuffer::new(1, sample_rate, samples);
        sink.set_volume(self.alarm_volume);
        sink.append(source);
        sink.detach();

        Ok(())
    }
}

/// ADSR-like envelope: quick attack, sustain, quick release
fn envelope(t: f32, total: f32) -> f32 {
    let attack = 0.01;
    let release = 0.05;
    if t < attack {
        t / attack
    } else if t > (total - release) {
        (total - t) / release
    } else {
        1.0
    }
}

/// Generate a synthesized alarm tone based on type
fn generate_tone(alarm_type: AlarmType) -> rodio::buffer::SamplesBuffer<f32> {
    let sample_rate = 44100u32;

    let (frequencies, total_duration_ms) = match alarm_type {
        AlarmType::FocusComplete => (vec![523.25, 659.25, 783.99], 1500), // C5 E5 G5 ascending
        AlarmType::RestComplete => (vec![440.0], 500),
        AlarmType::MicroBreak => (vec![880.0], 200),
        AlarmType::AssistComplete => (vec![660.0, 880.0], 800),
    };

    let tone_duration_ms = total_duration_ms / frequencies.len() as u64;
    let tone_secs = tone_duration_ms as f32 / 1000.0;
    let tone_samples = (sample_rate as f32 * tone_secs) as usize;
    let total_samples = tone_samples * frequencies.len();

    let samples: Vec<f32> = (0..total_samples)
        .map(|i| {
            let tone_index = (i / tone_samples).min(frequencies.len() - 1);
            let t = (i % tone_samples) as f32 / sample_rate as f32;
            let freq = frequencies[tone_index];
            (2.0 * std::f32::consts::PI * freq * t).sin() * envelope(t, tone_secs) * 0.3
        })
        .collect();

    rodio::buffer::SamplesBuffer::new(1, sample_rate, samples)
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
    fn test_tone_generation_no_panic() {
        let _tone = generate_tone(AlarmType::FocusComplete);
        let _tone = generate_tone(AlarmType::RestComplete);
        let _tone = generate_tone(AlarmType::MicroBreak);
        let _tone = generate_tone(AlarmType::AssistComplete);
    }

    #[test]
    fn test_envelope() {
        // Attack phase
        assert!(envelope(0.005, 1.0) < 1.0);
        assert!(envelope(0.005, 1.0) > 0.0);
        // Sustain phase
        assert!((envelope(0.5, 1.0) - 1.0).abs() < f32::EPSILON);
        // Release phase
        assert!(envelope(0.97, 1.0) < 1.0);
        assert!(envelope(0.97, 1.0) > 0.0);
    }

    #[test]
    fn test_play_tone_graceful() {
        let service = AudioService::new();
        // Should either succeed or fail gracefully
        let _ = service.play_tone(440.0, 200);
    }
}
