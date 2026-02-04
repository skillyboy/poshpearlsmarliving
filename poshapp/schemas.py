from typing import List, Optional

from ninja import Schema


class CategoryOut(Schema):
    id: int
    name: str
    slug: str
    description: str


class ProductImageOut(Schema):
    url: str
    alt_text: str
    is_primary: bool


class ProductPriceTierOut(Schema):
    min_quantity: int
    price: int
    currency: str
    label: Optional[str] = None


class ProductOut(Schema):
    id: int
    name: str
    slug: str
    sku: str
    short_description: str
    description: str
    price: Optional[int] = None
    compare_at_price: Optional[int] = None
    currency: str
    stock_quantity: int
    is_featured: bool
    categories: List[CategoryOut]
    images: List[ProductImageOut]
    price_tiers: List[ProductPriceTierOut]


class CartItemIn(Schema):
    product_id: int
    quantity: int = 1


class CartItemUpdate(Schema):
    quantity: int


class CartItemOut(Schema):
    id: int
    product_id: int
    name: str
    quantity: int
    unit_price: int
    currency: str
    line_total: int
    image: Optional[str] = None


class CartOut(Schema):
    id: int
    items: List[CartItemOut]
    subtotal: int
    currency: str


class CheckoutIn(Schema):
    full_name: str
    email: str
    phone: str
    address: str
    notes: Optional[str] = None


class PaymentInitOut(Schema):
    order_id: int
    reference: str
    authorization_url: str


class OrderItemOut(Schema):
    product_id: int
    name: str
    quantity: int
    unit_price: int
    currency: str
    line_total: int


class OrderOut(Schema):
    id: int
    items: List[OrderItemOut]
    subtotal: int
    currency: str
    payment_status: str
