from django.db import transaction
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import ensure_csrf_cookie

from .forms import CheckoutForm
from .models import Order, OrderItem, Product
from .cart import cart_summary, get_cart


@ensure_csrf_cookie
def home(request):
    return render(request, "index.html")


@ensure_csrf_cookie
def shop(request):
    products = (
        Product.objects.prefetch_related("images", "price_tiers", "categories")
        .filter(is_active=True)
        .order_by("-updated_at", "name")
    )
    product = products.first()
    return render(request, "shop.html", {"product": product, "products": products})


@ensure_csrf_cookie
def product_detail(request, slug):
    base_queryset = (
        Product.objects.prefetch_related("images", "price_tiers", "categories")
        .filter(is_active=True)
        .order_by("-updated_at", "name")
    )
    product = get_object_or_404(base_queryset, slug=slug)
    products = base_queryset.exclude(id=product.id)
    return render(request, "shop.html", {"product": product, "products": products})


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
        form = CheckoutForm(request.POST)
        if form.is_valid():
            with transaction.atomic():
                order = Order.objects.create(
                    user=request.user if request.user.is_authenticated else None,
                    full_name=form.cleaned_data["full_name"],
                    email=form.cleaned_data["email"],
                    phone=form.cleaned_data["phone"],
                    address=form.cleaned_data["address"],
                    notes=form.cleaned_data.get("notes", ""),
                    subtotal=summary["subtotal"],
                    currency=summary["currency"],
                )
                for item in cart.items.select_related("product"):
                    OrderItem.objects.create(
                        order=order,
                        product=item.product,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        currency=item.currency,
                    )
                cart.items.all().delete()
            return render(
                request,
                "checkout.html",
                {"cart": summary, "form": CheckoutForm(), "order": order},
            )
    else:
        form = CheckoutForm()

    return render(
        request,
        "checkout.html",
        {"cart": summary, "form": form},
    )


@ensure_csrf_cookie
def support(request):
    return render(request, "support.html")


@ensure_csrf_cookie
def contact(request):
    return render(request, "contact.html")
