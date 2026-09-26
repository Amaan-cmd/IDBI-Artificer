# =========================================================================
# EnverAI Artificer: Autonomous Underwriting Citadel Production Dockerfile
# Optimized for Google Cloud Run, Azure Container Apps, & Kubernetes
# =========================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Server Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies for backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Copy backend source code & mock data
COPY backend/ ./backend/

# Copy compiled frontend from builder stage into place
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose standard Cloud Run HTTP port
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/v1/health || exit 1

# Launch EnverAI Artificer Single-Container Citadel
CMD ["node", "backend/server.js"]
