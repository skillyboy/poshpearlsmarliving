from django.urls import path
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("shop.html", RedirectView.as_view(url="/shop/", permanent=False, query_string=True)),
    path("shop/", views.shop, name="shop"),
    path("shop/<slug:slug>/", views.product_detail, name="product_detail"),
    path("cart/", views.cart_view, name="cart"),
    path("checkout/", views.checkout, name="checkout"),
    path("payments/initialize/", views.payment_initialize, name="payment_initialize"),
    path("payments/callback/", views.payment_callback, name="payment_callback"),
    path("payments/webhook/", views.payment_webhook, name="payment_webhook"),
    path("support/", views.support, name="support"),
    path("contact/", views.contact, name="contact"),
]
