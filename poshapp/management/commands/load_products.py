from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand

from poshapp.models import Category, Product, ProductImage, ProductPriceTier


class Command(BaseCommand):
    help = "Load initial products for the shop."

    def handle(self, *args, **options):
        category, _ = Category.objects.get_or_create(
            slug="locks",
            defaults={"name": "Smart Locks", "description": "Premium smart locks"},
        )

        product, _ = Product.objects.get_or_create(
            sku="D2PRO-LOCK",
            defaults={
                "name": "D2pro Smart Lock",
                "short_description": (
                    "Distributor-ready smart lock with biometric access and remote control."
                ),
                "description": (
                    "Premium smart lock featuring 3D face recognition, palm vein unlocking, "
                    "video call support, and abnormal activity reminders. Built for secure, "
                    "high-traffic residential and commercial doors with app management."
                ),
                "price": 150000,
                "currency": "NGN",
                "stock_quantity": 100,
                "is_active": True,
                "is_featured": True,
            },
        )

        product.name = "D2pro Smart Lock"
        product.short_description = (
            "Distributor-ready smart lock with biometric access and remote control."
        )
        product.description = (
            "Premium smart lock featuring 3D face recognition, palm vein unlocking, "
            "video call support, and abnormal activity reminders. Built for secure, "
            "high-traffic residential and commercial doors with app management."
        )
        product.currency = "NGN"
        product.is_active = True
        product.is_featured = True
        product.save()
        product.categories.add(category)

        price_tiers = [
            {"min_quantity": 10, "price": 280000},
            {"min_quantity": 100, "price": 250000},
        ]
        for tier in price_tiers:
            ProductPriceTier.objects.update_or_create(
                product=product,
                min_quantity=tier["min_quantity"],
                defaults={
                    "price": tier["price"],
                    "currency": "NGN",
                    "label": "Distributor",
                },
            )

        images_dir = (
            Path(settings.BASE_DIR)
            / "poshapp"
            / "static"
            / "assets"
            / "images"
            / "products"
        )
        image_files = [
            "d2pro1.jpeg",
            "d2pro2.jpeg",
            "d2pro3.jpeg",
        ]

        for index, filename in enumerate(image_files):
            if product.images.filter(image__endswith=filename).exists():
                continue

            path = images_dir / filename
            if not path.exists():
                self.stdout.write(
                    self.style.WARNING(f"Missing image file: {path}")
                )
                continue

            with path.open("rb") as handle:
                ProductImage.objects.create(
                    product=product,
                    image=File(handle, name=filename),
                    alt_text=f"{product.name} image {index + 1}",
                    is_primary=index == 0,
                    sort_order=index,
                )

        self.stdout.write(self.style.SUCCESS("Loaded D2pro product data."))
