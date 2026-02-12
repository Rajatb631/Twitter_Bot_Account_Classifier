# 🤖 Twitter Bot Detection — Setup & Commands

This project detects Twitter (X) bots using a hybrid AI model combining **DistilBERT** and **XGBoost**, powered by **PyTorch (CUDA 11.8)** and **FastAPI**.

---

## ⚙️ 1️⃣ Create Virtual Environment
```bash
python -m venv VENV
 
 ACTIVATE VENV____________

 VENV\Scripts\activate

upgrade pip__________

python -m pip install --upgrade pip setuptools wheel


INSTALL DEPENDENCIES__________

pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cu118


RUN THE PROJECT_____

cd backend
uvicorn app:app --host 0.0.0.0 --port 8000

RUN  THE APP::::
http://127.0.0.1:8000/docs


ADD NEW KERNEL TO NOTEBOOK PROJECT_____

python -m ipykernel install --user --name="my-project-kernel" --display-name="Python (My Project)"