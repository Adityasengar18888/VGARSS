# ==============================================================================
# VGARSS 2.0 — Production Frontend Dockerfile
# ------------------------------------------------------------------------------
# Stage 1: Build static assets via Vite
# Stage 2: Serve via high-performance Nginx Alpine
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Nginx Static Server
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

