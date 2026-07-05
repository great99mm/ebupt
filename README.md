# Ebupteam

First runnable Rust Axum backend for the media maintenance claim panel.

## Run

```bash
docker compose up --build
```

## Docker Run

Fresh install with Docker Hub image:

```bash
docker network create ebupteam || true && docker run -d --name ebupteam-postgres --network ebupteam -e POSTGRES_USER=ebupteam -e POSTGRES_PASSWORD=ebupteam -e POSTGRES_DB=ebupteam -v ebupteam-postgres:/var/lib/postgresql/data postgres:16-alpine && docker run -d --name ebupteam-redis --network ebupteam redis:7-alpine && docker run -d --name ebupteam --network ebupteam -p 18080:8080 -e DATABASE_URL=postgres://ebupteam:ebupteam@ebupteam-postgres:5432/ebupteam -e REDIS_URL=redis://ebupteam-redis:6379 -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=change-this-password -e WEBHOOK_TOKEN=change-this-token dedehao/ebupt:latest
```

Open `http://localhost:18080`, then log in with `admin` and the `ADMIN_PASSWORD` value from the command. Change `ADMIN_PASSWORD` and `WEBHOOK_TOKEN` before public deployment.

- App/API: `http://localhost:18080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Admin username defaults to `admin`; the password is generated in `.env` as `ADMIN_PASSWORD`.

Set or rotate `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `WEBHOOK_TOKEN` in `.env` before production use.

The Docker image builds the frontend during `docker compose up --build` and serves it from `/app/frontend/dist`. API settings redact stored secrets on read.
