FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, Pillow-HEIF, and PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create static upload directories
RUN mkdir -p static/uploads/panoramas/thumbs static/uploads/plans

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
