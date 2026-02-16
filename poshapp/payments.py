import hashlib
import hmac
import json
import logging
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.conf import settings
from django.urls import reverse

logger = logging.getLogger(__name__)


class PaystackError(RuntimeError):
    pass


def get_paystack_callback_url(request):
    configured = (settings.PAYSTACK_CALLBACK_URL or "").strip()
    if configured:
        parsed = urlparse(configured)
        if parsed.scheme and parsed.netloc:
            return configured
        return request.build_absolute_uri(configured)
    return request.build_absolute_uri(reverse("payment_callback"))


def _headers():
    secret = settings.PAYSTACK_SECRET_KEY
    if not secret:
        raise PaystackError("PAYSTACK_SECRET_KEY is not configured.")
    return {
        "Authorization": f"Bearer {secret}",
        "Content-Type": "application/json",
        "User-Agent": "PoshPearl/1.0",
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
        status = getattr(exc, "code", None)
        raw_detail = None
        detail = None
        try:
            raw_detail = exc.read().decode("utf-8")
        except Exception:
            raw_detail = None

        if raw_detail:
            try:
                parsed = json.loads(raw_detail)
            except json.JSONDecodeError:
                parsed = None

            if isinstance(parsed, dict):
                message = parsed.get("message") or parsed.get("error")
                error_code = parsed.get("code") or parsed.get("error_code")
                meta = parsed.get("meta")
                detail = message or "Paystack API error"
                if error_code:
                    detail = f"{detail} (code {error_code})"
                if isinstance(meta, dict):
                    reason = meta.get("reason") or meta.get("message")
                    if reason:
                        detail = f"{detail}: {reason}"
            else:
                detail = raw_detail

        if not detail:
            detail = str(exc)

        if status and "HTTP" not in detail:
            detail = f"{detail} (HTTP {status})"

        logger.debug("Paystack HTTPError %s response: %s", status, raw_detail or str(exc))
        raise PaystackError(detail) from exc
    except URLError as exc:
        raise PaystackError(str(exc)) from exc


def build_paystack_metadata(order):
    items = []
    summary_parts = []
    for item in order.items.select_related("product"):
        product_name = item.product.name if item.product else "Item"
        quantity = int(item.quantity)
        unit_price = int(item.unit_price)
        line_total = int(item.line_total)
        items.append(
            {
                "name": product_name,
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": line_total,
                "currency": item.currency,
            }
        )
        if len(summary_parts) < 3:
            summary_parts.append(f"{product_name} x{quantity}")

    summary = ", ".join(summary_parts)
    remaining = max(len(items) - len(summary_parts), 0)
    if remaining:
        summary = f"{summary} (+{remaining} more)"

    amount_value = order.amount or order.subtotal or 0
    currency = order.currency or "NGN"

    return {
        "order_id": order.id,
        "customer_name": order.full_name,
        "customer_email": order.email,
        "amount": int(amount_value),
        "currency": currency,
        "items": items,
        "custom_fields": [
            {"display_name": "Order ID", "variable_name": "order_id", "value": str(order.id)},
            {"display_name": "Customer", "variable_name": "customer", "value": order.full_name},
            {"display_name": "Items", "variable_name": "items", "value": summary},
            {"display_name": "Total", "variable_name": "total", "value": f"{currency} {int(amount_value)}"},
        ],
    }


def initialize_paystack_transaction(order, email, amount, currency, callback_url, metadata=None):
    amount_kobo = int(amount) * 100
    reference = order.payment_reference or f"POSH-{order.id}-{uuid.uuid4().hex[:8]}"
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
