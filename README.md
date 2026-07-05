# Ebupteam

First runnable Rust Axum backend for the media maintenance claim panel.

## Run

```bash
docker compose up --build
```

- App/API: `http://localhost:18080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Admin username defaults to `admin`; the password is generated in `.env` as `ADMIN_PASSWORD`.

Set or rotate `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `WEBHOOK_TOKEN` in `.env` before production use.

The Docker image builds the frontend during `docker compose up --build` and serves it from `/app/frontend/dist`. API settings redact stored secrets on read.
