import os
import numpy as np
import pandas as pd
import joblib
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import GridSearchCV, PredefinedSplit, StratifiedShuffleSplit
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

from src.preprocessing import extract_features

MODELS_DIR = "models"


def load_dataset(data_dir: str, metadata_csv: str):
    meta = pd.read_csv(metadata_csv)

    train_meta = meta[meta["fold"] != 10].copy()
    test_meta = meta[meta["fold"] == 10].copy()

    print(f"Training samples: {len(train_meta)}, Test samples: {len(test_meta)}")

    X_train, y_train, fold_ids = [], [], []
    for _, row in train_meta.iterrows():
        fp = os.path.join(data_dir, f"fold{row['fold']}", row["slice_file_name"])
        if not os.path.exists(fp):
            continue
        try:
            feat = extract_features(fp)
            X_train.append(feat)
            y_train.append(row["classID"])
            fold_ids.append(row["fold"])
        except Exception:
            pass

    X_test, y_test = [], []
    for _, row in test_meta.iterrows():
        fp = os.path.join(data_dir, "fold10", row["slice_file_name"])
        if not os.path.exists(fp):
            continue
        try:
            feat = extract_features(fp)
            X_test.append(feat)
            y_test.append(row["classID"])
        except Exception:
            pass

    return (
        np.array(X_train),
        np.array(y_train),
        np.array(fold_ids),
        np.array(X_test),
        np.array(y_test),
    )


def train_initial(X_train: np.ndarray, y_train: np.ndarray, fold_ids: np.ndarray):
    unique_folds = np.unique(fold_ids)
    test_fold = np.full(len(y_train), -1, dtype=int)
    for i, fold in enumerate(unique_folds):
        test_fold[fold_ids == fold] = i

    ps = PredefinedSplit(test_fold)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", probability=True, class_weight="balanced")),
    ])

    param_grid = {
        "svc__C": [1, 10, 100],
        "svc__gamma": ["scale", "auto"],
    }

    grid_search = GridSearchCV(
        pipeline,
        param_grid,
        cv=ps,
        scoring="accuracy",
        n_jobs=-1,
        verbose=2,
        refit=True,
    )
    grid_search.fit(X_train, y_train)

    print(f"Best params: {grid_search.best_params_}")
    print(f"Best CV accuracy: {grid_search.best_score_:.4f}")

    return grid_search


def evaluate(model, X_test: np.ndarray, y_test: np.ndarray) -> dict:
    y_pred = model.predict(X_test)

    return {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "weighted_f1": float(f1_score(y_test, y_pred, average="weighted")),
        "precision_per_class": precision_score(y_test, y_pred, average=None).tolist(),
        "recall_per_class": recall_score(y_test, y_pred, average=None).tolist(),
        "f1_per_class": f1_score(y_test, y_pred, average=None).tolist(),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(y_test, y_pred, output_dict=True),
    }


def save_model(model, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    joblib.dump(model, path)


def load_model(path: str):
    return joblib.load(path)


def retrain_from_base(base_model_path: str, new_X: np.ndarray, new_y: np.ndarray):
    base_model = load_model(base_model_path)

    if hasattr(base_model, "best_params_"):
        best_c = base_model.best_params_["svc__C"]
        best_gamma = base_model.best_params_["svc__gamma"]
    else:
        best_c = base_model.named_steps["svc"].C
        best_gamma = base_model.named_steps["svc"].gamma

    X_orig = np.load(os.path.join(MODELS_DIR, "X_train.npy"))
    y_orig = np.load(os.path.join(MODELS_DIR, "y_train.npy"))

    sss = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    _, sample_idx = next(sss.split(X_orig, y_orig))
    X_combined = np.vstack([X_orig[sample_idx], new_X])
    y_combined = np.concatenate([y_orig[sample_idx], new_y])

    updated_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", C=best_c, gamma=best_gamma, probability=True, class_weight="balanced")),
    ])
    updated_pipeline.fit(X_combined, y_combined)

    X_test = np.load(os.path.join(MODELS_DIR, "X_test.npy"))
    y_test = np.load(os.path.join(MODELS_DIR, "y_test.npy"))
    accuracy = float(accuracy_score(y_test, updated_pipeline.predict(X_test)))

    save_model(updated_pipeline, base_model_path)
    print(f"Retrained model saved. Test accuracy: {accuracy:.4f}")

    return updated_pipeline, accuracy