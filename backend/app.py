from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import torch
import joblib
import xgboost as xgb
from transformers import AutoTokenizer, AutoModel

# --- Initialize FastAPI ---
app = FastAPI(title="Twitter Bot Detector API (Manual Mode)", version="2.0")

from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "chrome-extension:kjpnpldcjglnignbhgnkacipkiddigcp",  # optional: restrict in prod
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # set more restrictively for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Load all assets safely ---
try:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"⚡ Using device: {device}")

    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    model = AutoModel.from_pretrained("distilbert-base-uncased").to(device)
    model.eval()

    scaler = joblib.load("D:\\TwitterBotDetector2\\models\\scaler.pkl")
    booster = xgb.Booster()
    booster.load_model("D:\\TwitterBotDetector2\\models\\xgboost_bot_detector.json")

    print("✅ Model, tokenizer, and scaler loaded successfully!")

except Exception as e:
    print("❌ Error loading models:", e)
    raise e


# --- Define input structure ---
class ManualRequest(BaseModel):
    username: str
    bio: str
    tweet: str


# --- Feature extraction ---
def extract_numeric_features(username: str, bio: str, tweet: str):
    """Extracts lightweight numeric features from text."""
    return np.array([[
        len(tweet.split()),                   # Word count
        tweet.lower().count("http"),          # URLs
        int(tweet.lower().startswith("rt ")), # Retweets
        tweet.count("@"),                     # Mentions
        tweet.count("#"),                     # Hashtags
        tweet.count("?"),                     # Questions
        tweet.count("!"),                     # Exclamations
        sum(1 for c in tweet if not c.isalnum() and not c.isspace()),  # Special chars
        len(username),                        # Username length
        len(bio),                             # Bio length
        len(tweet),                           # Tweet length
        len(set(tweet.split())),              # Unique word count
        0.0, 0.0, 1.0                         # Padding
    ]], dtype=float)


# --- Prediction ---
def predict_bot(username: str, bio: str, tweet: str):
    """Combines BERT embeddings with numeric features and predicts bot probability."""
    text = f"{username} {bio} {tweet}"

    # Generate embedding
    enc = tokenizer([text], return_tensors="pt", truncation=True, padding=True, max_length=64).to(device)
    with torch.no_grad():
        emb = model(**enc).last_hidden_state.mean(dim=1).cpu().numpy()

    # Combine features
    num = extract_numeric_features(username, bio, tweet)
    feats = np.hstack([num, emb])

    # Scale + predict
    feats_scaled = scaler.transform(feats)
    dmat = xgb.DMatrix(feats_scaled)
    prob = booster.predict(dmat)[0]

    return round(float(prob) * 100, 2)


# --- Endpoint ---
@app.post("/predict")
async def predict_manual(data: ManualRequest):
    """Receives username, bio, tweet → returns bot probability."""
    try:
        print(f"📩 Received request for user: {data.username}")

        prob = predict_bot(data.username, data.bio, data.tweet)
        label = "🧠 Human" if prob > 70 else "⚠️ Suspicious" if prob > 35 else "🤖 Bot"


        return {
            "username": data.username,
            "bio": data.bio,
            "tweet": data.tweet,
            "human_probability": prob,
            "label": label
        }

    except Exception as e:
        print("❌ Internal error:", e)
        return {"error": str(e)}


@app.get("/")
def root():
    return {"message": "Twitter Bot Detector API is running! 🚀"}
