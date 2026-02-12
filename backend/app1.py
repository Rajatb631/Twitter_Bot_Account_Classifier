import joblib, xgboost as xgb
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
model = AutoModel.from_pretrained("distilbert-base-uncased").to("cuda" if torch.cuda.is_available() else "cpu")
scaler = joblib.load("D:\\TwitterBotDetector2\\models\\scaler.pkl")
booster = xgb.Booster()
booster.load_model("D:\\TwitterBotDetector2\\models\\xgboost_bot_detector.json")

print("✅ All components loaded successfully")
