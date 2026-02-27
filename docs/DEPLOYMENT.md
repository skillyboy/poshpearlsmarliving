# PoshPearl Production Deployment Guide

## Prerequisites

- Python 3.10+
- PostgreSQL 14+ (recommended for production)
- A hosting service (e.g., Railway, Heroku, DigitalOcean, AWS)
- Domain name (optional but recommended)

## Environment Setup

### 1. Create Environment File

Copy `.env.example` to `.env` and update with production values:

```bash
cp .env.example .env
```

### 2. Generate Secret Key

```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Add the generated key to `.env`:
```
SECRET_KEY=your-generated-secret-key-here
```

### 3. Required Environment Variables

**Django Settings:**
- `SECRET_KEY` - Django secret key (required, generate new one)
- `DEBUG` - Set to `False` in production
- `ALLOWED_HOSTS` - Comma-separated domain names
- `CSRF_TRUSTED_ORIGINS` - Comma-separated HTTPS origins
- `RAILWAY_PUBLIC_DOMAIN` - Auto-provided by Railway; settings will auto-add it to hosts/CSRF
- `SECURE_SSL_REDIRECT` - `True` in production
- `SESSION_COOKIE_SECURE` - `True` in production
- `CSRF_COOKIE_SECURE` - `True` in production
- `SECURE_HSTS_SECONDS` - e.g., `31536000`

**Paystack:**
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Paystack public key
- `PAYSTACK_CALLBACK_URL` - Full callback URL (e.g., https://yourdomain.com/payments/callback/)

**Email:**
- `EMAIL_HOST` - SMTP server (e.g., smtp.gmail.com)
- `EMAIL_PORT` - SMTP port (usually 587)
- `EMAIL_HOST_USER` - SMTP username/email
- `EMAIL_HOST_PASSWORD` - SMTP password/app password
- `DEFAULT_FROM_EMAIL` - From email address

**Site:**
- `SITE_URL` - Full site URL (e.g., https://yourdomain.com)

**Database:**
- `DATABASE_URL` - Railway Postgres URL (or any Postgres connection string)

**Media (S3):**
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_REGION_NAME`
- Optional: `AWS_S3_CUSTOM_DOMAIN` or `AWS_S3_ENDPOINT_URL`

**Observability (optional):**
- `SENTRY_DSN`
- `SENTRY_TRACES_SAMPLE_RATE`

## Database Migration

### SQLite to PostgreSQL

1. **Provision PostgreSQL** (Railway plugin or your own server)

2. **Set `DATABASE_URL`** in your environment:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
```
Do not use placeholder hosts such as `host` or `localhost` in Railway production.

3. **Run migrations:**
```bash
python manage.py migrate
```

4. **Create superuser:**
```bash
python manage.py createsuperuser
```

## Static Files

WhiteNoise is already configured in `settings.py`. Collect static files:

```bash
python manage.py collectstatic --noinput
```

This will gather all static files into the `staticfiles/` directory for WhiteNoise to serve.

## Media Files (S3)

If you are using S3 for media uploads, set the AWS environment variables and ensure
`AWS_STORAGE_BUCKET_NAME` is present. Media URLs will point to your bucket or custom domain.

## Media Files (Railway Volume)

If you prefer a Railway volume:
- Create a volume and mount it at `/app/media`.
- Django will serve `/media/` from that volume.
- This is fine for MVPs; for higher traffic, use S3 or a CDN.

## Deployment Steps

### General Steps (Any Platform)

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Set environment variables** (via platform dashboard or .env)

3. **Run migrations:**
```bash
python manage.py migrate
```

4. **Collect static files:**
```bash
python manage.py collectstatic --noinput
```

5. **Create superuser:**
```bash
python manage.py createsuperuser
```

6. **Start application:**
```bash
gunicorn project.wsgi:application --bind 0.0.0.0:$PORT
```

If you use this repository's `Procfile`, steps 3 and 4 are executed automatically
at startup.

### Platform-Specific Guides

#### Railway

1. Connect your GitHub repository
2. Add environment variables in `Settings -> Variables` (at minimum: `SECRET_KEY`, `DEBUG=False`, `DATABASE_URL`, `SITE_URL`, Paystack keys).
3. Wire `DATABASE_URL` to your Railway Postgres reference:
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`
4. Validate the runtime value in Railway Shell before redeploy:
   `python -c "import os; print(os.getenv('DATABASE_URL',''))"`
   Ensure it contains a real host and not `@host:` / `@localhost:`.
5. Leave start command empty to use `Procfile`, or set it to:
   `python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn project.wsgi:application --bind 0.0.0.0:$PORT`
6. Deploy. Railway will provide `RAILWAY_PUBLIC_DOMAIN`, which is auto-trusted by settings.
7. Create admin user once via Railway Shell:
   `python manage.py createsuperuser`
8. Run smoke checks:
   - Open `/` and `/admin/`
   - Confirm deploy logs contain no `OperationalError` entries

#### Heroku

1. Create `Procfile`:
```
web: gunicorn project.wsgi --log-file -
release: python manage.py migrate
```

2. Create `runtime.txt`:
```
python-3.11.0
```

3. Deploy:
```bash
heroku create your-app-name
git push heroku main
heroku run python manage.py createsuperuser
```

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Set environment variables in Settings
3. Configure build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
4. Configure run command: `gunicorn project.wsgi:application`

## Security Checklist

- [ ] `DEBUG=False` in production
- [ ] Strong `SECRET_KEY` generated and set
- [ ] `ALLOWED_HOSTS` configured with actual domain
- [ ] HTTPS enabled (use platform SSL or Let's Encrypt)
- [ ] Database credentials secured
- [ ] Paystack live keys (not test keys)
- [ ] Email credentials secured
- [ ] `CSRF_TRUSTED_ORIGINS` configured
- [ ] Secure cookies enabled
- [ ] `.env` file in `.gitignore`

## Post-Deployment

1. **Test payment flow** with Paystack test mode first
2. **Test email delivery** (welcome emails, password reset)
3. **Verify static files** load correctly
4. **Test auto-user creation** on checkout
5. **Switch to Paystack live mode** when ready

## Common Issues

**Static files not loading:**
- Ensure `collectstatic` ran successfully
- Check `STATIC_ROOT` and `STATICFILES_STORAGE` settings
- Verify WhiteNoise middleware is in `MIDDLEWARE`

**Database connection errors:**
- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env` or platform variables
- Ensure database exists and credentials are valid
- In Railway, ensure `DATABASE_URL` is set from `${{Postgres.DATABASE_URL}}` (not a placeholder URL)

**Email not sending:**
- Check SMTP credentials
- For Gmail, use an App Password (not regular password)
- Verify `EMAIL_USE_TLS=true` for port 587

## Monitoring

- Monitor error logs via platform dashboard
- Set up Sentry for error tracking (optional)
- Monitor Paystack webhook deliveries
- Review failed payments regularly

## Backup

- Regular database backups
- Backup media files (product images, etc.)
- Keep `.env.example` updated with new variables
