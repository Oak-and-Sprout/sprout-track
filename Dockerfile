# Use Node.js LTS as the base image
FROM node:22-alpine

# Build arguments
ARG ENABLE_NOTIFICATIONS=true
ARG DATABASE_PROVIDER=sqlite

# Install system packages:
# - tzdata: timezone support
# - openssl: ENC_HASH generation
# - dcron: notification cron jobs
# - curl: healthcheck
# - postgresql-client: pg_isready for PostgreSQL healthchecks
# - python3 make g++: build tools for better-sqlite3 native module
RUN apk add --no-cache tzdata openssl dcron curl postgresql-client \
    python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy prisma files first
COPY prisma ./prisma/

# Copy the prisma-provider script (needed before prisma generate)
COPY scripts/prisma-provider.js ./scripts/

# Install dependencies
RUN npm ci

# Disable Next.js telemetry
RUN npm exec next telemetry disable

# Configure Prisma for the target database provider and generate clients
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}
RUN npm run prisma:generate && \
    npm run prisma:generate:log

# Copy application files
COPY . .

# Conditionally set up notification files and directories if ENABLE_NOTIFICATIONS is true
RUN if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then \
      echo "Notification features enabled - setting up notification infrastructure..." && \
      mkdir -p /app/logs && \
      chmod 755 /app/logs && \
      echo "Notification logs directory created" && \
      # Fix line endings and permissions on cron script for Alpine
      sed -i 's/\r$//' /app/scripts/run-notification-cron.sh && \
      chmod +x /app/scripts/run-notification-cron.sh && \
      echo "Notification cron script prepared"; \
    else \
      echo "Notification features disabled - skipping notification setup"; \
    fi

# Create env directory and base .env file (ENC_HASH will be generated at container startup)
# DATABASE_URL is set at runtime via environment variables
RUN mkdir -p /app/env && \
    echo "Creating base .env file..." && \
    echo "# Environment variables for Docker container" > /app/env/.env && \
    echo "DATABASE_PROVIDER=\"${DATABASE_PROVIDER}\"" >> /app/env/.env && \
    echo "ENABLE_LOG=\"false\"" >> /app/env/.env && \
    echo "DATABASE_URL=\"file:/db/baby-tracker.db\"" >> /app/env/.env && \
    echo "LOG_DATABASE_URL=\"file:/db/baby-tracker-logs.db\"" >> /app/env/.env && \
    echo "NODE_ENV=production" >> /app/env/.env && \
    echo "PORT=3000" >> /app/env/.env && \
    echo "TZ=UTC" >> /app/env/.env && \
    echo "AUTH_LIFE=86400" >> /app/env/.env && \
    echo "REFRESH_TOKEN_LIFE=604800" >> /app/env/.env && \
    echo "IDLE_TIME=604800" >> /app/env/.env && \
    echo "APP_VERSION=1.3.2" >> /app/env/.env && \
    echo "COOKIE_SECURE=false" >> /app/env/.env && \
    echo "ENABLE_NOTIFICATIONS=true" >> /app/env/.env && \
    echo "Base .env file created (ENC_HASH will be generated at startup)" && \
    # Create symlink so Next.js can find the env file at build time and runtime
    ln -sf /app/env/.env /app/.env

# Build the application
RUN npm run build

# Remove build-only dependencies to reduce image size
RUN apk del python3 make g++

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=UTC

# Set notification environment variable from build arg
ENV ENABLE_NOTIFICATIONS=${ENABLE_NOTIFICATIONS}

# Default database URLs (SQLite) — overridden at runtime for PostgreSQL
ENV DATABASE_URL="file:/db/baby-tracker.db"
ENV LOG_DATABASE_URL="file:/db/baby-tracker-logs.db"

# Create volume mount points
VOLUME /db
VOLUME /app/env
VOLUME /app/Files

# Copy startup script that runs migrations and starts the app
COPY docker-startup.sh /usr/local/bin/docker-startup.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-startup.sh && \
    chmod +x /usr/local/bin/docker-startup.sh && \
    ls -la /usr/local/bin/docker-startup.sh && \
    echo "Startup script copied and made executable"

# Set entrypoint to run migrations before starting the app
ENTRYPOINT ["/usr/local/bin/docker-startup.sh"]

# Start the application
CMD ["npm", "start"]

# Expose the port
EXPOSE 3000
