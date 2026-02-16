import json
import logging
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.tokens import default_token_generator
from django.db import models, transaction
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie

from .forms import CheckoutForm, OrderTrackingForm, SignUpForm
from .models import Category, Order, OrderItem, Product, User
from .cart import cart_summary, get_cart
from .payments import (
    PaystackError,
    build_paystack_metadata,
    get_paystack_callback_url,
    initialize_paystack_transaction,
    verify_paystack_signature,
    verify_paystack_transaction,
)
from .emails import (
    send_order_received_email,
    send_payment_confirmed_email,
    send_welcome_new_user_email,
)

logger = logging.getLogger(__name__)


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
    in_stock_raw = request.GET.get("in_stock")
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
    if in_stock_raw in {"true", "1", "yes", "on"}:
        base_queryset = base_queryset.filter(stock_quantity__gt=0)
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

    filter_count = 0
    if category_slug:
        filter_count += 1
    if query:
        filter_count += 1
    if min_price_raw or max_price_raw:
        filter_count += 1
    if in_stock_raw in {"true", "1", "yes", "on"}:
        filter_count += 1

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
        "filter_count": filter_count,
    }
    return products, categories, active_category, pagination


def _get_or_create_user_from_checkout(email, full_name, phone):
    """
    Get existing user by email or create a new one.
    Returns (user, is_new_user, temp_password, password_reset_url)
    """
    user = User.objects.filter(email__iexact=email).first()
    if user:
        return user, False, None, None
    
    # Create new user using email as username (consistent with signup form)
    username = email
    
    # Parse full name into first and last
    name_parts = full_name.strip().split(maxsplit=1)
    first_name = name_parts[0] if name_parts else ""
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    user = User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone,
    )
    temp_password = User.objects.make_random_password(length=12)
    user.set_password(temp_password)
    user.save()

    from django.conf import settings
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    password_reset_url = f"{settings.SITE_URL}/accounts/reset/{uid}/{token}/"

    return user, True, temp_password, password_reset_url


def _create_pending_order(request, form, summary):
    with transaction.atomic():
        user_for_order = request.user if request.user.is_authenticated else None
        order = Order.objects.create(
            user=user_for_order,
            full_name=form.cleaned_data["full_name"],
            email=form.cleaned_data["email"],
            phone=form.cleaned_data["phone"],
            address=form.cleaned_data["address"],
            notes=form.cleaned_data.get("notes", ""),
            subtotal=summary["subtotal"],
            amount=summary["subtotal"],
            currency=summary["currency"],
            payment_status="pending",
            payment_method="paystack",
        )
        for item in get_cart(request).items.select_related("product"):
            OrderItem.objects.create(
                order=order,
                product=item.product,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
            )
        temp_password = None
        password_reset_url = None
        is_new_user = False
        if not request.user.is_authenticated:
            user_for_order, is_new_user, temp_password, password_reset_url = _get_or_create_user_from_checkout(
                form.cleaned_data["email"],
                form.cleaned_data["full_name"],
                form.cleaned_data["phone"],
            )
            order.user = user_for_order
            order.save(update_fields=["user"])
    return order, is_new_user, temp_password, password_reset_url


@ensure_csrf_cookie
def home(request):
    products = (
        Product.objects.filter(is_active=True)
        .prefetch_related("images", "categories")
        .order_by("-updated_at", "name")
    )
    return render(request, "index.html", {"products": products})


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
    tiers = list(product.price_tiers.all())
    tier_ranges = []
    tier_savings = None
    first_tier_max = None
    if tiers:
        for idx, tier in enumerate(tiers):
            next_min = tiers[idx + 1].min_quantity if idx + 1 < len(tiers) else None
            max_qty = next_min if next_min else None
            tier_ranges.append(
                {
                    "min": tier.min_quantity,
                    "max": max_qty,
                    "price": tier.price,
                    "currency": tier.currency,
                }
            )
        if len(tiers) > 1 and tiers[1].price < tiers[0].price:
            tier_savings = tiers[0].price - tiers[1].price
            first_tier_max = tiers[1].min_quantity
    else:
        # Fallback tiering for D2Pro when tiers are missing.
        slug_lower = (product.slug or "").lower()
        name_lower = (product.name or "").lower()
        if "d2pro" in slug_lower or "d2pro" in name_lower:
            tier_ranges = [
                {"min": 1, "max": 19, "price": 320000, "currency": "NGN"},
                {"min": 20, "max": None, "price": 280000, "currency": "NGN"},
            ]
            tier_savings = 40000
            first_tier_max = 19
    products, categories, active_category, pagination = _get_shop_queryset(
        request, exclude_id=product.id
    )
    return render(
        request,
        "product_detail.html",
        {
            "product": product,
            "products": products,
            "categories": categories,
            "active_category": active_category,
            "pagination": pagination,
            "price_tier_ranges": tier_ranges,
            "tier_savings": tier_savings,
            "first_tier_max": first_tier_max,
        },
    )


@ensure_csrf_cookie
def products(request):
    products, categories, active_category, pagination = _get_shop_queryset(request)
    return render(
        request,
        "products.html",
        {
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

    order, is_new_user, temp_password, password_reset_url = _create_pending_order(request, form, summary)
    try:
        callback_url = get_paystack_callback_url(request)
        payment = initialize_paystack_transaction(
            order,
            form.cleaned_data["email"],
            summary["subtotal"],
            summary["currency"],
            callback_url,
            metadata=build_paystack_metadata(order),
        )
        order.payment_reference = payment["reference"]
        order.save(update_fields=["payment_reference"])
        
        # Send welcome email for new users or standard order email for existing
        if is_new_user and temp_password:
            send_welcome_new_user_email(
                order.user,
                order,
                temp_password,
                password_reset_url,
            )
        else:
            send_order_received_email(order)
        
        return redirect(payment["authorization_url"])
    except PaystackError as exc:
        logger.exception("Paystack initialization failed: %s", exc)
        order.payment_status = "failed"
        order.save(update_fields=["payment_status"])
        return render(
            request,
            "checkout.html",
            {
                "cart": summary,
                "form": form,
                "payment_error": (
                    f"Payment initialization failed: {exc}"
                    if settings.DEBUG
                    else "Payment initialization failed. Please try again."
                ),
                "order_id": order.id,
            },
        )


@ensure_csrf_cookie
def support(request):
    return render(request, "support.html")


@ensure_csrf_cookie
def signup_view(request):
    if request.user.is_authenticated:
        return redirect("dashboard")

    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            next_url = request.POST.get("next") or request.GET.get("next") or "home"
            return redirect(next_url)
    else:
        form = SignUpForm()

    next_url = request.GET.get("next", "")
    return render(request, "registration/signup.html", {"form": form, "next": next_url})


@ensure_csrf_cookie
def contact(request):
    return render(request, "contact.html")


def health(request):
    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
def track_order(request):
    form = OrderTrackingForm(request.POST or None)
    order = None
    error = None
    if request.method == "POST":
        if form.is_valid():
            order_number = form.cleaned_data["order_number"]
            email = form.cleaned_data["email"].strip()
            order = (
                Order.objects.prefetch_related("items", "items__product")
                .filter(id=order_number, email__iexact=email)
                .first()
            )
            if not order:
                error = "We could not find that order. Check your order number and email."
        else:
            error = "Please correct the errors below and try again."

    return render(
        request,
        "order_tracking.html",
        {
            "form": form,
            "order": order,
            "tracking_error": error,
        },
    )


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
                "order_id": order.id if order else None,
            },
        )

    order = Order.objects.filter(payment_reference=reference).first()
    if not order:
        return HttpResponseBadRequest("Order not found.")

    if order.payment_status != "paid":
        amount_kobo = int(data.get("amount") or 0)
        order.payment_status = "paid"
        if order.status == "new":
            order.status = "processing"
        order.paid_at = timezone.now()
        if amount_kobo:
            order.amount = amount_kobo // 100
        order.currency = data.get("currency") or order.currency
        update_fields = ["payment_status", "status", "paid_at", "amount", "currency"]
        if not order.payment_method:
            order.payment_method = "paystack"
            update_fields.append("payment_method")
        order.save(update_fields=update_fields)

    send_payment_confirmed_email(order)

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
            if order:
                if order.payment_status != "paid":
                    amount_kobo = int(data.get("amount") or 0)
                    order.payment_status = "paid"
                    if order.status == "new":
                        order.status = "processing"
                    order.paid_at = timezone.now()
                    if amount_kobo:
                        order.amount = amount_kobo // 100
                    order.currency = data.get("currency") or order.currency
                    update_fields = ["payment_status", "status", "paid_at", "amount", "currency"]
                    if not order.payment_method:
                        order.payment_method = "paystack"
                        update_fields.append("payment_method")
                    order.save(update_fields=update_fields)

                send_payment_confirmed_email(order)

    return JsonResponse({"status": "ok"})


@ensure_csrf_cookie
def dashboard_view(request):
    """User dashboard with profile and recent orders."""
    if not request.user.is_authenticated:
        return redirect(f"/accounts/login/?next={request.path}")
    
    recent_orders = Order.objects.filter(user=request.user).order_by("-created_at")[:5]
    order_count = Order.objects.filter(user=request.user).count()
    
    return render(
        request,
        "account/dashboard.html",
        {
            "recent_orders": recent_orders,
            "order_count": order_count,
        },
    )


@ensure_csrf_cookie
def user_orders_view(request):
    """List all orders for the logged-in user."""
    if not request.user.is_authenticated:
        return redirect(f"/accounts/login/?next={request.path}")
    
    orders = (
        Order.objects.filter(user=request.user)
        .prefetch_related("items", "items__product")
        .order_by("-created_at")
    )
    
    return render(request, "account/orders.html", {"orders": orders})


@ensure_csrf_cookie
def user_order_detail_view(request, order_id):
    """Detailed view of a single order for the logged-in user."""
    if not request.user.is_authenticated:
        return redirect(f"/accounts/login/?next={request.path}")
    
    order = get_object_or_404(
        Order.objects.prefetch_related("items", "items__product"),
        id=order_id,
        user=request.user,
    )
    
    return render(request, "account/order_detail.html", {"order": order})


@ensure_csrf_cookie
def about_view(request):
    """About Us page."""
    return render(request, "about.html")


@ensure_csrf_cookie
def faq_view(request):
    """FAQ page."""
    return render(request, "faq.html")


@ensure_csrf_cookie
def privacy_view(request):
    """Privacy Policy page."""
    return render(request, "privacy.html")


@ensure_csrf_cookie
def terms_view(request):
    """Terms of Service page."""
    return render(request, "terms.html")


@ensure_csrf_cookie
def pricing_view(request):
    """Pricing page."""
    return render(request, "pricing.html")


def not_found_view(request, exception=None):
    """Custom 404 page."""
    return render(request, "404.html", status=404)


@ensure_csrf_cookie
def payment_success_view(request):
    """Payment success page."""
    order_id = request.GET.get("order_id")
    order = None
    if order_id:
        order = Order.objects.filter(id=order_id).first()
    return render(request, "payment_success.html", {"order": order})


@ensure_csrf_cookie
def payment_failed_view(request):
    """Payment failed page."""
    order_id = request.GET.get("order_id")
    order = None
    if order_id:
        order = Order.objects.filter(id=order_id).first()
    return render(request, "payment_failed.html", {"order": order})


@ensure_csrf_cookie
def wholesale_view(request):
    """Wholesale/B2B partnership inquiry page."""
    form_submitted = False
    
    if request.method == "POST":
        from .models import WholesaleInquiry
        
        # Create wholesale inquiry
        inquiry = WholesaleInquiry.objects.create(
            company_name=request.POST.get('company_name', ''),
            contact_name=request.POST.get('contact_name', ''),
            email=request.POST.get('email', ''),
            phone=request.POST.get('phone', ''),
            business_address=request.POST.get('business_address', ''),
            business_type=request.POST.get('business_type', ''),
            expected_volume=request.POST.get('expected_volume', ''),
            website=request.POST.get('website', ''),
            message=request.POST.get('message', ''),
            user=request.user if request.user.is_authenticated else None,
        )
        
        form_submitted = True
    
    return render(request, "wholesale.html", {"form_submitted": form_submitted})


@ensure_csrf_cookie
def smart_features_view(request):
    """Smart features educational page."""
    return render(request, "smart_features.html")


# ========================================
# WISHLIST VIEWS
# ========================================

@ensure_csrf_cookie
def wishlist_view(request):
    """Display user's wishlist."""
    if not request.user.is_authenticated:
        # Show empty state for guests with prompt to login
        return render(request, "wishlist.html", {
            "wishlist_items": [],
            "is_guest": True
        })
    
    from .models import Wishlist
    
    # Get or create wishlist for user
    wishlist, created = Wishlist.objects.get_or_create(user=request.user)
    
    # Get wishlist items with product details
    wishlist_items = wishlist.items.select_related('product').prefetch_related('product__images')
    
    return render(request, "wishlist.html", {
        "wishlist_items": wishlist_items,
        "wishlist_count": wishlist.item_count,
        "is_guest": False
    })


@ensure_csrf_cookie
def wishlist_api_items(request):
    """API endpoint to get wishlist items for authenticated users."""
    if not request.user.is_authenticated:
        return JsonResponse({"product_ids": []})
    
    from .models import Wishlist
    
    wishlist, created = Wishlist.objects.get_or_create(user=request.user)
    product_ids = list(wishlist.items.values_list('product_id', flat=True))
    
    return JsonResponse({"product_ids": product_ids})


@ensure_csrf_cookie
def wishlist_api_add(request):
    """API endpoint to add product to wishlist."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    from .models import Wishlist, WishlistItem
    
    try:
        data = json.loads(request.body)
        product_id = data.get("product_id")
        
        if not product_id:
            return JsonResponse({"error": "product_id required"}, status=400)
        
        product = get_object_or_404(Product, id=product_id, is_active=True)
        wishlist, created = Wishlist.objects.get_or_create(user=request.user)
        
        # Create wishlist item (unique_together prevents duplicates)
        item, created = WishlistItem.objects.get_or_create(
            wishlist=wishlist,
            product=product
        )
        
        return JsonResponse({
            "success": True,
            "created": created,
            "wishlist_count": wishlist.item_count
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@ensure_csrf_cookie
def wishlist_api_remove(request):
    """API endpoint to remove product from wishlist."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    from .models import Wishlist, WishlistItem
    
    try:
        data = json.loads(request.body)
        product_id = data.get("product_id")
        
        if not product_id:
            return JsonResponse({"error": "product_id required"}, status=400)
        
        wishlist = Wishlist.objects.filter(user=request.user).first()
        if wishlist:
            WishlistItem.objects.filter(
                wishlist=wishlist,
                product_id=product_id
            ).delete()
        
        wishlist_count = wishlist.item_count if wishlist else 0
        
        return JsonResponse({
            "success": True,
            "wishlist_count": wishlist_count
        })
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@ensure_csrf_cookie
def wishlist_api_add_all_to_cart(request):
    """API endpoint to add all wishlist items to cart."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    from .models import Wishlist
    from .cart import get_cart
    from .models import CartItem
    
    try:
        wishlist = Wishlist.objects.filter(user=request.user).first()
        if not wishlist:
            return JsonResponse({"count": 0, "cart_count": 0})
        
        cart = get_cart(request)
        added_count = 0
        
        for item in wishlist.items.select_related('product'):
            product = item.product
            
            # Add to cart or update quantity
            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                product=product,
                defaults={
                    'unit_price': product.price or 0,
                    'quantity': 1
                }
            )
            
            if not created:
                cart_item.quantity += 1
                cart_item.save()
            
            added_count += 1
        
        cart_count = cart.items.count()
        
        return JsonResponse({
            "success": True,
            "count": added_count,
            "cart_count": cart_count
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
