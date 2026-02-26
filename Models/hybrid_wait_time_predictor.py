import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler

# -----------------------------
# SETTINGS
# -----------------------------
TIME_STEPS = 5
MODEL_PATH = "lstm_wait_time_model.h5"

# -----------------------------
# LOAD DATA
# -----------------------------
data = pd.read_csv("hospital_queue.csv")

# We only need waiting time column
waiting_times = data["waiting_time"].values.reshape(-1, 1)

# -----------------------------
# SCALE DATA
# -----------------------------
scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(waiting_times)

# -----------------------------
# MOVING AVERAGE FUNCTION
# -----------------------------
def moving_average(values, window=5):
    return np.mean(values[-window:])

# -----------------------------
# PREPARE LSTM INPUT
# -----------------------------
def create_lstm_input(data, time_steps):
    return data[-time_steps:].reshape(1, time_steps, 1)

# -----------------------------
# LOAD TRAINED LSTM MODEL
# -----------------------------
model = load_model(MODEL_PATH)

# -----------------------------
# PREDICTION
# -----------------------------
# Moving Average Prediction
ma_prediction = moving_average(waiting_times.flatten(), TIME_STEPS)

# LSTM Prediction
lstm_input = create_lstm_input(scaled_data, TIME_STEPS)
lstm_pred_scaled = model.predict(lstm_input)

lstm_prediction = scaler.inverse_transform(lstm_pred_scaled)[0][0]

# -----------------------------
# HYBRID FORMULA
# -----------------------------
HYBRID_WEIGHT_LSTM = 0.6
HYBRID_WEIGHT_MA = 0.4

hybrid_prediction = (
    HYBRID_WEIGHT_LSTM * lstm_prediction +
    HYBRID_WEIGHT_MA * ma_prediction
)

# -----------------------------
# RESULTS
# -----------------------------
print("\n===== WAIT TIME PREDICTION =====")
print(f"Moving Average Prediction: {ma_prediction:.2f} minutes")
print(f"LSTM Prediction: {lstm_prediction:.2f} minutes")
print(f"Hybrid Prediction: {hybrid_prediction:.2f} minutes")
print("================================")