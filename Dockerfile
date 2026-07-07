FROM node:20-bookworm AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM rust:1-bookworm AS builder
WORKDIR /app/backend
COPY backend/Cargo.toml ./
COPY backend/src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && mkdir -p /data
WORKDIR /app
COPY --from=builder /app/backend/target/release/ebupteam-backend /app/ebupteam-backend
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
EXPOSE 8080
VOLUME ["/data"]
CMD ["/app/ebupteam-backend"]
