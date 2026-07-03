FROM python:3.10-slim

WORKDIR /code

# Copy requirements and install
COPY backend/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy backend and built frontend
COPY backend/ /code/backend/
COPY frontend/dist/ /code/frontend/dist/

# Set working directory to backend so relative paths work
WORKDIR /code/backend

# Default Execution Password (you should override this in HF Space Settings -> Secrets)
ENV DARK_PASS="DarkAIs2026!"

# HuggingFace requires applications to run on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
