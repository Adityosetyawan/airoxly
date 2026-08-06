# Air OXLY backend — production Dockerfile.
# Optimized for Railway / Render / Fly.io / any Docker-compatible host.
FROM python:3.11-slim

# System deps needed by cryptography / bcrypt build wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only requirements first for better layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# App source
COPY . .

# Non-root user for security
RUN useradd -m -u 1000 oxly && chown -R oxly:oxly /app
USER oxly

# Cloud hosts inject $PORT; default to 8001 for local docker
ENV PORT=8001
EXPOSE 8001

# Simple healthcheck against /api/health (added in server.py)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1

# Bind uvicorn to 0.0.0.0 so PaaS load balancers can reach it
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
