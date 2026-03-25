import io
import struct
import wave
from locust import HttpUser, task, between


def _make_wav_bytes(duration_sec: float = 1.0, sample_rate: int = 22050) -> bytes:
    """Generate a minimal valid WAV file in memory (silence)."""
    n_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{n_samples}h", *([0] * n_samples)))
    return buf.getvalue()


_SAMPLE_WAV = _make_wav_bytes()


class PredictUser(HttpUser):
    wait_time = between(0.5, 2)

    @task
    def predict(self):
        self.client.post(
            "/predict",
            files={"file": ("test.wav", io.BytesIO(_SAMPLE_WAV), "audio/wav")},
        )
