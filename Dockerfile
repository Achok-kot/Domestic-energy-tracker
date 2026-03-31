# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (layer caching - only re-runs npm install if these change)
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci --only=production

# Stage 2: Production image
FROM node:20-alpine AS production

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001

WORKDIR /app

# Copy only production node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodeuser:nodejs . .

# Switch to non-root user
USER nodeuser

# Expose the app port
EXPOSE 3000

# Health check - Docker will restart the container if this fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]
