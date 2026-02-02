# PoshPearl MVP

## Setup

```powershell
cd C:\Users\HomePC\Desktop\Poshpearl
python -m venv venv
venv\Scripts\activate
py -m pip install -r requirements.txt
```

If you don't have a requirements file yet, install manually:

```powershell
py -m pip install django django-ninja pillow
```

## Database + Migrations (fresh dev DB)

> Note: Custom user model requires a fresh DB in dev.

```powershell
Rename-Item db.sqlite3 db.sqlite3.backup-$(Get-Date -Format "yyyyMMdd-HHmmss")
py manage.py makemigrations poshapp
py manage.py migrate
```

## Seed Product Data

```powershell
py manage.py load_products
```

## Admin User

```powershell
py manage.py createsuperuser
```

## Run Server

```powershell
py manage.py runserver
```

## Key URLs

- Home: http://127.0.0.1:8000/
- Shop: http://127.0.0.1:8000/shop/
- Cart: http://127.0.0.1:8000/cart/
- Checkout: http://127.0.0.1:8000/checkout/
- Admin: http://127.0.0.1:8000/admin/

## Cart API (Django Ninja)

- GET `/api/cart`
- POST `/api/cart/items` `{ "product_id": 1, "quantity": 1 }`
- PATCH `/api/cart/items/{item_id}` `{ "quantity": 2 }`
- DELETE `/api/cart/items/{item_id}`
- DELETE `/api/cart`
