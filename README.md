# Ebupteam

Rust Axum media task claim panel backed by a single SQLite database.

## Run

```bash
docker compose up -d
```

## Docker Run

Fresh install with Docker Hub image:

```bash
docker run -d --name ebupt -p 18080:8080 -v ebupt-data:/data -e ADMIN_USERNAME=admin dedehao/ebupt:latest
```

Open `http://localhost:18080`, then log in with `admin` and the generated `ADMIN_PASSWORD` printed by `docker logs ebupt`. If `WEBHOOK_TOKEN` is not set, a generated token is also printed in the logs.

- App/API: `http://localhost:18080`
- SQLite database: `/data/ebupt.db`
- Admin username defaults to `admin`; the password is generated at startup when `ADMIN_PASSWORD` is empty.

Set or rotate `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `WEBHOOK_TOKEN` in `.env` before production use.

The Docker image serves the frontend from `/app/frontend/dist`. API settings redact stored secrets on read.
