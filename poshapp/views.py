import json
import logging
from django.conf import settings
from django.contrib.auth import login, logout as auth_logout
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.tokens import default_token_generator
from django.db import models, transaction
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.text import slugify
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from django.utils.crypto import get_random_string
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import ensure_csrf_cookie

from .forms import CheckoutForm, OrderTrackingForm, SignUpForm
from .models import (
    Category,
    Order,
    OrderItem,
    Product,
    ProductImage,
    ProductPriceTier,
    SiteSettings,
    User,
)
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


def logout_view(request):
    """Allow GET/POST logout to avoid 405 when users click header link."""
    if request.method in {"GET", "POST"}:
        auth_logout(request)
        return redirect("home")
    return JsonResponse({"error": "Method not allowed"}, status=405)


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
    
    temp_password = get_random_string(length=12)
    user = User.objects.create_user(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone,
        password=temp_password,
    )

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


@staff_member_required
@ensure_csrf_cookie
def poshadmin_view(request):
    """Serve the lightweight hash-routed admin UI (staff only)."""
    return render(request, "poshadmin.html")


# ===============================
# Staff JSON APIs for admin UI
# ===============================

def _serialize_product(p: Product):
    first_img = p.images.first()
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "sku": p.sku,
        "description": p.description,
        "short_description": p.short_description,
        "price": p.price or 0,
        "compare_at_price": p.compare_at_price or 0,
        "currency": p.currency,
        "stock": p.stock_quantity,
        "low_stock_threshold": getattr(p, "low_stock_threshold", 3),
        "status": "archived" if getattr(p, "is_archived", False) else ("active" if p.is_active else "inactive"),
        "updated_at": p.updated_at,
        "image": first_img.image.url if first_img else "",
        "primary_image_url": first_img.image.url if first_img else "",
        "images": [
            {
                "id": img.id,
                "url": img.image.url,
                "order": img.display_order,
                "is_primary": img.is_primary,
            }
            for img in p.images.all().order_by("display_order")
        ],
        "category_names": [c.name for c in p.categories.all()],
        "category_ids": list(p.categories.values_list("id", flat=True)),
        "tiers": [
            {"min_qty": t.min_quantity, "price": t.price, "currency": t.currency}
            for t in p.price_tiers.all()
        ],
    }


@staff_member_required
def poshadmin_api_products(request):
    qs = Product.objects.prefetch_related("images", "categories", "price_tiers").all()
    q = request.GET.get("q", "").strip()
    status = request.GET.get("status")
    low_stock = request.GET.get("low_stock")
    if q:
        qs = qs.filter(models.Q(name__icontains=q) | models.Q(sku__icontains=q))
    if status == "active":
        qs = qs.filter(is_active=True, is_archived=False)
    elif status == "archived":
        qs = qs.filter(is_archived=True)
    elif status == "inactive":
        qs = qs.filter(is_active=False, is_archived=False)
    if low_stock in {"1", "true", "yes", "on"}:
        qs = qs.filter(stock_quantity__lte=models.F("low_stock_threshold"))

    data = [_serialize_product(p) for p in qs.order_by("-updated_at")[:200]]
    return JsonResponse({"results": data})


def _apply_product_payload(product: Product, payload: dict):
    product.name = payload.get("name", product.name)
    product.slug = payload.get("slug") or slugify(product.name)
    product.sku = payload.get("sku") or product.sku or f"SKU-{product.id or ''}"
    product.description = payload.get("description", product.description or "")
    product.short_description = payload.get("short_description", product.short_description or "")[:255]
    price_val = payload.get("price")
    product.price = price_val if price_val is not None else product.price
    compare_val = payload.get("compare_at_price")
    product.compare_at_price = compare_val if compare_val is not None else product.compare_at_price
    product.currency = payload.get("currency", product.currency or "NGN")
    product.stock_quantity = payload.get("stock", product.stock_quantity)
    product.low_stock_threshold = payload.get(
        "low_stock_threshold", getattr(product, "low_stock_threshold", 3)
    )
    status = payload.get("status")
    if status == "archived":
        product.is_archived = True
        product.is_active = False
    elif status == "inactive":
        product.is_archived = False
        product.is_active = False
    elif status:
        product.is_archived = False
        product.is_active = True
    product.save()
    # categories
    category_ids = payload.get("category_ids")
    if category_ids is not None:
        product.categories.set(Category.objects.filter(id__in=category_ids))
    # tiers
    tiers = payload.get("tiers")
    if tiers is not None:
        product.price_tiers.all().delete()
        for t in tiers:
            min_qty = int(t.get("min_qty", 1))
            price = t.get("price")
            currency = t.get("currency", product.currency)
            if price is None:
                continue
            ProductPriceTier.objects.create(
                product=product,
                min_quantity=min_qty,
                price=price,
                currency=currency,
            )


@staff_member_required
def poshadmin_api_product_create(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    product = Product()
    _apply_product_payload(product, payload)
    return JsonResponse({"product": _serialize_product(product)})


@staff_member_required
def poshadmin_api_product_update(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method not in {"PUT", "PATCH"}:
        return JsonResponse({"error": "PUT/PATCH required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    _apply_product_payload(product, payload)
    return JsonResponse({"product": _serialize_product(product)})


@staff_member_required
def poshadmin_api_product_status(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    status = payload.get("status")
    if status == "archived":
        product.is_archived = True
        product.is_active = False
    elif status == "inactive":
        product.is_archived = False
        product.is_active = False
    elif status == "active":
        product.is_archived = False
        product.is_active = True
    product.save(update_fields=["is_archived", "is_active"])
    return JsonResponse({"product": _serialize_product(product)})


@staff_member_required
@csrf_exempt  # allow multipart without explicit CSRF header
def poshadmin_api_product_images_upload(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    files = request.FILES.getlist("images") or request.FILES.getlist("file")
    if not files:
        return JsonResponse({"error": "No files uploaded"}, status=400)
    if product.images.count() + len(files) > 8:
        return JsonResponse({"error": "Max 8 images allowed"}, status=400)
    created = []
    order_base = product.images.count()
    for idx, f in enumerate(files):
        if f.content_type not in {"image/jpeg", "image/png"}:
            continue
        if f.size > 5 * 1024 * 1024:
            continue
        img = ProductImage.objects.create(
            product=product,
            image=f,
            display_order=order_base + idx,
            is_primary=False,
        )
        created.append({"id": img.id, "url": img.image.url, "order": img.display_order})
    # Ensure primary exists
    if not product.images.filter(is_primary=True).exists():
        first = product.images.order_by("display_order").first()
        if first:
            first.is_primary = True
            first.save(update_fields=["is_primary"])
    return JsonResponse({"images": created})


@staff_member_required
def poshadmin_api_product_images_order(request, pk):
    product = get_object_or_404(Product, pk=pk)
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    order = payload.get("order", [])
    for idx, img_id in enumerate(order):
        ProductImage.objects.filter(product=product, id=img_id).update(display_order=idx)
    return JsonResponse({"success": True})


@staff_member_required
def poshadmin_api_product_images_delete(request, pk, image_id):
    product = get_object_or_404(Product, pk=pk)
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE required"}, status=405)
    ProductImage.objects.filter(product=product, id=image_id).delete()
    # Reset primary if needed
    if not product.images.filter(is_primary=True).exists():
        first = product.images.order_by("display_order").first()
        if first:
            first.is_primary = True
            first.save(update_fields=["is_primary"])
    return JsonResponse({"success": True})


@staff_member_required
def poshadmin_api_orders(request):
    status = request.GET.get("status")
    qs = Order.objects.prefetch_related("items").all()
    if status and status != "all":
        qs = qs.filter(status=status)
    data = []
    for o in qs.order_by("-created_at")[:200]:
        data.append({
            "id": o.id,
            "customer": o.full_name,
            "email": o.email,
            "total": o.total or o.amount or o.subtotal,
            "currency": o.currency,
            "status": o.status,
            "payment_status": o.payment_status,
            "internal_note": o.internal_note,
            "date": o.created_at,
            "items_count": o.items.count(),
        })
    return JsonResponse({"results": data})


@staff_member_required
def poshadmin_api_customers(request):
    q = request.GET.get("q", "").strip()
    qs = User.objects.filter(is_staff=False)
    if q:
        qs = qs.filter(models.Q(username__icontains=q) | models.Q(email__icontains=q) | models.Q(first_name__icontains=q) | models.Q(last_name__icontains=q))
    data = []
    for u in qs.order_by("-date_joined")[:200]:
        data.append({
            "id": u.id,
            "name": (u.get_full_name() or u.username),
            "email": u.email,
            "phone": getattr(u, "phone_number", ""),
            "joined": u.date_joined,
            "status": "disabled" if not u.is_active else "active",
        })
    return JsonResponse({"results": data})


# --------------------------
# Additional admin endpoints
# --------------------------

def _get_sitesettings():
    obj, _ = SiteSettings.objects.get_or_create(id=1)
    return obj


@staff_member_required
def poshadmin_api_settings(request):
    settings_obj = _get_sitesettings()
    if request.method == "GET":
        return JsonResponse({
            "store_name": settings_obj.store_name,
            "support_email": settings_obj.support_email,
            "default_currency": settings_obj.default_currency,
            "low_stock_threshold": settings_obj.low_stock_threshold,
        })
    if request.method == "POST":
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        settings_obj.store_name = payload.get("store_name", settings_obj.store_name)
        settings_obj.support_email = payload.get("support_email", settings_obj.support_email)
        settings_obj.default_currency = payload.get("default_currency", settings_obj.default_currency)
        settings_obj.low_stock_threshold = payload.get("low_stock_threshold", settings_obj.low_stock_threshold)
        settings_obj.save()
        return JsonResponse({"success": True})
    return JsonResponse({"error": "Method not allowed"}, status=405)


@staff_member_required
def poshadmin_api_order_update(request, pk):
    order = get_object_or_404(Order, pk=pk)
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    allowed_status = {c[0] for c in Order.STATUS_CHOICES}
    new_status = payload.get("status")
    if new_status in allowed_status:
        order.status = new_status
    payment_status = payload.get("payment_status")
    allowed_payment = {c[0] for c in Order.PAYMENT_STATUS_CHOICES}
    if payment_status in allowed_payment:
        order.payment_status = payment_status
    if payload.get("internal_note") is not None:
        order.internal_note = payload.get("internal_note", "")
    order.save()
    return JsonResponse({"order": {
        "id": order.id,
        "status": order.status,
        "payment_status": order.payment_status,
        "internal_note": order.internal_note,
    }})


@staff_member_required
def poshadmin_api_order_resend(request, pk):
    order = get_object_or_404(Order, pk=pk)
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    send_order_received_email(order)
    return JsonResponse({"success": True})


@staff_member_required
def poshadmin_api_customer_status(request, pk):
    user = get_object_or_404(User, pk=pk, is_staff=False)
    if request.method != "PATCH":
        return JsonResponse({"error": "PATCH required"}, status=405)
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    action = payload.get("status")
    if action == "disable":
        user.is_active = False
    elif action == "enable":
        user.is_active = True
    user.save(update_fields=["is_active"])
    return JsonResponse({"id": user.id, "status": "disabled" if not user.is_active else "active"})


@staff_member_required
def poshadmin_api_categories(request):
    data = [{"id": c.id, "name": c.name} for c in Category.objects.filter(is_active=True).order_by("name")]
    return JsonResponse({"results": data})
