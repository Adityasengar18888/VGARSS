# ==============================================================================
# VGARSS 2.0 — Production Backend Dockerfile
# ------------------------------------------------------------------------------
# Multi-stage lightweight build on Python 3.12 Slim Linux
# ==============================================================================
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies to user directory
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ------------------------------------------------------------------------------
# Final Runtime Image
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

WORKDIR /app

# Install minimal runtime libraries (libpq for postgresql, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root unprivileged service user
RUN groupadd -g 1001 vgarss && useradd -u 1001 -g vgarss -m -s /bin/bash vgarss

# Copy installed python wheels from builder
COPY --from=builder /root/.local /home/vgarss/.local

# Copy application source code
COPY --chown=vgarss:vgarss backend /app/backend
COPY --chown=vgarss:vgarss scripts /app/scripts
COPY --chown=vgarss:vgarss pyproject.toml /app/

# Environment configuration
ENV PATH=/home/vgarss/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    VGARSS_ENV=production

USER vgarss

EXPOSE 8000

# Docker Healthcheck targeting the VGARSS telemetry health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/api/v2/health || exit 1

# Start migrations first, then launch ASGI uvicorn server
CMD python scripts/migrate_db.py && python -m uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}

