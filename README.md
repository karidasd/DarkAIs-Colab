# 🚀 DarkAIs Colab: The Privacy-First Local AI IDE

![DarkAIs Banner](https://img.shields.io/badge/DarkAIs-Colab-00e5ff?style=for-the-badge&logo=jupyter&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)

DarkAIs Colab is a premium, open-source alternative to Jupyter Notebooks and Google Colab, built for the modern developer. It is designed to run locally on your machine, ensuring **100% data privacy** and full utilization of your local hardware (GPU/CPU). 

It features a stunning **Glassmorphism Dark UI**, built-in **HuggingFace AI Assistant**, and full Python code execution with persistent memory.

## ✨ Features
- **🧠 Persistent Kernel Memory:** Run Python code step-by-step. Variables and imports persist across cells, exactly like a real notebook.
- **📊 Matplotlib DataViz Support:** Render Python charts directly in the browser using an injected Base64 extraction layer. No annoying popup windows!
- **📦 Magic Commands (`!pip`):** Execute terminal commands directly inside the cells (e.g. `!pip install numpy`).
- **📂 Workspace File Browser:** A built-in sidebar to upload and manage files (CSVs, images) for your Python code to process.
- **🤖 Built-in AI Copilot:** Chat with HuggingFace's AI models directly inside your workspace without switching tabs.
- **🔒 Secure Execution (Optional):** Password-protect code execution when deploying publicly.

## 🚀 Live Demo
You can try the demo running on HuggingFace Spaces here (Password required to run Python):
👉 **[DarkAIs Colab on HuggingFace Spaces](https://huggingface.co/spaces/karidasd/DarkAIs-Colab)**

---

## 🛠️ Local Installation (Privacy-First)

### Requirements
- Python 3.10+
- Node.js & npm

### 1. Clone & Start Backend
```bash
git clone https://github.com/yourusername/darkais-colab.git
cd darkais-colab/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```
*The backend will run on `http://localhost:8000`.*

### 2. Start Frontend
Open a new terminal:
```bash
cd darkais-colab/frontend
npm install
npm run dev
```
*The stunning UI will open at `http://localhost:5173`.*

---

## 🐳 Docker Deployment (For HuggingFace / Render)
We've included a production-ready `Dockerfile` that combines the built React frontend and the FastAPI backend into a single container running on port `7860`.

1. Build the React app: `cd frontend && npm run build`
2. Build Docker: `docker build -t darkais-colab .`
3. Run: `docker run -p 7860:7860 darkais-colab`

*Note: You can override the execution password by setting the `DARK_PASS` environment variable.*

---
**Designed with ❤️ by [karidasd] using React & FastAPI.**
