# UrbanSound8K MLOps Pipeline

An end-to-end MLOps pipeline for classifying urban audio clips into 10 sound categories using a scikit-learn SVM trained on the UrbanSound8K dataset.

Dataset : [UrbanSound8K](https://www.kaggle.com/datasets/chrisfilo/urbansound8k?resource=download)

## Demo

- [YouTube](https://youtu.be/G1yytcJd3DU)
- Live URL Frontend: [Vercel_Deployment](https://summative-assignment-mlop.vercel.app/insights])
- Live URL Backend: [Render_Backend](https://summative-assignment-mlop.vercel.app/insights)

## Description

This project implements a full MLOps pipeline for audio classification on the UrbanSound8K dataset, which contains 8732 labelled sound clips across 10 classes. Audio files are preprocessed into 160-dimensional feature vectors using MFCC statistics and their deltas, then classified by an SVM trained with GridSearchCV and a fold-aware PredefinedSplit. The pipeline exposes a FastAPI backend for inference, retraining, and monitoring, paired with a React dashboard for interacting with the model. New training data can be uploaded through the UI, stored in a Neon Postgres database, and used to retrain the model without restarting the service.

## Tech Stack

- Python 3.11
- FastAPI
- scikit-learn
- librosa
- React (Vite + Tailwind CSS)
- Docker / Docker Compose
- Neon Postgres

## Directory Structure

```
.
├── Dockerfile.api
├── Dockerfile.ui
├── docker-compose.yml
├── locustfile.py
├── requirements.txt
├── .env
├── models/
│   └── urbansound_model.pkl
├── notebook/
│   └── urbansound_pipeline.ipynb
├── src/
│   ├── api.py
│   ├── database.py
│   ├── model.py
│   ├── prediction.py
│   └── preprocessing.py
└── ui/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        └── pages/
            ├── Predict.jsx
            ├── Retrain.jsx
            ├── Insights.jsx
            └── Status.jsx
```

## Setup

### 1. Clone the repo

```bash
git clone <repo-url>
cd Summative-assignment---MLOP
```

### 2. Create and activate a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
MODEL_PATH=models/urbansound_model.pkl
```

### 5. Train the model

Open and run all cells in `notebook/urbansound_pipeline.ipynb`. This downloads the UrbanSound8K dataset via kagglehub, extracts features, trains the SVM, and saves `models/urbansound_model.pkl` along with the test split arrays.

### 6. Run the API

```bash
uvicorn src.api:app --port 8000 --reload
```

The API will be available at `http://localhost:8000`.

### 7. Run the UI

```bash
cd ui
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Running with Docker

```bash
docker-compose up --build
```

This starts both the API (port 8000) and the UI (port 80) in separate containers. Ensure your `.env` file is present in the project root before running.

## Load Testing Results

Load testing was performed with Locust against the `/predict` endpoint.

| Containers | Users | Avg Response (ms) | 95th % (ms) | RPS  |
|------------|-------|-------------------|-------------|------|
| 1          | 10    | 103               | 54          | 8    |
| 1          | 50    | 99                | 180         | 36.9 |
| 1          | 100   | 956               | 1500        | 46.2 |
| 2          | 100   | 2485              | 28000       | 58.7 |
| 4          | 100   | 1545              | 21000       | 67.1 |

To run load tests locally:

```bash
locust -f locustfile.py --host http://localhost:8000
```

## Model Performance

| Metric        | Value  |
|---------------|--------|
| Test accuracy | 76.22% |
| Weighted F1   | 0.7639 |

- **Dataset**: UrbanSound8K — 8732 samples across 10 classes
- **Classes**: air_conditioner, car_horn, children_playing, dog_bark, drilling, engine_idling, gun_shot, jackhammer, siren, street_music
- **Features**: 160-dimensional vector — MFCC mean, std, delta mean, and delta² mean (40 coefficients × 4 statistics)
- **Optimisation**: GridSearchCV over SVM `C` and `gamma` using `PredefinedSplit` to respect the original fold boundaries

## API Endpoints

| Method | Endpoint               | Description                                                               |
|--------|------------------------|---------------------------------------------------------------------------|
| GET    | `/health`              | Returns `{"status": "ok"}` — basic liveness check                        |
| GET    | `/status`              | Returns uptime, last retrain timestamp, and current model accuracy        |
| GET    | `/insights`            | Returns class distribution, avg clip duration, and MFCC variance by class |
| POST   | `/predict`             | Accepts a `.wav` file and returns the predicted class and confidence       |
| POST   | `/upload-training-data`| Accepts one or more `.wav` files with an optional label for retraining    |
| POST   | `/retrain`             | Triggers background retraining on all unprocessed uploaded files          |
| GET    | `/retrain/status`      | Returns whether retraining is running and accuracy from the last run      |
