import sys
import io
import traceback
import subprocess
import os
import shutil
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests

app = FastAPI(title="DarkAIs Colab Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "workspace")
os.makedirs(WORKSPACE_DIR, exist_ok=True)

EXECUTION_PASSWORD = os.environ.get("DARK_PASS", "DarkAIs2026!")

# 1. Persistent Kernel State
KERNEL_STATE = {}

def reset_kernel():
    global KERNEL_STATE
    KERNEL_STATE = {}
    
    # Pre-inject matplotlib configuration into the kernel if installed
    matplotlib_injection = """
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import io, base64

    def _darkais_show(*args, **kwargs):
        buf = io.BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        print(f"\\n[[IMAGE:{img_str}]]\\n")
        plt.clf()

    plt.show = _darkais_show
except ImportError:
    pass
"""
    exec(matplotlib_injection, KERNEL_STATE)

# Initialize kernel on startup
reset_kernel()

class SecurityRequest(BaseModel):
    password: str = None

class CodeRequest(BaseModel):
    code: str
    password: str = None

class AIRequest(BaseModel):
    prompt: str
    model: str = "mistralai/Mistral-7B-Instruct-v0.2"

@app.get("/")
def read_root():
    return {"status": "DarkAIs Backend is running"}

@app.get("/hardware")
def get_hardware():
    hardware_list = [{"id": "cpu", "name": "CPU (Intel/AMD)"}]
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                hardware_list.append({
                    "id": f"cuda:{i}", 
                    "name": f"GPU: {torch.cuda.get_device_name(i)}"
                })
    except ImportError:
        pass
    return {"hardware": hardware_list}

@app.post("/restart_runtime")
def restart_runtime(req: SecurityRequest = None):
    if req and req.password != EXECUTION_PASSWORD:
        return {"error": "Unauthorized: Incorrect Execution Password."}
    reset_kernel()
    return {"status": "restarted"}

@app.post("/execute")
def execute_code(req: CodeRequest):
    if req.password != EXECUTION_PASSWORD:
        return {"error": "Unauthorized: Incorrect Execution Password."}
        
    global KERNEL_STATE
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    
    result = ""
    error = ""
    
    lines = req.code.split('\n')
    python_lines = []
    
    try:
        # Switch CWD to workspace for the execution
        old_cwd = os.getcwd()
        os.chdir(WORKSPACE_DIR)
        
        try:
            for line in lines:
                stripped = line.strip()
                if stripped.startswith('!'):
                    cmd = stripped[1:]
                    print(f"Running: {cmd}")
                    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
                    if proc.stdout: print(proc.stdout)
                    if proc.stderr: print(proc.stderr)
                else:
                    python_lines.append(line)
            
            if python_lines:
                python_code = '\n'.join(python_lines)
                exec(python_code, KERNEL_STATE)
        finally:
            os.chdir(old_cwd)
            
        result = redirected_output.getvalue()
    except Exception as e:
        error = traceback.format_exc()
        result = redirected_output.getvalue()
    finally:
        sys.stdout = old_stdout
        
    return {"output": result, "error": error}

@app.post("/ai_assist")
def ai_assist(req: AIRequest):
    hf_token = os.environ.get("HF_TOKEN", "")
    headers = {"Authorization": f"Bearer {hf_token}"} if hf_token else {}
    API_URL = f"https://api-inference.huggingface.co/models/{req.model}"
    
    payload = {
        "inputs": f"<s>[INST] {req.prompt} [/INST]",
        "parameters": {"max_new_tokens": 250}
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        if response.status_code == 200:
            return {"response": response.json()[0]['generated_text']}
        else:
            return {"error": f"HF API Error: {response.text}"}
    except Exception as e:
        return {"error": str(e)}

# --- File Browser APIs ---
@app.get("/files")
def list_files():
    files = []
    for f in os.listdir(WORKSPACE_DIR):
        if os.path.isfile(os.path.join(WORKSPACE_DIR, f)):
            files.append(f)
    return {"files": files}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    path = os.path.join(WORKSPACE_DIR, file.filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "success", "filename": file.filename}

@app.delete("/files/{filename}")
def delete_file(filename: str):
    path = os.path.join(WORKSPACE_DIR, filename)
    if os.path.exists(path):
        os.remove(path)
        return {"status": "success"}
    return JSONResponse(status_code=404, content={"error": "File not found"})

# Mount the React Frontend build directory
dist_dir = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
