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

## Database Migration

### SQLite to PostgreSQL

1. **Install PostgreSQL** on your production server

2. **Create database and user:**
```sql
CREATE DATABASE poshpearl;
CREATE USER poshpearl_user WITH PASSWORD 'your_password';
ALTER ROLE poshpearl_user SET client_encoding TO 'utf8';
ALTER ROLE poshpearl_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE poshpearl_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE poshpearl TO poshpearl_user;
```

3. **Update `.env` with PostgreSQL credentials:**
```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=poshpearl
DB_USER=poshpearl_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

4. **Update `settings.py`** to use environment database config:
```python
DATABASES = {
    'default': {
        'ENGINE': config('DB_ENGINE', default='django.db.backends.sqlite3'),
        'NAME': config('DB_NAME', default=BASE_DIR / 'db.sqlite3'),
        'USER': config('DB_USER', default=''),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default=''),
        'PORT': config('DB_PORT', default=''),
    }
}
```

5. **Run migrations:**
```bash
python manage.py migrate
```

6. **Create superuser:**
```bash
python manage.py createsuperuser
```

## Static Files

WhiteNoise is already configured in `settings.py`. Collect static files:

```bash
python manage.py collectstatic --noinput
```

This will gather all static files into the `staticfiles/` directory for WhiteNoise to serve.

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

### Platform-Specific Guides

#### Railway

1. Connect your GitHub repository
2. Add environment variables in Settings → Variables
3. Railway will auto-detect Django and deploy
4. Run migrations via Railway CLI or dashboard console

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
- Check database credentials in `.env`
- Ensure database and user exist

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
