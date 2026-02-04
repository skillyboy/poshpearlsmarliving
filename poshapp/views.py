import json
from django.db import models, transaction
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie

from .forms import CheckoutForm
from .models import Category, Order, OrderItem, Product
from .cart import cart_summary, get_cart
from .payments import (
    PaystackError,
    initialize_paystack_transaction,
    verify_paystack_signature,
    verify_paystack_transaction,
)


def _get_shop_queryset(request, exclude_id=None):
    base_queryset = (
        Product.objects.prefetch_related("images", "price_tiers", "categories")
        .filter(is_active=True)
        .order_by("-updated_at", "name")
    )
    if exclude_id:
        base_queryset = base_queryset.exclude(id=exclude_id)
    categories = Category.objects.filter(is_active=True).order_by("name")
    category_slug = request.GET.get("category")
    active_category = None
    if category_slug:
        active_category = categories.filter(slug=category_slug).first()
        if active_category:
            base_queryset = base_queryset.filter(categories__slug=category_slug)
    query = request.GET.get("q", "").strip()
    if not query:
        legacy_product = request.GET.get("product", "").strip()
        if legacy_product:
            query = legacy_product
    if query:
        base_queryset = base_queryset.filter(
            models.Q(name__icontains=query) | models.Q(sku__icontains=query)
        )
    min_price_raw = request.GET.get("min_price")
    max_price_raw = request.GET.get("max_price")
    try:
        min_price = int(min_price_raw) if min_price_raw else None
    except ValueError:
        min_price = None
    try:
        max_price = int(max_price_raw) if max_price_raw else None
    except ValueError:
        max_price = None
    if min_price is not None:
        base_queryset = base_queryset.filter(price__gte=min_price)
    if max_price is not None:
        base_queryset = base_queryset.filter(price__lte=max_price)
    invalid_price_range = False
    if min_price is not None and max_price is not None and min_price > max_price:
        invalid_price_range = True
        min_price, max_price = max_price, min_price
        base_queryset = base_queryset.filter(price__gte=min_price, price__lte=max_price)
    ordering = request.GET.get("ordering")
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
        base_queryset = base_queryset.order_by(order_by)
    total_count = base_queryset.count()
    per_page_raw = request.GET.get("per_page", "6")
    page_raw = request.GET.get("page", "1")
    try:
        per_page = max(1, min(int(per_page_raw), 24))
    except ValueError:
        per_page = 6
    try:
        page = max(1, int(page_raw))
    except ValueError:
        page = 1
    start = (page - 1) * per_page
    end = start + per_page
    products = base_queryset[start:end]
    total_pages = (total_count + per_page - 1) // per_page if per_page else 1

    params = request.GET.copy()
    params.pop("page", None)
    params.pop("per_page", None)
    querystring = params.urlencode()

    pagination = {
        "page": page,
        "per_page": per_page,
        "total_count": total_count,
        "total_pages": total_pages,
        "has_prev": page > 1,
        "has_next": page < total_pages,
        "prev_page": page - 1,
        "next_page": page + 1,
        "start_index": start + 1 if total_count else 0,
        "end_index": min(end, total_count),
        "querystring": querystring,
        "has_filters": bool(querystring),
        "invalid_price_range": invalid_price_range,
    }
    return products, categories, active_category, pagination


def _create_pending_order(request, form, summary):
    with transaction.atomic():
        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            full_name=form.cleaned_data["full_name"],
            email=form.cleaned_data["email"],
            phone=form.cleaned_data["phone"],
            address=form.cleaned_data["address"],
            notes=form.cleaned_data.get("notes", ""),
            subtotal=summary["subtotal"],
            amount=summary["subtotal"],
            currency=summary["currency"],
            payment_status="pending",
        )
        for item in get_cart(request).items.select_related("product"):
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
            )
    return order


@ensure_csrf_cookie
def home(request):
    return render(request, "index.html")


@ensure_csrf_cookie
def shop(request):
    products, categories, active_category, pagination = _get_shop_queryset(request)
    product = products.first()
    return render(
        request,
        "shop.html",
        {
            "product": product,
            "products": products,
            "categories": categories,
            "active_category": active_category,
            "pagination": pagination,
        },
    )


@ensure_csrf_cookie
def product_detail(request, slug):
    product = get_object_or_404(
        Product.objects.prefetch_related("images", "price_tiers", "categories"),
        slug=slug,
        is_active=True,
    )
    products, categories, active_category, pagination = _get_shop_queryset(
        request, exclude_id=product.id
    )
    return render(
        request,
        "shop.html",
        {
            "product": product,
            "products": products,
            "categories": categories,
            "active_category": active_category,
            "pagination": pagination,
        },
    )


@ensure_csrf_cookie
def cart_view(request):
    cart = get_cart(request)
    summary = cart_summary(cart)
    return render(request, "cart.html", {"cart": summary})


@ensure_csrf_cookie
def checkout(request):
    cart = get_cart(request)
    summary = cart_summary(cart)
    if not summary["items"]:
        return render(
            request,
            "checkout.html",
            {"cart": summary, "form": CheckoutForm(), "empty_cart": True},
        )

    if request.method == "POST":
        return payment_initialize(request)

    form = CheckoutForm()

    return render(
        request,
        "checkout.html",
        {"cart": summary, "form": form},
    )


@ensure_csrf_cookie
def payment_initialize(request):
    if request.method != "POST":
        return redirect("checkout")

    cart = get_cart(request)
    summary = cart_summary(cart)
    if not summary["items"]:
        return render(
            request,
            "checkout.html",
            {"cart": summary, "form": CheckoutForm(), "empty_cart": True},
        )

    form = CheckoutForm(request.POST)
    if not form.is_valid():
        return render(request, "checkout.html", {"cart": summary, "form": form})

    order = _create_pending_order(request, form, summary)
    try:
        callback_url = request.build_absolute_uri(reverse("payment_callback"))
        payment = initialize_paystack_transaction(
            order,
            form.cleaned_data["email"],
            summary["subtotal"],
            summary["currency"],
            callback_url,
            metadata={"order_id": order.id},
        )
        order.payment_reference = payment["reference"]
        order.save(update_fields=["payment_reference"])
        return redirect(payment["authorization_url"])
    except PaystackError:
        order.payment_status = "failed"
        order.save(update_fields=["payment_status"])
        return render(
            request,
            "checkout.html",
            {
                "cart": summary,
                "form": form,
                "payment_error": "Payment initialization failed. Please try again.",
            },
        )


@ensure_csrf_cookie
def support(request):
    return render(request, "support.html")


@ensure_csrf_cookie
def contact(request):
    return render(request, "contact.html")


@ensure_csrf_cookie
def payment_callback(request):
    reference = request.GET.get("reference")
    if not reference:
        return HttpResponseBadRequest("Missing payment reference.")
    try:
        verification = verify_paystack_transaction(reference)
    except PaystackError:
        summary = cart_summary(get_cart(request))
        return render(
            request,
            "checkout.html",
            {
                "cart": summary,
                "form": CheckoutForm(),
                "payment_error": "Unable to verify payment. Please contact support.",
            },
        )

    data = verification.get("data") or {}
    if data.get("status") != "success":
        order = Order.objects.filter(payment_reference=reference).first()
        if order:
            order.payment_status = "failed"
            order.save(update_fields=["payment_status"])
        summary = cart_summary(get_cart(request))
        return render(
            request,
            "checkout.html",
            {
                "cart": summary,
                "form": CheckoutForm(),
                "payment_error": "Payment failed or was cancelled.",
            },
        )

    order = Order.objects.filter(payment_reference=reference).first()
    if not order:
        return HttpResponseBadRequest("Order not found.")

    if order.payment_status != "paid":
        amount_kobo = int(data.get("amount") or 0)
        order.payment_status = "paid"
        order.paid_at = timezone.now()
        if amount_kobo:
            order.amount = amount_kobo // 100
        order.currency = data.get("currency") or order.currency
        order.save(update_fields=["payment_status", "paid_at", "amount", "currency"])

    cart = get_cart(request)
    cart.items.all().delete()

    return render(
        request,
        "checkout.html",
        {"order": order, "payment_success": True},
    )


@csrf_exempt
def payment_webhook(request):
    signature = request.META.get("HTTP_X_PAYSTACK_SIGNATURE", "")
    payload = request.body
    if not verify_paystack_signature(payload, signature):
        return HttpResponseBadRequest("Invalid signature.")

    try:
        event = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponseBadRequest("Invalid payload.")

    if event.get("event") == "charge.success":
        data = event.get("data") or {}
        reference = data.get("reference")
        if reference:
            order = Order.objects.filter(payment_reference=reference).first()
            if order and order.payment_status != "paid":
                amount_kobo = int(data.get("amount") or 0)
                order.payment_status = "paid"
                order.paid_at = timezone.now()
                if amount_kobo:
                    order.amount = amount_kobo // 100
                order.currency = data.get("currency") or order.currency
                order.save(update_fields=["payment_status", "paid_at", "amount", "currency"])

    return JsonResponse({"status": "ok"})
