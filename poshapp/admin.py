from django.contrib import admin

from .models import Category, Product, ProductImage, ProductPriceTier


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
