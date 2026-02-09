from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Cart,
    CartItem,
    Category,
    Order,
    OrderItem,
    Product,
    ProductImage,
    ProductPriceTier,
    User,
    WholesaleInquiry,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class ProductPriceTierInline(admin.TabularInline):
    model = ProductPriceTier
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "sku",
        "price",
        "stock_quantity",
        "is_active",
        "is_featured",
        "updated_at",
    )
    list_filter = ("is_active", "is_featured", "categories")
    search_fields = ("name", "sku", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline, ProductPriceTierInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(User)
class UserAdminConfig(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Business details", {"fields": ("phone_number", "company_name", "is_distributor")}),
    )
    list_display = ("username", "email", "is_staff", "is_distributor")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "session_key", "updated_at")
    search_fields = ("user__username", "session_key")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "product", "quantity", "unit_price", "currency", "updated_at")
    search_fields = ("cart__id", "product__name")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.action(description="Mark selected orders as processing")
def mark_processing(modeladmin, request, queryset):
    queryset.update(status="processing")


@admin.action(description="Mark selected orders as fulfilled")
def mark_fulfilled(modeladmin, request, queryset):
    queryset.update(status="fulfilled")


@admin.action(description="Mark selected orders as cancelled")
def mark_cancelled(modeladmin, request, queryset):
    queryset.update(status="cancelled")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "email",
        "status",
        "payment_status",
        "payment_reference",
        "subtotal",
        "created_at",
    )
    list_filter = ("status", "payment_status", "created_at")
    search_fields = ("full_name", "email", "phone")
    inlines = [OrderItemInline]
    actions = [mark_processing, mark_fulfilled, mark_cancelled]


@admin.register(WholesaleInquiry)
class WholesaleInquiryAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'contact_name', 'email', 'business_type', 'expected_volume', 'status', 'created_at']
    list_filter = ['status', 'business_type', 'expected_volume', 'created_at']
    search_fields = ['company_name', 'contact_name', 'email', 'phone']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Company Information', {
            'fields': ('company_name', 'business_type', 'business_address', 'website')
        }),
        ('Contact Information', {
            'fields': ('contact_name', 'email', 'phone')
        }),
        ('Business Details', {
            'fields': ('expected_volume', 'message')
        }),
        ('Status', {
            'fields': ('status', 'user')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
