# Use Node.js LTS as the base image
FROM node:22-alpine

# Install tzdata package for timezone support and openssl for ENC_HASH generation
RUN apk add --no-cache tzdata openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Copy prisma files first
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Disable Next.js telemetry
RUN npm exec next telemetry disable

# Generate Prisma clients (both main and log clients needed for build)
RUN npm run prisma:generate && \
    npm run prisma:generate:log

# Copy application files
COPY . .

# Create env directory and base .env file (ENC_HASH will be generated at container startup)
RUN mkdir -p /app/env && \
    echo "Creating base .env file..." && \
    echo "# Environment variables for Docker container" > /app/env/.env && \
    echo "DATABASE_URL=\"file:/db/baby-tracker.db\"" >> /app/env/.env && \
    echo "LOG_DATABASE_URL=\"file:/db/baby-tracker-logs.db\"" >> /app/env/.env && \
    echo "ENABLE_LOG=\"false\"" >> /app/env/.env && \
    echo "NODE_ENV=production" >> /app/env/.env && \
    echo "PORT=3000" >> /app/env/.env && \
    echo "TZ=UTC" >> /app/env/.env && \
    echo "AUTH_LIFE=86400" >> /app/env/.env && \
    echo "IDLE_TIME=28800" >> /app/env/.env && \
    echo "APP_VERSION=0.94.89" >> /app/env/.env && \
    echo "COOKIE_SECURE=false" >> /app/env/.env && \
    echo "Base .env file created (ENC_HASH will be generated at startup)"

# Build the application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=UTC

# Update database URLs to point to the volume
ENV DATABASE_URL="file:/db/baby-tracker.db"
ENV LOG_DATABASE_URL="file:/db/baby-tracker-logs.db"

# Create volume mount points
VOLUME /db
VOLUME /app/env

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
