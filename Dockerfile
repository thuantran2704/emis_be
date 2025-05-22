# syntax=docker/dockerfile:1

# Set Node version
ARG NODE_VERSION=20.18.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"
WORKDIR /app
ENV NODE_ENV=production

# Build stage
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Copy and install dependencies
COPY package*.json ./
RUN npm ci

# Copy app code
COPY . .

# Final runtime image
FROM base

# Copy built app from build stage
COPY --from=build /app /app

# Use PORT from Fly secrets (default fallback: 5000)
ENV PORT=5000
EXPOSE 5000

# Start app
CMD ["npm", "run", "start"]
