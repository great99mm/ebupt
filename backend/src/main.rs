use anyhow::anyhow;
use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Utc};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{collections::HashMap, env, net::SocketAddr, path::PathBuf, time::Duration as StdDuration};
use tower_http::{cors::CorsLayer, services::{ServeDir, ServeFile}, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    http: reqwest::Client,
    webhook_token: String,
}

#[derive(Debug, Clone, Serialize)]
struct User { id: Uuid, username: String, is_admin: bool, visible_roots: Value }

#[derive(Deserialize)]
struct LoginReq { username: String, password: String }
#[derive(Deserialize)]
struct PasswordReq { current_password: Option<String>, new_password: String }
#[derive(Deserialize)]
struct UserReq { username: Option<String>, password: Option<String>, is_admin: Option<bool>, visible_roots: Option<Value> }
#[derive(Deserialize)]
struct SectionQ { section: Option<String> }
#[derive(Deserialize)]
struct BrowseQ { path: Option<String> }
#[derive(Deserialize)]
struct SelectReq { path: String, #[serde(alias="type")] item_type: String, category: Option<String>, scrape: Option<bool> }
#[derive(Deserialize)]
struct SubmitReq { selection_token: String, category_id: String, scrape_enabled: bool }
#[derive(Deserialize)]
struct HallWebhook { title: String, media_type: Option<String>, external_id: Option<String>, poster_url: Option<String>, metadata: Option<Value> }
#[derive(Deserialize)]
struct SettingsReq { emby_url: Option<String>, emby_api_key: Option<String>, tmdb_api_key: Option<String>, openlist_url: Option<String>, openlist_token: Option<String>, visible_roots: Option<Value>, categories: Option<Value>, manager_url: Option<String>, manager_token: Option<String>, rclone_source_prefix: Option<String>, destination_mappings: Option<Value>, transfer_mode: Option<String> }

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt().with_env_filter("info,tower_http=info").init();
    let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://ebupteam:ebupteam@localhost:5432/ebupteam".into());
    let admin_username = env_value("ADMIN_USERNAME").unwrap_or_else(|| "admin".into());
    let (admin_password, generated_admin_password) = secret_or_generated("ADMIN_PASSWORD", 24);
    let (webhook_token, generated_webhook_token) = secret_or_generated("WEBHOOK_TOKEN", 32);
    if generated_admin_password {
        tracing::warn!("ADMIN_PASSWORD was not set; generated admin password for user '{admin_username}': {admin_password}");
    }
    if generated_webhook_token {
        tracing::warn!("WEBHOOK_TOKEN was not set; generated webhook token: {webhook_token}");
    }
    let db = connect_db(&database_url).await?;
    migrate(&db).await?;
    let admin_created = seed_admin(&db, &admin_username, &admin_password).await?;
    if generated_admin_password && !admin_created {
        tracing::warn!("user '{admin_username}' already exists; generated ADMIN_PASSWORD was not applied to the stored account");
    }
    if let Ok(redis_url) = env::var("REDIS_URL") { let _ = redis::Client::open(redis_url).and_then(|c| c.get_connection()).map_err(|e| tracing::warn!("redis unavailable: {e}")); }
    let state = AppState { db, http: reqwest::Client::new(), webhook_token };
    let api = Router::new()
        .route("/api/auth/login", post(login)).route("/api/auth/logout", post(logout)).route("/api/me", get(me)).route("/api/me/password", post(change_password))
        .route("/api/users", get(list_users).post(create_user)).route("/api/users/:id", post(update_user)).route("/api/users/:id/delete", post(delete_user))
        .route("/api/source-items", get(source_items)).route("/api/webhooks/hall", post(hall_webhook))
        .route("/api/source-items/:id/claim", post(claim)).route("/api/my-claims", get(my_claims))
        .route("/api/jobs/:id/release", post(release)).route("/api/openlist/browse", get(openlist_browse))
        .route("/api/jobs/:id/select", post(select_item)).route("/api/jobs/:id/compare", post(compare_job)).route("/api/jobs/:id/archive", post(archive_job)).route("/api/categories", get(categories))
        .route("/api/jobs/:id/submit", post(submit)).route("/api/settings", get(get_settings).post(post_settings))
        .route("/api/emby/refresh", post(emby_refresh));
    let static_dir = ["/app/frontend/dist", "./frontend/dist"].iter().map(PathBuf::from).find(|p| p.exists());
    let app = Router::new().merge(api).with_state(state).layer(CorsLayer::permissive()).layer(TraceLayer::new_for_http());
    let app = if let Some(dir) = static_dir {
        app.fallback_service(ServeDir::new(&dir).fallback(ServeFile::new(dir.join("index.html"))))
    } else { app };
    let addr: SocketAddr = "0.0.0.0:8080".parse()?;
    tracing::info!("listening on {addr}");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}

async fn connect_db(url: &str) -> anyhow::Result<PgPool> { for i in 1..=30 { match PgPoolOptions::new().max_connections(5).connect(url).await { Ok(p) => return Ok(p), Err(e) => { tracing::warn!("db connect attempt {i}/30 failed: {e}"); tokio::time::sleep(StdDuration::from_secs(2)).await; } } } Err(anyhow!("database unavailable")) }

async fn migrate(db: &PgPool) -> anyhow::Result<()> {
    let statements = [
        r#"CREATE EXTENSION IF NOT EXISTS pgcrypto"#,
        r#"CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text UNIQUE NOT NULL, password_hash text NOT NULL, is_admin boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())"#,
        r#"ALTER TABLE users ADD COLUMN IF NOT EXISTS visible_roots jsonb NOT NULL DEFAULT '[]'"#,
        r#"CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())"#,
        r#"CREATE TABLE IF NOT EXISTS app_settings(id boolean PRIMARY KEY DEFAULT true, emby_url text, emby_api_key text, tmdb_api_key text, openlist_url text, openlist_token text, visible_roots jsonb NOT NULL DEFAULT '[{"id":"default","path":"/"}]', categories jsonb NOT NULL DEFAULT '["Movies","TV"]', manager_url text, manager_token text, rclone_source_prefix text NOT NULL DEFAULT '', destination_mappings jsonb NOT NULL DEFAULT '{}', transfer_mode text NOT NULL DEFAULT 'copy', CHECK(id))"#,
        r#"INSERT INTO app_settings(id) VALUES(true) ON CONFLICT DO NOTHING"#,
        r#"CREATE TABLE IF NOT EXISTS source_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(source IN ('hall','emby')), external_id text, title text NOT NULL, media_type text NOT NULL DEFAULT 'movie', poster_url text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source, external_id))"#,
        r#"CREATE TABLE IF NOT EXISTS maintenance_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_item_id uuid NOT NULL REFERENCES source_items(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id), status text NOT NULL, selected_path text, selected_type text, selected_root text, category text, scrape boolean NOT NULL DEFAULT false, request_json jsonb, response_json jsonb, external_task_id text, error_text text, submitted_at timestamptz, released_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())"#,
        r#"ALTER TABLE maintenance_jobs ADD COLUMN IF NOT EXISTS compare_json jsonb"#,
        r#"ALTER TABLE maintenance_jobs ADD COLUMN IF NOT EXISTS archived_at timestamptz"#,
        r#"CREATE UNIQUE INDEX IF NOT EXISTS one_active_job_per_item ON maintenance_jobs(source_item_id) WHERE status NOT IN ('released','completed','failed')"#,
        r#"CREATE TABLE IF NOT EXISTS selection_tokens(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), job_id uuid NOT NULL REFERENCES maintenance_jobs(id) ON DELETE CASCADE, visible_root_id text NOT NULL, path text NOT NULL, item_type text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz)"#,
    ];
    for statement in statements {
        sqlx::query(statement).execute(db).await?;
    }
    Ok(())
}

fn env_value(name: &str) -> Option<String> { env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty()) }
fn random_hex(bytes: usize) -> String { let mut raw = vec![0_u8; bytes]; OsRng.fill_bytes(&mut raw); hex::encode(raw) }
fn secret_or_generated(name: &str, bytes: usize) -> (String, bool) { env_value(name).map(|v| (v, false)).unwrap_or_else(|| (random_hex(bytes), true)) }
async fn seed_admin(db: &PgPool, username: &str, password: &str) -> anyhow::Result<bool> { let hash = hash_password(password)?; let result = sqlx::query("INSERT INTO users(username,password_hash,is_admin,visible_roots) VALUES($1,$2,true,'[]') ON CONFLICT(username) DO NOTHING").bind(username).bind(hash).execute(db).await?; Ok(result.rows_affected() > 0) }
fn hash_password(p: &str) -> anyhow::Result<String> { Ok(Argon2::default().hash_password(p.as_bytes(), &SaltString::generate(&mut OsRng)).map_err(|e| anyhow!(e.to_string()))?.to_string()) }
fn token_hash(t: &str) -> String { hex::encode(Sha256::digest(t.as_bytes())) }

async fn auth(headers: &HeaderMap, db: &PgPool) -> Result<User, StatusCode> { let raw = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).and_then(|s| s.strip_prefix("Bearer ").map(str::to_string)).or_else(|| headers.get(header::COOKIE).and_then(|v| v.to_str().ok()).and_then(|c| c.split(';').find_map(|p| p.trim().strip_prefix("session=").map(str::to_string)))).ok_or(StatusCode::UNAUTHORIZED)?; let row = sqlx::query("SELECT u.id,u.username,u.is_admin,u.visible_roots FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()").bind(token_hash(&raw)).fetch_optional(db).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.ok_or(StatusCode::UNAUTHORIZED)?; Ok(User { id: row.get(0), username: row.get(1), is_admin: row.get(2), visible_roots: row.get(3) }) }
fn err(code: StatusCode, msg: &str) -> (StatusCode, Json<Value>) { (code, Json(json!({"error": msg}))) }

async fn login(State(s): State<AppState>, Json(req): Json<LoginReq>) -> impl IntoResponse { let row = match sqlx::query("SELECT id,password_hash,is_admin,visible_roots FROM users WHERE username=$1").bind(&req.username).fetch_optional(&s.db).await { Ok(Some(r)) => r, _ => return err(StatusCode::UNAUTHORIZED, "invalid credentials").into_response() }; let hash: String = row.get("password_hash"); if Argon2::default().verify_password(req.password.as_bytes(), &PasswordHash::new(&hash).unwrap()).is_err() { return err(StatusCode::UNAUTHORIZED, "invalid credentials").into_response(); } let token = Uuid::new_v4().to_string(); let exp = Utc::now() + Duration::days(7); let _ = sqlx::query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)").bind(token_hash(&token)).bind(row.get::<Uuid,_>("id")).bind(exp).execute(&s.db).await; let mut h = HeaderMap::new(); h.insert(header::SET_COOKIE, HeaderValue::from_str(&format!("session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800")).unwrap()); (h, Json(json!({"token":token,"user":{"id":row.get::<Uuid,_>("id"),"username":req.username,"is_admin":row.get::<bool,_>("is_admin"),"visible_roots":row.get::<Value,_>("visible_roots")}}))).into_response() }
async fn logout(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { if let Ok(u) = auth(&headers,&s.db).await { let _=sqlx::query("DELETE FROM sessions WHERE user_id=$1").bind(u.id).execute(&s.db).await; } let mut h=HeaderMap::new(); h.insert(header::SET_COOKIE, HeaderValue::from_static("session=; Path=/; Max-Age=0")); (h, Json(json!({"ok":true}))) }
async fn me(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { match auth(&headers,&s.db).await { Ok(u)=>Json(json!({"user":u})).into_response(), Err(c)=>err(c,"unauthorized").into_response() } }

fn public_user(r: sqlx::postgres::PgRow) -> Value { json!({"id":r.get::<Uuid,_>("id"),"username":r.get::<String,_>("username"),"is_admin":r.get::<bool,_>("is_admin"),"visible_roots":r.get::<Value,_>("visible_roots"),"created_at":r.get::<DateTime<Utc>,_>("created_at")}) }
async fn require_admin(headers:&HeaderMap, db:&PgPool)->Result<User,StatusCode>{ let u=auth(headers,db).await?; if u.is_admin{Ok(u)}else{Err(StatusCode::FORBIDDEN)} }
async fn change_password(State(s): State<AppState>, headers: HeaderMap, Json(req): Json<PasswordReq>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; if req.new_password.len()<6{return err(StatusCode::BAD_REQUEST,"password too short").into_response()} let row=sqlx::query("SELECT password_hash FROM users WHERE id=$1").bind(u.id).fetch_one(&s.db).await.unwrap(); let hash:String=row.get("password_hash"); let Some(current)=req.current_password else{return err(StatusCode::BAD_REQUEST,"current password required").into_response()}; if Argon2::default().verify_password(current.as_bytes(),&PasswordHash::new(&hash).unwrap()).is_err(){return err(StatusCode::FORBIDDEN,"current password mismatch").into_response()} let new_hash=match hash_password(&req.new_password){Ok(h)=>h,Err(_)=>return err(StatusCode::INTERNAL_SERVER_ERROR,"hash failed").into_response()}; let _=sqlx::query("UPDATE users SET password_hash=$1 WHERE id=$2").bind(new_hash).bind(u.id).execute(&s.db).await; Json(json!({"ok":true})).into_response() }
async fn list_users(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { if require_admin(&headers,&s.db).await.is_err(){return err(StatusCode::FORBIDDEN,"admin required").into_response()} let rows=sqlx::query("SELECT id,username,is_admin,visible_roots,created_at FROM users ORDER BY created_at ASC").fetch_all(&s.db).await.unwrap_or_default(); Json(json!({"users":rows.into_iter().map(public_user).collect::<Vec<_>>() })).into_response() }
async fn create_user(State(s): State<AppState>, headers: HeaderMap, Json(req): Json<UserReq>) -> impl IntoResponse { if require_admin(&headers,&s.db).await.is_err(){return err(StatusCode::FORBIDDEN,"admin required").into_response()} let username=req.username.unwrap_or_default().trim().to_string(); let password=req.password.unwrap_or_default(); if username.is_empty(){return err(StatusCode::BAD_REQUEST,"username required").into_response()} if password.len()<6{return err(StatusCode::BAD_REQUEST,"password too short").into_response()} let hash=match hash_password(&password){Ok(h)=>h,Err(_)=>return err(StatusCode::INTERNAL_SERVER_ERROR,"hash failed").into_response()}; let roots=req.visible_roots.unwrap_or(json!([])); let row=sqlx::query("INSERT INTO users(username,password_hash,is_admin,visible_roots) VALUES($1,$2,$3,$4) RETURNING id,username,is_admin,visible_roots,created_at").bind(username).bind(hash).bind(req.is_admin.unwrap_or(false)).bind(roots).fetch_one(&s.db).await; match row{Ok(r)=>Json(json!({"user":public_user(r)})).into_response(),Err(_)=>err(StatusCode::CONFLICT,"user exists").into_response()} }
async fn update_user(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>, Json(req): Json<UserReq>) -> impl IntoResponse { let admin=match require_admin(&headers,&s.db).await{Ok(u)=>u,Err(_)=>return err(StatusCode::FORBIDDEN,"admin required").into_response()}; if let Some(password)=req.password.filter(|p|!p.is_empty()){ if password.len()<6{return err(StatusCode::BAD_REQUEST,"password too short").into_response()} let hash=match hash_password(&password){Ok(h)=>h,Err(_)=>return err(StatusCode::INTERNAL_SERVER_ERROR,"hash failed").into_response()}; let _=sqlx::query("UPDATE users SET password_hash=$1 WHERE id=$2").bind(hash).bind(id).execute(&s.db).await; }
    if id==admin.id && req.is_admin==Some(false){return err(StatusCode::BAD_REQUEST,"cannot remove own admin").into_response()}
    let row=sqlx::query("UPDATE users SET username=COALESCE($1,username),is_admin=COALESCE($2,is_admin),visible_roots=COALESCE($3,visible_roots) WHERE id=$4 RETURNING id,username,is_admin,visible_roots,created_at").bind(req.username.filter(|v|!v.trim().is_empty()).map(|v|v.trim().to_string())).bind(req.is_admin).bind(req.visible_roots).bind(id).fetch_optional(&s.db).await.unwrap(); match row{Some(r)=>Json(json!({"user":public_user(r)})).into_response(),None=>err(StatusCode::NOT_FOUND,"user not found").into_response()} }
async fn delete_user(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> impl IntoResponse { let admin=match require_admin(&headers,&s.db).await{Ok(u)=>u,Err(_)=>return err(StatusCode::FORBIDDEN,"admin required").into_response()}; if id==admin.id{return err(StatusCode::BAD_REQUEST,"cannot delete yourself").into_response()} let n=sqlx::query("DELETE FROM users WHERE id=$1").bind(id).execute(&s.db).await.unwrap().rows_affected(); if n==0{err(StatusCode::NOT_FOUND,"user not found").into_response()}else{Json(json!({"ok":true})).into_response()} }

async fn source_items(State(s): State<AppState>, headers: HeaderMap, Query(q): Query<SectionQ>) -> impl IntoResponse { if auth(&headers,&s.db).await.is_err(){return err(StatusCode::UNAUTHORIZED,"unauthorized").into_response()} let sec=q.section.unwrap_or("hall".into()); let rows=sqlx::query("SELECT si.*, NOT EXISTS(SELECT 1 FROM maintenance_jobs j WHERE j.source_item_id=si.id AND j.status NOT IN ('released','completed','failed')) available FROM source_items si WHERE si.source=$1 ORDER BY si.created_at DESC").bind(sec).fetch_all(&s.db).await.unwrap_or_default(); Json(json!({"items": rows.into_iter().map(item_json).collect::<Vec<_>>() })).into_response() }
fn item_json(r: sqlx::postgres::PgRow)->Value{ json!({"id":r.get::<Uuid,_>("id"),"source":r.get::<String,_>("source"),"external_id":r.try_get::<String,_>("external_id").ok(),"title":r.get::<String,_>("title"),"media_type":r.get::<String,_>("media_type"),"poster_url":r.try_get::<String,_>("poster_url").ok(),"metadata":r.get::<Value,_>("metadata"),"available":r.try_get::<bool,_>("available").unwrap_or(true)}) }
async fn hall_webhook(State(s): State<AppState>, headers: HeaderMap, Query(q): Query<HashMap<String,String>>, Json(req): Json<HallWebhook>) -> impl IntoResponse { let ok=headers.get("X-Webhook-Token").and_then(|v|v.to_str().ok())==Some(&s.webhook_token)||q.get("token")==Some(&s.webhook_token)||headers.get(header::AUTHORIZATION).and_then(|v|v.to_str().ok()).and_then(|v|v.strip_prefix("Bearer "))==Some(&s.webhook_token); if !ok{return err(StatusCode::UNAUTHORIZED,"bad token").into_response()} let id=sqlx::query_scalar::<_,Uuid>("INSERT INTO source_items(source,external_id,title,media_type,poster_url,metadata) VALUES('hall',$1,$2,$3,$4,$5) ON CONFLICT(source,external_id) DO UPDATE SET title=EXCLUDED.title,updated_at=now() RETURNING id").bind(req.external_id.unwrap_or_else(||Uuid::new_v4().to_string())).bind(req.title).bind(req.media_type.unwrap_or("movie".into())).bind(req.poster_url).bind(req.metadata.unwrap_or(json!({}))).fetch_one(&s.db).await.unwrap(); Json(json!({"id":id})) .into_response() }
async fn claim(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; match sqlx::query_scalar::<_,Uuid>("INSERT INTO maintenance_jobs(source_item_id,user_id,status) VALUES($1,$2,'claimed') RETURNING id").bind(id).bind(u.id).fetch_one(&s.db).await { Ok(j)=>Json(json!({"job_id":j,"status":"claimed"})).into_response(), Err(_)=>err(StatusCode::CONFLICT,"active job exists").into_response() } }
async fn my_claims(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let rows=sqlx::query("SELECT j.*, si.title, si.source, si.poster_url FROM maintenance_jobs j JOIN source_items si ON si.id=j.source_item_id WHERE j.user_id=$1 AND j.status<>'released' ORDER BY j.created_at DESC").bind(u.id).fetch_all(&s.db).await.unwrap_or_default(); Json(json!({"jobs":rows.into_iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"source_item_id":r.get::<Uuid,_>("source_item_id"),"status":r.get::<String,_>("status"),"title":r.get::<String,_>("title"),"source":r.get::<String,_>("source"),"poster_url":r.try_get::<String,_>("poster_url").ok(),"selected_path":r.try_get::<String,_>("selected_path").ok(),"selected_type":r.try_get::<String,_>("selected_type").ok(),"category":r.try_get::<String,_>("category").ok(),"scrape":r.get::<bool,_>("scrape"),"created_at":r.get::<DateTime<Utc>,_>("created_at"),"submitted_at":r.try_get::<DateTime<Utc>,_>("submitted_at").ok(),"archived_at":r.try_get::<DateTime<Utc>,_>("archived_at").ok(),"compare":r.try_get::<Value,_>("compare_json").ok(),"response":r.try_get::<Value,_>("response_json").ok(),"error":r.try_get::<String,_>("error_text").ok(),"error_text":r.try_get::<String,_>("error_text").ok(),"external_task_id":r.try_get::<String,_>("external_task_id").ok()})).collect::<Vec<_>>() })).into_response() }
async fn release(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let n=sqlx::query("UPDATE maintenance_jobs SET status='released',released_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('claimed','selection_ready','failed')").bind(id).bind(u.id).execute(&s.db).await.unwrap().rows_affected(); if n==0{err(StatusCode::CONFLICT,"cannot release").into_response()}else{Json(json!({"ok":true})).into_response()} }
fn num_at(v:&Value, keys:&[&str])->Option<f64>{ for key in keys{ if let Some(n)=v.get(*key).and_then(|x|x.as_f64()){return Some(n)} if let Some(n)=v.pointer(&format!("/{}", key.replace('.', "/"))).and_then(|x|x.as_f64()){return Some(n)} } None }
fn bool_at(v:&Value, keys:&[&str])->Option<bool>{ for key in keys{ if let Some(b)=v.get(*key).and_then(|x|x.as_bool()){return Some(b)} if let Some(b)=v.pointer(&format!("/{}", key.replace('.', "/"))).and_then(|x|x.as_bool()){return Some(b)} } None }
fn compare_from_metadata(title:&str, metadata:&Value, found:bool)->Value{ let progress=num_at(metadata,&["compare_progress","progress","PercentComplete","CompletionPercentage","UserData.PlayedPercentage"]).unwrap_or(if found{100.0}else{0.0}); let missing=num_at(metadata,&["missing_count","missingCount","MissingCount","MissingEpisodes","missing_episodes"]).unwrap_or(0.0); let complete_flag=bool_at(metadata,&["complete","isComplete","IsComplete"]).unwrap_or(false); let complete=(progress>=100.0 || complete_flag) && missing<=0.0; json!({"checked_at":Utc::now(),"title":title,"found":found,"progress":progress,"missing_count":missing,"complete":complete}) }
async fn compare_job(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let row=sqlx::query("SELECT j.id,si.title FROM maintenance_jobs j JOIN source_items si ON si.id=j.source_item_id WHERE j.id=$1 AND j.user_id=$2").bind(id).bind(u.id).fetch_optional(&s.db).await.unwrap(); let Some(r)=row else{return err(StatusCode::NOT_FOUND,"job not found").into_response()}; let title:String=r.get("title"); let emby=sqlx::query("SELECT metadata FROM source_items WHERE source='emby' AND title=$1 ORDER BY updated_at DESC LIMIT 1").bind(&title).fetch_optional(&s.db).await.unwrap(); let (found,metadata) = match emby { Some(row)=>(true,row.get::<Value,_>("metadata")), None=>(false,json!({})) }; let result=compare_from_metadata(&title,&metadata,found); let _=sqlx::query("UPDATE maintenance_jobs SET compare_json=$1,updated_at=now() WHERE id=$2 AND user_id=$3").bind(&result).bind(id).bind(u.id).execute(&s.db).await; Json(json!({"compare":result})).into_response() }
async fn archive_job(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let row=sqlx::query("SELECT compare_json FROM maintenance_jobs WHERE id=$1 AND user_id=$2").bind(id).bind(u.id).fetch_optional(&s.db).await.unwrap(); let Some(r)=row else{return err(StatusCode::NOT_FOUND,"job not found").into_response()}; let compare:Option<Value>=r.try_get("compare_json").ok(); let complete=compare.as_ref().and_then(|v|v.get("complete")).and_then(|v|v.as_bool()).unwrap_or(false); if !complete{return err(StatusCode::CONFLICT,"compare incomplete").into_response()} let n=sqlx::query("UPDATE maintenance_jobs SET status='completed',archived_at=now(),updated_at=now() WHERE id=$1 AND user_id=$2 AND status<>'released'").bind(id).bind(u.id).execute(&s.db).await.unwrap().rows_affected(); if n==0{err(StatusCode::CONFLICT,"cannot archive").into_response()}else{Json(json!({"ok":true,"status":"completed"})).into_response()} }
fn norm(p:&str)->Option<String>{ let mut out=Vec::new(); for seg in p.split('/') { if seg.is_empty()||seg=="."{continue} if seg==".."{return None} out.push(seg) } Some(format!("/{}",out.join("/"))) }
async fn settings(db:&PgPool)->Value{ let r=sqlx::query("SELECT * FROM app_settings WHERE id=true").fetch_one(db).await.unwrap(); json!({"emby_url":r.try_get::<String,_>("emby_url").ok(),"emby_api_key":red(r.try_get::<String,_>("emby_api_key").ok()),"tmdb_api_key":red(r.try_get::<String,_>("tmdb_api_key").ok()),"openlist_url":r.try_get::<String,_>("openlist_url").ok(),"openlist_token":red(r.try_get::<String,_>("openlist_token").ok()),"visible_roots":r.get::<Value,_>("visible_roots"),"categories":r.get::<Value,_>("categories"),"manager_url":r.try_get::<String,_>("manager_url").ok(),"manager_token":red(r.try_get::<String,_>("manager_token").ok()),"rclone_source_prefix":r.get::<String,_>("rclone_source_prefix"),"destination_mappings":r.get::<Value,_>("destination_mappings"),"transfer_mode":r.get::<String,_>("transfer_mode")}) }
fn red(v:Option<String>)->Option<String>{v.map(|s|if s.is_empty(){s}else{"***redacted***".into()})}
fn roots(cfg:&Value)->Vec<(String,String)>{ cfg.get("visible_roots").and_then(|v|v.as_array()).map(|a|a.iter().filter_map(|x|Some((x.get("id")?.as_str()?.to_string(), norm(x.get("path")?.as_str()?)?))).collect()).unwrap_or_default() }
fn effective_roots(u:&User,cfg:&Value)->Vec<(String,String)>{ if u.visible_roots.as_array().map(|a|!a.is_empty()).unwrap_or(false){ roots(&json!({"visible_roots":u.visible_roots.clone()})) } else { roots(cfg) } }
async fn openlist_browse(State(s): State<AppState>, headers: HeaderMap, Query(q): Query<BrowseQ>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let path=match norm(q.path.as_deref().unwrap_or("/")){Some(p)=>p,None=>return err(StatusCode::BAD_REQUEST,"bad path").into_response()}; let cfg=settings(&s.db).await; if !effective_roots(&u,&cfg).iter().any(|(_,r)| path==*r || path.starts_with(&format!("{r}/")) || r=="/") {return err(StatusCode::FORBIDDEN,"outside visible roots").into_response()} if let Some(url)=cfg.get("openlist_url").and_then(|v|v.as_str()){ let mut req=s.http.post(format!("{}/api/fs/list",url.trim_end_matches('/'))).json(&json!({"path":path,"password":"","refresh":false})); if let Some(tok)=sqlx::query_scalar::<_,Option<String>>("SELECT openlist_token FROM app_settings WHERE id=true").fetch_one(&s.db).await.unwrap_or(None){req=req.header(header::AUTHORIZATION,tok)} if let Ok(resp)=req.send().await { if let Ok(v)=resp.json::<Value>().await { return Json(v).into_response(); } } } Json(json!({"code":200,"data":{"content":[{"name":"Demo Movie","path":"/demo/movie","type":"dir"},{"name":"sample.mkv","path":"/demo/sample.mkv","type":"file"}]}})).into_response() }
async fn select_item(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>, Json(req): Json<SelectReq>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let path=match norm(&req.path){Some(p)=>p,None=>return err(StatusCode::BAD_REQUEST,"bad path").into_response()}; let cfg=settings(&s.db).await; let root=effective_roots(&u,&cfg).into_iter().find(|(_,r)| path==*r||path.starts_with(&format!("{r}/"))||r=="/"); let Some((root_id,_))=root else{return err(StatusCode::FORBIDDEN,"outside visible roots").into_response()}; let token=Uuid::new_v4().to_string(); let _=sqlx::query("INSERT INTO selection_tokens(token_hash,user_id,job_id,visible_root_id,path,item_type,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)").bind(token_hash(&token)).bind(u.id).bind(id).bind(root_id).bind(&path).bind(&req.item_type).bind(Utc::now()+Duration::minutes(30)).execute(&s.db).await; let n=sqlx::query("UPDATE maintenance_jobs SET status='selection_ready',selected_path=$1,selected_type=$2,category=$3,scrape=$4,updated_at=now() WHERE id=$5 AND user_id=$6 AND status IN ('claimed','selection_ready','failed')").bind(path).bind(req.item_type).bind(req.category).bind(req.scrape.unwrap_or(false)).bind(id).bind(u.id).execute(&s.db).await.unwrap().rows_affected(); if n==0{err(StatusCode::CONFLICT,"job not selectable").into_response()}else{Json(json!({"selection_token":token,"status":"selection_ready"})).into_response()} }
async fn categories(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { if auth(&headers,&s.db).await.is_err(){return err(StatusCode::UNAUTHORIZED,"unauthorized").into_response()} Json(json!({"categories":settings(&s.db).await["categories"].clone()})).into_response() }
async fn submit(State(s): State<AppState>, headers: HeaderMap, Path(id): Path<Uuid>, Json(req): Json<SubmitReq>) -> impl IntoResponse { let u=match auth(&headers,&s.db).await{Ok(u)=>u,Err(c)=>return err(c,"unauthorized").into_response()}; let row=sqlx::query("SELECT j.*, si.title FROM maintenance_jobs j JOIN source_items si ON si.id=j.source_item_id WHERE j.id=$1 AND j.user_id=$2").bind(id).bind(u.id).fetch_optional(&s.db).await.unwrap(); let Some(r)=row else{return err(StatusCode::NOT_FOUND,"job not found").into_response()}; let status:String=r.get("status"); if status=="submitted"||status=="submitting" {return Json(json!({"status":status,"external_task_id":r.try_get::<String,_>("external_task_id").ok(),"response":r.try_get::<Value,_>("response_json").ok(),"error":r.try_get::<String,_>("error_text").ok()})).into_response()} let cfg=settings(&s.db).await; let category_ok=cfg["categories"].as_array().map(|a|a.iter().any(|c|c.as_str()==Some(&req.category_id)||c.get("id").and_then(|v|v.as_str())==Some(&req.category_id))).unwrap_or(false); if !category_ok{return err(StatusCode::BAD_REQUEST,"invalid category").into_response()} let path:Option<String>=r.try_get("selected_path").ok(); let selected_type:Option<String>=r.try_get("selected_type").ok(); let Some(path)=path else{return err(StatusCode::BAD_REQUEST,"selection required").into_response()}; let Some(selected_type)=selected_type else{return err(StatusCode::BAD_REQUEST,"selection required").into_response()}; let token_row=sqlx::query("SELECT path,item_type FROM selection_tokens WHERE token_hash=$1 AND user_id=$2 AND job_id=$3 AND expires_at>now() AND used_at IS NULL").bind(token_hash(&req.selection_token)).bind(u.id).bind(id).fetch_optional(&s.db).await.unwrap(); let Some(t)=token_row else{return err(StatusCode::FORBIDDEN,"invalid selection token").into_response()}; if t.get::<String,_>("path")!=path || t.get::<String,_>("item_type")!=selected_type{return err(StatusCode::FORBIDDEN,"selection token mismatch").into_response()} let changed=sqlx::query("UPDATE maintenance_jobs SET status='submitting',category=$1,scrape=$2,updated_at=now() WHERE id=$3 AND user_id=$4 AND status IN ('selection_ready','failed')").bind(&req.category_id).bind(req.scrape_enabled).bind(id).bind(u.id).execute(&s.db).await.unwrap().rows_affected(); if changed==0{ let r=sqlx::query("SELECT status,response_json,external_task_id,error_text FROM maintenance_jobs WHERE id=$1 AND user_id=$2").bind(id).bind(u.id).fetch_one(&s.db).await.unwrap(); return Json(json!({"status":r.get::<String,_>("status"),"external_task_id":r.try_get::<String,_>("external_task_id").ok(),"response":r.try_get::<Value,_>("response_json").ok(),"error":r.try_get::<String,_>("error_text").ok()})).into_response() } let _=sqlx::query("UPDATE selection_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL").bind(token_hash(&req.selection_token)).execute(&s.db).await; let title:String=r.get("title"); let dest=cfg["destination_mappings"].get(&req.category_id).and_then(|v|v.as_str()).unwrap_or(""); let source=format!("{}{}",cfg["rclone_source_prefix"].as_str().unwrap_or(""),path); let payload=json!({"name":format!("{} {}",title,id),"source":source,"source_type":"remote","dest":format!("{}/{}",dest.trim_end_matches('/'),title),"dest_type":"remote","transfer_mode":cfg["transfer_mode"],"openlist_enabled":cfg["openlist_url"].as_str().is_some(),"openlist_url":cfg["openlist_url"],"openlist_refresh_dir":path,"category":req.category_id,"scrape":req.scrape_enabled}); if cfg.get("manager_url").and_then(|v|v.as_str()).is_none(){ let _=sqlx::query("UPDATE maintenance_jobs SET status='failed',request_json=$1,error_text='config_missing',updated_at=now() WHERE id=$2").bind(&payload).bind(id).execute(&s.db).await; return Json(json!({"status":"failed","error":"config_missing"})).into_response() } let url=cfg["manager_url"].as_str().unwrap().trim_end_matches('/').to_string()+"/api/tasks/quick"; let token=sqlx::query_scalar::<_,Option<String>>("SELECT manager_token FROM app_settings WHERE id=true").fetch_one(&s.db).await.unwrap_or(None); let req=s.http.post(if let Some(t)=token{format!("{url}?token={t}")}else{url}).json(&payload); let result=req.send().await; match result { Ok(resp)=>{ let v=resp.json::<Value>().await.unwrap_or(json!({})); let ext=v.get("id").or_else(||v.pointer("/data/id")).and_then(|x|x.as_str()).map(str::to_string); let _=sqlx::query("UPDATE maintenance_jobs SET status='submitted',request_json=$1,response_json=$2,external_task_id=$3,submitted_at=now(),updated_at=now() WHERE id=$4").bind(&payload).bind(&v).bind(ext.clone()).bind(id).execute(&s.db).await; Json(json!({"status":"submitted","external_task_id":ext,"response":v})).into_response()}, Err(e)=>{ let _=sqlx::query("UPDATE maintenance_jobs SET status='failed',request_json=$1,error_text=$2,updated_at=now() WHERE id=$3").bind(&payload).bind(e.to_string()).bind(id).execute(&s.db).await; err(StatusCode::BAD_GATEWAY,"manager submit failed").into_response()} } }
async fn get_settings(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse { match auth(&headers,&s.db).await { Ok(u) if u.is_admin=>Json(settings(&s.db).await).into_response(), _=>err(StatusCode::FORBIDDEN,"admin required").into_response() } }
async fn post_settings(State(s): State<AppState>, headers: HeaderMap, Json(req): Json<SettingsReq>) -> impl IntoResponse { match auth(&headers,&s.db).await { Ok(u) if u.is_admin=>{}, _=>return err(StatusCode::FORBIDDEN,"admin required").into_response() } let _=sqlx::query("UPDATE app_settings SET emby_url=COALESCE($1,emby_url),emby_api_key=COALESCE($2,emby_api_key),tmdb_api_key=COALESCE($3,tmdb_api_key),openlist_url=COALESCE($4,openlist_url),openlist_token=COALESCE($5,openlist_token),visible_roots=COALESCE($6,visible_roots),categories=COALESCE($7,categories),manager_url=COALESCE($8,manager_url),manager_token=COALESCE($9,manager_token),rclone_source_prefix=COALESCE($10,rclone_source_prefix),destination_mappings=COALESCE($11,destination_mappings),transfer_mode=COALESCE($12,transfer_mode) WHERE id=true").bind(req.emby_url).bind(req.emby_api_key).bind(req.tmdb_api_key).bind(req.openlist_url).bind(req.openlist_token).bind(req.visible_roots).bind(req.categories).bind(req.manager_url).bind(req.manager_token).bind(req.rclone_source_prefix).bind(req.destination_mappings).bind(req.transfer_mode).execute(&s.db).await; Json(settings(&s.db).await).into_response() }
async fn emby_refresh(State(s): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    if auth(&headers, &s.db).await.is_err() {
        return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response();
    }
    let cfg = sqlx::query("SELECT emby_url, emby_api_key FROM app_settings WHERE id=true")
        .fetch_one(&s.db)
        .await
        .unwrap();
    if let (Ok(url), Ok(key)) = (
        cfg.try_get::<String, _>("emby_url"),
        cfg.try_get::<String, _>("emby_api_key"),
    ) {
        if !url.is_empty() && !key.is_empty() {
            let endpoint = format!(
                "{}/Items?Recursive=true&IncludeItemTypes=Movie,Series&api_key={}",
                url.trim_end_matches('/'),
                key
            );
            if let Ok(resp) = s.http.get(endpoint).send().await {
                if let Ok(body) = resp.json::<Value>().await {
                    let items = body
                        .get("Items")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                    let mut count = 0usize;
                    for item in items {
                        let Some(id) = item.get("Id").and_then(|v| v.as_str()) else {
                            continue;
                        };
                        let title = item
                            .get("Name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("Untitled");
                        let kind = item.get("Type").and_then(|v| v.as_str()).unwrap_or("movie");
                        let poster = Some(format!(
                            "{}/Items/{}/Images/Primary?api_key={}",
                            url.trim_end_matches('/'),
                            id,
                            key
                        ));
                        let _ = sqlx::query("INSERT INTO source_items(source,external_id,title,media_type,poster_url,metadata) VALUES('emby',$1,$2,$3,$4,$5) ON CONFLICT(source,external_id) DO UPDATE SET title=EXCLUDED.title,media_type=EXCLUDED.media_type,poster_url=EXCLUDED.poster_url,metadata=EXCLUDED.metadata,updated_at=now()")
                            .bind(id)
                            .bind(title)
                            .bind(kind.to_lowercase())
                            .bind(poster)
                            .bind(item.clone())
                            .execute(&s.db)
                            .await;
                        count += 1;
                    }
                    return Json(json!({"ok":true,"demo":false,"count":count})).into_response();
                }
            }
        }
    }
    let demos = [
        ("emby-demo-1", "Demo Emby Movie"),
        ("emby-demo-2", "Demo Emby Series"),
    ];
    for (eid, title) in demos {
        let _=sqlx::query("INSERT INTO source_items(source,external_id,title,media_type,metadata) VALUES('emby',$1,$2,'movie',$3) ON CONFLICT(source,external_id) DO UPDATE SET title=EXCLUDED.title,updated_at=now()")
            .bind(eid)
            .bind(title)
            .bind(json!({"demo":true}))
            .execute(&s.db)
            .await;
    }
    Json(json!({"ok":true,"demo":true})).into_response()
}
