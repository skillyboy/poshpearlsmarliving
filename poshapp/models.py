from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify


class User(AbstractUser):
    phone_number = models.CharField(max_length=32, blank=True)
    company_name = models.CharField(max_length=120, blank=True)
    is_distributor = models.BooleanField(default=False)

    def __str__(self):
        return self.get_full_name() or self.username


class Category(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    sku = models.CharField(max_length=64, unique=True, blank=True)
    short_description = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=0, null=True, blank=True)
    compare_at_price = models.DecimalField(
        max_digits=12, decimal_places=0, null=True, blank=True
    )
    currency = models.CharField(max_length=3, default="NGN")
    stock_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=3)
    is_archived = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    categories = models.ManyToManyField(
        Category, related_name="products", blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_featured", "-created_at"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images"
    )
    image = models.ImageField(upload_to="products/")
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_primary", "display_order"]

    def __str__(self):
        return f"Image for {self.product.name}"


class ProductPriceTier(models.Model):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="price_tiers"
    )
    min_quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=0)
    currency = models.CharField(max_length=3, default="NGN")
    label = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["min_quantity"]

    def __str__(self):
        return f"{self.product.name} - {self.min_quantity}+ @ {self.price}"


class ContactSubmission(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=32, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Contact from {self.name} - {self.created_at}"


class Cart(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True
    )
    session_key = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.user:
            return f"Cart for {self.user.username}"
        return f"Guest cart {self.session_key}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)
    currency = models.CharField(max_length=3, default="NGN")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("cart", "product")

    def __str__(self):
        return f"Cart Item: {self.product.name} (Qty: {self.quantity})"

    @property
    def line_total(self):
        return self.quantity * self.unit_price


class Order(models.Model):
    STATUS_CHOICES = [
        ("new", "New"),
        ("processing", "Processing"),
        ("shipped", "Shipped"),
        ("delivered", "Delivered"),
        ("cancelled", "Cancelled"),
    ]
    PAYMENT_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    full_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=32)
    address = models.TextField()
    city = models.CharField(max_length=80, blank=True)
    state = models.CharField(max_length=80, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    shipping_cost = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    tax = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    currency = models.CharField(max_length=3, default="NGN")
    amount = models.DecimalField(
        max_digits=12, decimal_places=0, default=0, help_text="Final amount paid"
    )

    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="new")
    payment_status = models.CharField(
        max_length=32, choices=PAYMENT_STATUS_CHOICES, default="pending"
    )
    payment_reference = models.CharField(max_length=255, blank=True)
    payment_method = models.CharField(max_length=64, blank=True)

    notes = models.TextField(blank=True)

    confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    payment_confirmation_sent_at = models.DateTimeField(null=True, blank=True)
    internal_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.id} - {self.full_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=0)
    currency = models.CharField(max_length=3, default="NGN")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.product} x {self.quantity}"

    @property
    def line_total(self):
        return self.quantity * self.unit_price


class WholesaleInquiry(models.Model):
    """Model to capture B2B/wholesale partnership applications."""
    
    BUSINESS_TYPES = [
        ('retailer', 'Retailer/Shop Owner'),
        ('distributor', 'Distributor'),
        ('wholesaler', 'Wholesaler'),
        ('online', 'Online Store'),
        ('other', 'Other'),
    ]
    
    VOLUME_CHOICES = [
        ('10-49', '10-49 units'),
        ('50-99', '50-99 units'),
        ('100-299', '100-299 units'),
        ('300+', '300+ units'),
    ]
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('contacted', 'Contacted'),
    ]
    
    company_name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=32)
    business_address = models.TextField()
    business_type = models.CharField(max_length=32, choices=BUSINESS_TYPES)
    expected_volume = models.CharField(max_length=32, choices=VOLUME_CHOICES, blank=True)
    website = models.URLField(blank=True)
    message = models.TextField(blank=True)
    
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wholesale_inquiries',
        help_text='User account created if approved as distributor'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Wholesale Inquiries"

    def __str__(self):
        return f"{self.company_name} ({self.get_status_display()})"

class SiteSettings(models.Model):
    store_name = models.CharField(max_length=200, default="PoshPearl")
    support_email = models.EmailField(default="support@example.com")
    default_currency = models.CharField(max_length=3, default="NGN")
    low_stock_threshold = models.PositiveIntegerField(default=3)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name_plural = "Site Settings"

    def __str__(self):
        return "Site Settings"


class Wishlist(models.Model):
    """User's saved products for later purchase."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wishlist'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Wishlist for {self.user.username}"
    
    @property
    def item_count(self):
        return self.items.count()


class WishlistItem(models.Model):
    """Individual product in a wishlist."""
    wishlist = models.ForeignKey(
        Wishlist,
        on_delete=models.CASCADE,
        related_name='items'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE
    )
    added_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-added_at']
        unique_together = ('wishlist', 'product')
    
    def __str__(self):
        return f"{self.product.name} in {self.wishlist.user.username}'s wishlist"
