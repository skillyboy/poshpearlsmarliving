from django.shortcuts import render

from .models import Product

def home(request):
    product = (
        Product.objects.prefetch_related("images", "price_tiers")
        .filter(is_active=True)
        .first()
    )
    return render(request, "shop.html", {"product": product})
