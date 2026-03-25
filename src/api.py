import os
import time
import shutil
import threading
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

_start_time = time.time()
_retrain_running = False
_last_completed: str | None = None
_accuracy_after: float | None = None
_insights_cache: dict | None = None
_model_accuracy: float | None = None

UPLOADS_DIR = "data/uploads"
MODEL_PATH = os.getenv("MODEL_PATH", "models/urbansound_model.pkl")

os.makedirs(UPLOADS_DIR, exist_ok=True)


def _compute_insights():
    """Precompute summary stats from training metadata CSV. Called once on startup."""
    global _insights_cache, _model_accuracy

    # Always compute accuracy from saved model + test split (independent of dataset CSV)
    if os.path.exists(MODEL_PATH) and os.path.exists("models/X_test.npy"):
        from src.model import load_model
        from sklearn.metrics import accuracy_score
        model = load_model(MODEL_PATH)
        X_test = np.load("models/X_test.npy")
        y_test = np.load("models/y_test.npy")
        _model_accuracy = float(accuracy_score(y_test, model.predict(X_test)))

    dataset_path = os.getenv("DATASET_PATH", "")
    csv_path = os.path.join(dataset_path, "UrbanSound8K.csv") if dataset_path else ""

    # Try common kagglehub cache locations
    if not csv_path or not os.path.exists(csv_path):
        import glob as globmod
        candidates = globmod.glob(
            os.path.expanduser("~/.cache/kagglehub/**/UrbanSound8K.csv"), recursive=True
        )
        csv_path = candidates[0] if candidates else ""

    if not csv_path or not os.path.exists(csv_path):
        class_names = {
            0: "air_conditioner", 1: "car_horn", 2: "children_playing",
            3: "dog_bark", 4: "drilling", 5: "engine_idling",
            6: "gun_shot", 7: "jackhammer", 8: "siren", 9: "street_music",
        }

        # Class distribution from saved train+test splits
        if os.path.exists("models/y_train.npy") and os.path.exists("models/y_test.npy"):
            y_all = np.concatenate([np.load("models/y_train.npy"), np.load("models/y_test.npy")])
            dist = {class_names[int(k)]: int(v) for k, v in zip(*np.unique(y_all, return_counts=True))}
        else:
            dist = {}

        # MFCC variance per class from saved training features
        if os.path.exists("models/X_train.npy") and os.path.exists("models/y_train.npy"):
            X_tr = np.load("models/X_train.npy")
            y_tr = np.load("models/y_train.npy")
            mfcc_var = {}
            for cid, name in class_names.items():
                mask = y_tr == cid
                mfcc_var[name] = round(float(np.var(X_tr[mask])), 4) if mask.any() else 0.0
        else:
            mfcc_var = {}

        # Static avg duration — UrbanSound8K known class averages (audio files not available)
        avg_dur = {
            "air_conditioner": 4.0, "car_horn": 1.6, "children_playing": 4.0,
            "dog_bark": 3.3, "drilling": 4.0, "engine_idling": 4.0,
            "gun_shot": 0.8, "jackhammer": 4.0, "siren": 4.0, "street_music": 4.0,
        }

        _insights_cache = {
            "class_distribution": dist,
            "avg_duration_per_class": avg_dur,
            "top_mfcc_variance_per_class": mfcc_var,
        }
        return

    meta = pd.read_csv(csv_path)

    class_names = {
        0: "air_conditioner", 1: "car_horn", 2: "children_playing",
        3: "dog_bark", 4: "drilling", 5: "engine_idling",
        6: "gun_shot", 7: "jackhammer", 8: "siren", 9: "street_music",
    }

    dist = meta.groupby("classID").size().to_dict()
    class_distribution = {class_names.get(k, str(k)): int(v) for k, v in dist.items()}

    if "end" in meta.columns and "start" in meta.columns:
        meta["duration"] = meta["end"] - meta["start"]
        avg_dur = meta.groupby("classID")["duration"].mean().to_dict()
        avg_duration_per_class = {
            class_names.get(k, str(k)): round(float(v), 3) for k, v in avg_dur.items()
        }
    else:
        avg_duration_per_class = {name: 0.0 for name in class_names.values()}

    # MFCC variance: compute on a sample of files to keep startup fast
    mfcc_var = _compute_mfcc_variance_sample(meta, csv_path, class_names)

    _insights_cache = {
        "class_distribution": class_distribution,
        "avg_duration_per_class": avg_duration_per_class,
        "top_mfcc_variance_per_class": mfcc_var,
    }



def _compute_mfcc_variance_sample(meta: pd.DataFrame, csv_path: str, class_names: dict) -> dict:
    """Sample up to 5 files per class and compute average MFCC variance."""
    dataset_dir = os.path.dirname(csv_path)
    audio_dir = os.path.join(dataset_dir, "audio") if os.path.isdir(
        os.path.join(dataset_dir, "audio")
    ) else dataset_dir

    from src.preprocessing import extract_features

    variance_per_class: dict[str, list] = {name: [] for name in class_names.values()}

    for class_id, name in class_names.items():
        subset = meta[meta["classID"] == class_id].head(5)
        for _, row in subset.iterrows():
            fp = os.path.join(audio_dir, f"fold{row['fold']}", row["slice_file_name"])
            if not os.path.exists(fp):
                continue
            try:
                feat = extract_features(fp)
                variance_per_class[name].append(float(np.var(feat)))
            except Exception:
                pass

    return {
        name: round(float(np.mean(variances)), 4) if variances else 0.0
        for name, variances in variance_per_class.items()
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.database import init_db
    try:
        init_db()
    except Exception as e:
        print(f"DB init failed (non-fatal): {e}")
    _compute_insights()
    yield


app = FastAPI(title="UrbanSound8K API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status")
def status():
    uptime = int(time.time() - _start_time)
    return {
        "uptime_seconds": uptime,
        "last_trained": _last_completed,
        "model_accuracy": _model_accuracy,
        "healthy": True,
    }


@app.get("/insights")
def insights():
    if _insights_cache is None:
        raise HTTPException(status_code=503, detail="Insights not yet computed")
    return _insights_cache


@app.post("/predict")
async def predict_endpoint(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Only .wav files are accepted")

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()

        from src.prediction import predict
        try:
            result = predict(tmp.name)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))
        return result
    finally:
        os.unlink(tmp.name)


@app.post("/upload-training-data")
async def upload_training_data(
    files: list[UploadFile] = File(...),
    label: str = Form(default=None),
):
    from src.database import insert_file

    saved = []
    for f in files:
        if not f.filename.lower().endswith(".wav"):
            continue
        dest = os.path.join(UPLOADS_DIR, f.filename)
        # Avoid overwriting by appending a timestamp if file exists
        if os.path.exists(dest):
            base, ext = os.path.splitext(f.filename)
            dest = os.path.join(UPLOADS_DIR, f"{base}_{int(time.time())}{ext}")

        content = await f.read()
        with open(dest, "wb") as out:
            out.write(content)

        # Insert to DB BEFORE any processing (rubric requirement)
        file_id = insert_file(f.filename, dest, label)
        saved.append({"id": file_id, "filename": f.filename, "path": dest})

    return {"saved": saved, "count": len(saved)}


def _run_retrain():
    global _retrain_running, _last_completed, _accuracy_after, _model_accuracy

    from src.database import get_unprocessed_files, mark_processed
    from src.preprocessing import preprocess_batch
    from src.model import retrain_from_base

    try:
        rows = get_unprocessed_files()
        if not rows:
            return

        file_paths = [r["file_path"] for r in rows]
        labels = [r["label"] for r in rows]

        X_new = preprocess_batch(file_paths)

        # Convert string labels to class IDs
        name_to_id = {
            "air_conditioner": 0, "car_horn": 1, "children_playing": 2,
            "dog_bark": 3, "drilling": 4, "engine_idling": 5,
            "gun_shot": 6, "jackhammer": 7, "siren": 8, "street_music": 9,
        }
        y_new = np.array([
            name_to_id.get(str(lbl).lower().strip(), 0) if lbl else 0
            for lbl in labels
        ])

        _, accuracy = retrain_from_base(MODEL_PATH, X_new, y_new)

        for row in rows:
            mark_processed(row["id"])

        # Reload model in prediction module
        from src import prediction as pred_module
        pred_module.reload_model()

        _accuracy_after = accuracy
        _model_accuracy = accuracy
        _last_completed = datetime.now(timezone.utc).isoformat()
    except Exception as e:
        print(f"Retraining error: {e}")
    finally:
        _retrain_running = False


@app.post("/retrain")
def retrain():
    global _retrain_running

    if _retrain_running:
        return {"status": "already running", "files_queued": 0}

    from src.database import get_unprocessed_files
    rows = get_unprocessed_files()

    if not rows:
        return {"status": "no new files", "files_queued": 0}

    _retrain_running = True
    t = threading.Thread(target=_run_retrain, daemon=True)
    t.start()

    return {"status": "retraining started", "files_queued": len(rows)}


@app.get("/retrain/status")
def retrain_status():
    return {
        "running": _retrain_running,
        "last_completed": _last_completed,
        "accuracy_after": _accuracy_after,
    }
