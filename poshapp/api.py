from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.urls import reverse
from ninja import NinjaAPI
from ninja.errors import HttpError

from .models import CartItem, Category, Order, OrderItem, Product
from .cart import add_item, cart_summary, get_cart as get_cart_for_request
from .payments import PaystackError, initialize_paystack_transaction
from .schemas import (
    CartItemIn,
    CartItemOut,
    CartItemUpdate,
    CartOut,
    CategoryOut,
    CheckoutIn,
    OrderItemOut,
    OrderOut,
    PaymentInitOut,
    ProductImageOut,
    ProductOut,
    ProductPriceTierOut,
)


api = NinjaAPI(title="PoshPearl API", version="1.0")


def _serialize_product(product):
    return ProductOut(
        id=product.id,
        name=product.name,
        slug=product.slug,
        sku=product.sku,
        short_description=product.short_description,
        description=product.description,
        price=int(product.price) if product.price is not None else None,
        compare_at_price=(
            int(product.compare_at_price)
            if product.compare_at_price is not None
            else None
        ),
        currency=product.currency,
        stock_quantity=product.stock_quantity,
        is_featured=product.is_featured,
        categories=[
            CategoryOut(
                id=category.id,
                name=category.name,
                slug=category.slug,
                description=category.description,
            )
            for category in product.categories.all()
        ],
        images=[
            ProductImageOut(
                url=image.image.url,
                alt_text=image.alt_text,
                is_primary=image.is_primary,
            )
            for image in product.images.all()
        ],
        price_tiers=[
            ProductPriceTierOut(
                min_quantity=tier.min_quantity,
                price=int(tier.price),
                currency=tier.currency,
                label=tier.label or None,
            )
            for tier in product.price_tiers.all()
        ],
    )


def _serialize_cart(cart):
    summary = cart_summary(cart)
    items = [
        CartItemOut(
            id=item["id"],
            product_id=item["product_id"],
            name=item["name"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            currency=item["currency"],
            line_total=item["line_total"],
            image=item["image"],
        )
        for item in summary["items"]
    ]
    return CartOut(
        id=summary["id"],
        items=items,
        subtotal=summary["subtotal"],
        currency=summary["currency"],
    )


@api.get("/cart", response=CartOut)
def get_cart(request):
    cart = get_cart_for_request(request)
    return _serialize_cart(cart)


@api.get("/products", response=list[ProductOut])
def list_products(
    request,
    category: str | None = None,
    featured: bool | None = None,
    q: str | None = None,
    ordering: str | None = None,
    min_price: int | None = None,
    max_price: int | None = None,
    limit: int = 20,
    offset: int = 0,
):
    queryset = (
        Product.objects.filter(is_active=True)
        .prefetch_related("images", "price_tiers", "categories")
        .order_by("-updated_at", "name")
    )
    if category:
        queryset = queryset.filter(categories__slug=category)
    if featured is not None:
        queryset = queryset.filter(is_featured=featured)
    if q:
        queryset = queryset.filter(Q(name__icontains=q) | Q(sku__icontains=q))
    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)
    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)
    if ordering:
        ordering_map = {
            "updated": "-updated_at",
            "updated_asc": "updated_at",
            "price": "price",
            "-price": "-price",
            "name": "name",
            "-name": "-name",
        }
        order_by = ordering_map.get(ordering)
        if order_by:
            queryset = queryset.order_by(order_by)
    safe_limit = max(1, min(int(limit), 100))
    safe_offset = max(0, int(offset))
    paged = queryset[safe_offset : safe_offset + safe_limit]
    return [_serialize_product(product) for product in paged]


@api.get("/products/{product_id}", response=ProductOut)
def get_product(request, product_id: int):
    product = get_object_or_404(
        Product.objects.prefetch_related("images", "price_tiers", "categories"),
        id=product_id,
        is_active=True,
    )
    return _serialize_product(product)


@api.get("/categories", response=list[CategoryOut])
def list_categories(request):
    categories = Category.objects.filter(is_active=True).order_by("name")
    return [
        CategoryOut(
            id=category.id,
            name=category.name,
            slug=category.slug,
            description=category.description,
        )
        for category in categories
    ]


@api.post("/checkout", response=OrderOut)
def create_order(request, payload: CheckoutIn):
    cart = get_cart_for_request(request)
    summary = cart_summary(cart)
    if not summary["items"]:
        raise HttpError(400, "Cart is empty.")

    with transaction.atomic():
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            address=payload.address,
            notes=payload.notes or "",
            subtotal=summary["subtotal"],
            amount=summary["subtotal"],
            currency=summary["currency"],
            payment_status="pending",
        )
        items_out = []
        for item in cart.items.select_related("product"):
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
            )
            items_out.append(
                OrderItemOut(
                    product_id=item.product_id,
                    name=item.product.name,
                    quantity=item.quantity,
                    unit_price=int(item.unit_price),
                    currency=item.currency,
                    line_total=int(item.line_total),
                )
            )
        cart.items.all().delete()

    return OrderOut(
        id=order.id,
        items=items_out,
        subtotal=summary["subtotal"],
        currency=summary["currency"],
        payment_status=order.payment_status,
    )


@api.post("/payments/init", response=PaymentInitOut)
def init_payment(request, payload: CheckoutIn):
    cart = get_cart_for_request(request)
    summary = cart_summary(cart)
    if not summary["items"]:
        raise HttpError(400, "Cart is empty.")

    with transaction.atomic():
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            full_name=payload.full_name,
            email=payload.email,
            phone=payload.phone,
            address=payload.address,
            notes=payload.notes or "",
            subtotal=summary["subtotal"],
            amount=summary["subtotal"],
            currency=summary["currency"],
            payment_status="pending",
        )
        for item in cart.items.select_related("product"):
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
            )

    try:
        callback_url = request.build_absolute_uri(reverse("payment_callback"))
        payment = initialize_paystack_transaction(
            order,
            payload.email,
            summary["subtotal"],
            summary["currency"],
            callback_url,
            metadata={"order_id": order.id},
        )
        order.payment_reference = payment["reference"]
        order.save(update_fields=["payment_reference"])
    except PaystackError:
        order.payment_status = "failed"
        order.save(update_fields=["payment_status"])
        raise HttpError(400, "Payment initialization failed.")

    return PaymentInitOut(
        order_id=order.id,
        reference=order.payment_reference,
        authorization_url=payment["authorization_url"],
    )


@api.post("/payments/initialize", response=PaymentInitOut)
def init_payment_alias(request, payload: CheckoutIn):
    return init_payment(request, payload)


@api.post("/cart/items", response=CartOut)
def add_to_cart(request, payload: CartItemIn):
    if payload.quantity < 1:
        raise HttpError(400, "Quantity must be at least 1.")

    cart = get_cart_for_request(request)
    try:
        add_item(cart, payload.product_id, payload.quantity)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return _serialize_cart(cart)


@api.patch("/cart/items/{item_id}", response=CartOut)
def update_cart_item(request, item_id: int, payload: CartItemUpdate):
    cart = get_cart_for_request(request)
    item = get_object_or_404(CartItem, id=item_id, cart=cart)
    if payload.quantity <= 0:
        item.delete()
        return _serialize_cart(cart)
    item.quantity = payload.quantity
    item.save(update_fields=["quantity", "updated_at"])
    return _serialize_cart(cart)


@api.delete("/cart/items/{item_id}", response=CartOut)
def remove_cart_item(request, item_id: int):
    cart = get_cart_for_request(request)
    item = get_object_or_404(CartItem, id=item_id, cart=cart)
    item.delete()
    return _serialize_cart(cart)


@api.delete("/cart", response=CartOut)
def clear_cart(request):
    cart = get_cart_for_request(request)
    cart.items.all().delete()
    return _serialize_cart(cart)
