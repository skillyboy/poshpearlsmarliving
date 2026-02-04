import hashlib
import hmac
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings


class PaystackError(RuntimeError):
    pass


def _headers():
    secret = settings.PAYSTACK_SECRET_KEY
    if not secret:
        raise PaystackError("PAYSTACK_SECRET_KEY is not configured.")
    return {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
    }


def _request(method, path, payload=None):
    base = settings.PAYSTACK_BASE_URL.rstrip("/")
    url = f"{base}{path}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    request = Request(url, data=data, headers=_headers(), method=method)
    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
            return json.loads(body)
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)
        raise PaystackError(detail) from exc
    except URLError as exc:
        raise PaystackError(str(exc)) from exc


def initialize_paystack_transaction(order, email, amount, currency, callback_url, metadata=None):
    amount_kobo = int(amount) * 100
    reference = order.payment_reference or f"POSH-{order.id}"
    payload = {
        "email": email,
        "amount": amount_kobo,
        "currency": currency,
        "reference": reference,
        "callback_url": callback_url,
        "metadata": metadata or {"order_id": order.id},
    }
    response = _request("POST", "/transaction/initialize", payload=payload)
    if not response.get("status"):
        raise PaystackError(response.get("message") or "Payment initialization failed.")
    data = response.get("data") or {}
    return {
        "authorization_url": data.get("authorization_url"),
        "reference": data.get("reference") or reference,
        "access_code": data.get("access_code"),
    }


def verify_paystack_transaction(reference):
    response = _request("GET", f"/transaction/verify/{reference}")
    if not response.get("status"):
        raise PaystackError(response.get("message") or "Payment verification failed.")
    return response


def verify_paystack_signature(payload, signature):
    secret = settings.PAYSTACK_SECRET_KEY
    if not secret or not signature:
        return False
    computed = hmac.new(secret.encode("utf-8"), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(computed, signature)
