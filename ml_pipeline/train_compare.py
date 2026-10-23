"""
Comparative Model Training Pipeline (Rule 5 & SO-5, SO-6, SO-7)
Empirically compares Logistic Regression vs. Random Forest for Chapter 4 results.
Uses GroupKFold grouped by student_id to prevent data leakage.
"""

import json
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, GroupKFold
from sklearn.preprocessing import StandardScaler

from feature_engineering import FEATURE_NAMES

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


def evaluate_model(name: str, y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray):
    return {
        "model": name,
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4) if len(np.unique(y_true)) > 1 else None,
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }


def run_training_and_comparison(df: pd.DataFrame):
    """
    df must contain FEATURE_NAMES columns + 'target' (binary outcome) + 'student_id'
    """
    X = df[FEATURE_NAMES].values
    y = df["target"].values
    groups = df["student_id"].values

    gkf = GroupKFold(n_splits=5)

    logreg_metrics = []
    rf_metrics = []

    for fold, (train_idx, val_idx) in enumerate(gkf.split(X, y, groups=groups)):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]

        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_val_scaled = scaler.transform(X_val)

        # 1. Logistic Regression
        logreg = LogisticRegression(max_iter=1000, random_state=42)
        logreg.fit(X_train_scaled, y_train)
        logreg_preds = logreg.predict(X_val_scaled)
        logreg_probs = logreg.predict_proba(X_val_scaled)[:, 1]
        logreg_metrics.append(evaluate_model("LogisticRegression", y_val, logreg_preds, logreg_probs))

        # 2. Random Forest Classifier
        rf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        rf.fit(X_train, y_train)
        rf_preds = rf.predict(X_val)
        rf_probs = rf.predict_proba(X_val)[:, 1]
        rf_metrics.append(evaluate_model("RandomForest", y_val, rf_preds, rf_probs))

    # Fit final models on all data for deployment
    final_scaler = StandardScaler()
    X_scaled = final_scaler.fit_transform(X)

    final_logreg = LogisticRegression(max_iter=1000, random_state=42)
    final_logreg.fit(X_scaled, y)

    final_rf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    final_rf.fit(X, y)

    # Save artifacts
    joblib.dump(final_logreg, ARTIFACTS_DIR / "logistic_regression.joblib")
    joblib.dump(final_rf, ARTIFACTS_DIR / "random_forest.joblib")
    joblib.dump(final_scaler, ARTIFACTS_DIR / "feature_scaler.joblib")

    results_summary = {
        "features": FEATURE_NAMES,
        "n_samples": len(df),
        "n_students": int(len(np.unique(groups))),
        "logreg_cv_mean_f1": float(np.mean([m["f1_score"] for m in logreg_metrics])),
        "rf_cv_mean_f1": float(np.mean([m["f1_score"] for m in rf_metrics])),
        "logreg_metrics_folds": logreg_metrics,
        "rf_metrics_folds": rf_metrics,
    }

    with open(ARTIFACTS_DIR / "metrics_summary.json", "w") as f:
        json.dump(results_summary, f, indent=2)

    print("Training and comparative evaluation complete. Artifacts saved in ml_pipeline/artifacts/")
    return results_summary


if __name__ == "__main__":
    print("Run `run_training_and_comparison(df)` with authentic student data during Phase 5.")
