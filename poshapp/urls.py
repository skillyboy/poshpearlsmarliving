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
    path("health/", views.health, name="health"),
    path("accounts/signup/", views.signup_view, name="signup"),
    path("accounts/logout/", views.logout_view, name="logout"),
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
    # Admin lite UI
    path("poshadmin/", views.poshadmin_view, name="poshadmin"),
    # Admin JSON APIs (staff only)
    path("poshadmin/api/products/", views.poshadmin_api_products, name="poshadmin_api_products"),
    path("poshadmin/api/products/create/", views.poshadmin_api_product_create, name="poshadmin_api_product_create"),
    path("poshadmin/api/products/<int:pk>/", views.poshadmin_api_product_update, name="poshadmin_api_product_update"),
    path("poshadmin/api/products/<int:pk>/status/", views.poshadmin_api_product_status, name="poshadmin_api_product_status"),
    path("poshadmin/api/products/<int:pk>/images/", views.poshadmin_api_product_images_upload, name="poshadmin_api_product_images_upload"),
    path("poshadmin/api/products/<int:pk>/images/order/", views.poshadmin_api_product_images_order, name="poshadmin_api_product_images_order"),
    path("poshadmin/api/products/<int:pk>/images/<int:image_id>/", views.poshadmin_api_product_images_delete, name="poshadmin_api_product_images_delete"),
    path("poshadmin/api/orders/", views.poshadmin_api_orders, name="poshadmin_api_orders"),
    path("poshadmin/api/customers/", views.poshadmin_api_customers, name="poshadmin_api_customers"),
    path("poshadmin/api/settings/", views.poshadmin_api_settings, name="poshadmin_api_settings"),
    path("poshadmin/api/orders/<int:pk>/", views.poshadmin_api_order_update, name="poshadmin_api_order_update"),
    path("poshadmin/api/orders/<int:pk>/resend/", views.poshadmin_api_order_resend, name="poshadmin_api_order_resend"),
    path("poshadmin/api/customers/<int:pk>/status/", views.poshadmin_api_customer_status, name="poshadmin_api_customer_status"),
    path("poshadmin/api/categories/", views.poshadmin_api_categories, name="poshadmin_api_categories"),
]
