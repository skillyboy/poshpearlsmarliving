from django.urls import path
from django.views.generic import RedirectView

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("shop.html", RedirectView.as_view(url="/products/", permanent=False, query_string=True)),
    path("shop/", RedirectView.as_view(url="/products/", permanent=False, query_string=True), name="shop"),
    path("shop/<slug:slug>/", RedirectView.as_view(pattern_name="product_detail_products", permanent=False)),
    path("products/", views.products, name="products"),
    path("products/<slug:slug>/", views.product_detail, name="product_detail_products"),
    path("cart/", views.cart_view, name="cart"),
    path("checkout/", views.checkout, name="checkout"),
    path("payments/initialize/", views.payment_initialize, name="payment_initialize"),
    path("payments/callback/", views.payment_callback, name="payment_callback"),
    path("payments/webhook/", views.payment_webhook, name="payment_webhook"),
    path("track-order/", views.track_order, name="track_order"),
    path("support/", views.support, name="support"),
    path("contact/", views.contact, name="contact"),
    # User dashboard
    path("account/", views.dashboard_view, name="dashboard"),
    path("account/orders/", views.user_orders_view, name="user_orders"),
    path("account/orders/<int:order_id>/", views.user_order_detail_view, name="user_order_detail"),
    # Info pages
    path("about/", views.about_view, name="about"),
    path("faq/", views.faq_view, name="faq"),
    path("privacy/", views.privacy_view, name="privacy"),
    path("terms/", views.terms_view, name="terms"),
    path("pricing/", views.pricing_view, name="pricing"),
    path("wholesale/", views.wholesale_view, name="wholesale"),
    path("404/", views.not_found_view, name="not_found_preview"),
    path("smart-features/", views.smart_features_view, name="smart_features"),
    # Wishlist
    path("wishlist/", views.wishlist_view, name="wishlist"),
    path("wishlist/api/items/", views.wishlist_api_items, name="wishlist_api_items"),
    path("wishlist/api/add/", views.wishlist_api_add, name="wishlist_api_add"),
    path("wishlist/api/remove/", views.wishlist_api_remove, name="wishlist_api_remove"),
    path("wishlist/api/add-all-to-cart/", views.wishlist_api_add_all_to_cart, name="wishlist_api_add_all_to_cart"),
    # Payment result pages
    path("payments/success/", views.payment_success_view, name="payment_success"),
    path("payments/failed/", views.payment_failed_view, name="payment_failed"),
]
