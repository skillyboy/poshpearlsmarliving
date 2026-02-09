from django.db import transaction
from django.shortcuts import get_object_or_404

from poshapp.models import Cart, CartItem, Product


def ensure_session_key(request):
    if request.session.session_key:
        return request.session.session_key
    request.session.create()
    return request.session.session_key


def get_cart(request):
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        return cart
    session_key = ensure_session_key(request)
    cart, _ = Cart.objects.get_or_create(session_key=session_key, user=None)
    return cart


def price_for_product(product):
    if product.price:
        return product.price
    tier = product.price_tiers.order_by("min_quantity").first()
    return tier.price if tier else None


def cart_summary(cart):
    items = []
    subtotal = 0
    currency = "NGN"
    cart_items = (
        cart.items.select_related("product")
        .prefetch_related("product__images")
        .all()
    )
    for item in cart_items:
        product = item.product
        if not product or not getattr(product, "is_active", True):
            item.delete()
            continue

        unit_price = item.unit_price
        if unit_price is None:
            unit_price = price_for_product(product)
            if unit_price is None:
                item.delete()
                continue
            item.unit_price = unit_price
            item.currency = item.currency or product.currency
            item.save(update_fields=["unit_price", "currency", "updated_at"])

        try:
            unit_price_value = int(unit_price)
        except (TypeError, ValueError):
            fallback_price = price_for_product(product)
            if fallback_price is None:
                item.delete()
                continue
            item.unit_price = fallback_price
            item.currency = item.currency or product.currency
            item.save(update_fields=["unit_price", "currency", "updated_at"])
            unit_price_value = int(fallback_price)

        raw_line_total = getattr(item, "line_total", None)
        try:
            line_total_value = int(raw_line_total)
        except (TypeError, ValueError):
            line_total_value = unit_price_value * item.quantity

        image = product.images.first()
        currency = item.currency or product.currency or currency
        subtotal += line_total_value
        items.append(
            {
                "id": item.id,
                "product_id": item.product_id,
                "name": product.name,
                "quantity": item.quantity,
                "unit_price": unit_price_value,
                "currency": currency,
                "line_total": line_total_value,
                "image": image.image.url if image else None,
            }
        )
    return {
        "id": cart.id,
        "items": items,
        "subtotal": subtotal,
        "currency": currency,
    }


@transaction.atomic
def add_item(cart, product_id, quantity):
    if quantity < 1:
        raise ValueError("Quantity must be at least 1.")
    product = get_object_or_404(Product, id=product_id, is_active=True)
    unit_price = price_for_product(product)
    if unit_price is None:
        raise ValueError("Pricing not available for this product.")
    item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product,
        defaults={
            "quantity": quantity,
            "unit_price": unit_price,
            "currency": product.currency,
        },
    )
    if not created:
        item.quantity += quantity
        item.unit_price = unit_price
        item.currency = product.currency
        item.save(update_fields=["quantity", "unit_price", "currency", "updated_at"])
    return item
