# Docker Hub Publishing Setup

This repository is configured to automatically build and push multi-architecture Docker images to Docker Hub when releases are published.

## Supported Architectures

- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/aarch64)

## Required GitHub Secrets

To enable Docker Hub publishing, you need to configure the following secrets in your GitHub repository:

### 1. DOCKERHUB_USERNAME
Your Docker Hub username.

**How to add:**
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DOCKERHUB_USERNAME`
5. Value: Your Docker Hub username

### 2. DOCKERHUB_TOKEN
A Docker Hub access token (not your password).

**How to create and add:**
1. Log in to [Docker Hub](https://hub.docker.com/)
2. Go to Account Settings → Security → Access Tokens
3. Click "New Access Token"
4. Give it a descriptive name (e.g., "GitHub Actions - sprout-track")
5. Set permissions to "Read, Write, Delete"
6. Copy the generated token
7. In your GitHub repository:
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `DOCKERHUB_TOKEN`
   - Value: Paste the token you copied

## How It Works

### Automatic Builds on Release
When you publish a new release on GitHub:
1. The workflow automatically triggers
2. Builds Docker images for both AMD64 and ARM64 architectures
3. Tags the images with:
   - The semantic version (e.g., `v1.0.0`)
   - Major.minor version (e.g., `1.0`)
   - Major version (e.g., `1`)
   - `latest` (if it's the default branch)
4. Pushes all images to Docker Hub
5. Updates the Docker Hub repository description with your README

### Manual Builds
You can also trigger a build manually:
1. Go to Actions → Build and Push Docker Images
2. Click "Run workflow"
3. Enter a custom tag (e.g., `v1.0.0` or `latest`)
4. Click "Run workflow"

## Docker Image Location

After setup, your images will be available at:
```
docker pull <your-dockerhub-username>/sprout-track:latest
docker pull <your-dockerhub-username>/sprout-track:v1.0.0
```

## Build Configuration

The workflow builds with the following settings:
- `ENABLE_NOTIFICATIONS=false`
- `BUILD_NOTIFICATIONS=false`

If you need to change these, edit `.github/workflows/docker-publish.yml`.

## Caching

The workflow uses GitHub Actions cache to speed up builds. Subsequent builds will be faster as layers are cached.
