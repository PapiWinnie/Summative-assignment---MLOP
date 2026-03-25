import os
import numpy as np
from dotenv import load_dotenv

load_dotenv()

CLASS_NAMES = {
    0: "air_conditioner",
    1: "car_horn",
    2: "children_playing",
    3: "dog_bark",
    4: "drilling",
    5: "engine_idling",
    6: "gun_shot",
    7: "jackhammer",
    8: "siren",
    9: "street_music",
}

_model = None
_model_path = os.getenv("MODEL_PATH", "models/urbansound_model.pkl")

if os.path.exists(_model_path):
    from src.model import load_model
    _model = load_model(_model_path)


def reload_model():
    """Reload model from disk — called after retraining completes."""
    global _model
    if os.path.exists(_model_path):
        from src.model import load_model
        _model = load_model(_model_path)


def predict(file_path: str) -> dict:
    if _model is None:
        raise RuntimeError("Model not trained yet. Run the notebook to produce models/urbansound_model.pkl.")

    from src.preprocessing import extract_features
    features = extract_features(file_path).reshape(1, -1)

    class_id = int(_model.predict(features)[0])
    proba = _model.predict_proba(features)[0]
    confidence = float(np.max(proba))

    return {
        "class": CLASS_NAMES.get(class_id, str(class_id)),
        "confidence": round(confidence, 4),
        "class_id": class_id,
    }
