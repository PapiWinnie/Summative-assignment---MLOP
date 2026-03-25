import numpy as np
import librosa


N_MFCC = 40
SAMPLE_RATE = 22050


def extract_features(file_path: str) -> np.ndarray:
    audio, sr = librosa.load(file_path, sr=SAMPLE_RATE, mono=True)
    mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=N_MFCC)
    delta = librosa.feature.delta(mfccs)
    delta2 = librosa.feature.delta(mfccs, order=2)
    return np.concatenate([
        np.mean(mfccs, axis=1),
        np.std(mfccs, axis=1),
        np.mean(np.abs(delta), axis=1),
        np.mean(np.abs(delta2), axis=1),
    ])


def preprocess_batch(file_paths: list[str]) -> np.ndarray:
    return np.vstack([extract_features(fp) for fp in file_paths])