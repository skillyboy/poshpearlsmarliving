from pathlib import Path

from django.conf import settings
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
                "price": 320000,
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
        product.price = 320000
        product.currency = "NGN"
        product.is_active = True
        product.is_featured = True
        product.save()
        product.categories.add(category)

        price_tiers = [
            {"min_quantity": 1, "price": 320000},
            {"min_quantity": 20, "price": 280000},
        ]
        for tier in price_tiers:
            ProductPriceTier.objects.update_or_create(
                product=product,
                min_quantity=tier["min_quantity"],
                defaults={
                    "price": tier["price"],
                    "currency": "NGN",
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
        media_dir = Path(settings.MEDIA_ROOT) / "products"
        media_dir.mkdir(parents=True, exist_ok=True)
        image_files = [
            "d2pro1.jpeg",
            "d2pro2.jpeg",
            "d2pro3.jpeg",
        ]

        for image in list(product.images.all()):
            image_path = Path(settings.MEDIA_ROOT) / image.image.name
            if not image.image.name or not image_path.exists():
                image.delete()

        for index, filename in enumerate(image_files):
            path = images_dir / filename
            if not path.exists():
                self.stdout.write(
                    self.style.WARNING(f"Missing image file: {path}")
                )
                continue

            media_path = media_dir / filename
            if not media_path.exists():
                media_path.write_bytes(path.read_bytes())

            image_name = f"products/{filename}"
            if product.images.filter(image=image_name).exists():
                continue

            ProductImage.objects.create(
                product=product,
                image=image_name,
                alt_text=f"{product.name} image {index + 1}",
                is_primary=index == 0,
                display_order=index,
            )

        self.stdout.write(self.style.SUCCESS("Loaded D2pro product data."))
