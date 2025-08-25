# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install required system dependencies
RUN apk add --no-cache tini

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/sandbox

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/mcp-db.sqlite
ENV LOG_FILE=/app/logs/mcp-server.log
ENV SANDBOX_DIR=/app/sandbox

# Expose the application port
EXPOSE 3000

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Set the command to run the application
CMD ["node", "dist/index.js"]
