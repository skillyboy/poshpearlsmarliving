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

## Paystack (MVP payments)

Set these environment variables before running the server:

```
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_CALLBACK_URL=
```

`PAYSTACK_CALLBACK_URL` is optional. If empty, the app will build the callback URL automatically.

You can place the values above in a `.env` file in the project root, and the app will load them on startup.

## Payment (Paystack)

Set the following environment variables before running the server:

```
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_BASE_URL=https://api.paystack.co
```

## Key URLs

- Home: http://127.0.0.1:8000/
- Shop: http://127.0.0.1:8000/shop/
- Cart: http://127.0.0.1:8000/cart/
- Checkout: http://127.0.0.1:8000/checkout/
- Admin: http://127.0.0.1:8000/admin/
 - Paystack Callback: http://127.0.0.1:8000/payments/callback/
 - Paystack Webhook: http://127.0.0.1:8000/payments/webhook/

## Cart API (Django Ninja)

- GET `/api/cart`
- POST `/api/cart/items` `{ "product_id": 1, "quantity": 1 }`
- PATCH `/api/cart/items/{item_id}` `{ "quantity": 2 }`
- DELETE `/api/cart/items/{item_id}`
- DELETE `/api/cart`
