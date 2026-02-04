import hashlib
import hmac
import json
from unittest.mock import patch

from django.test import TestCase, override_settings

from .models import Category, Order, Product, ProductPriceTier


class ApiTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(
            name="Smart Locks", slug="locks", description="Premium smart locks"
        )
        self.product = Product.objects.create(
            name="D2Pro Test Product",
            sku="D2PRO-TEST",
            short_description="Test product for API checks.",
            description="Temporary product used for API smoke tests.",
            price=280000,
            currency="NGN",
            stock_quantity=10,
            is_active=True,
        )
        self.product.categories.add(self.category)
        self.tiered_product = Product.objects.create(
            name="Bulk Smart Lock",
            sku="BULK-LOCK",
            short_description="Wholesale smart lock",
            description="Bulk-ready lock with tier pricing.",
            price=None,
            currency="NGN",
            stock_quantity=0,
            is_active=True,
        )
        self.tiered_product.categories.add(self.category)
        ProductPriceTier.objects.create(
            product=self.tiered_product,
            min_quantity=10,
            price=200000,
            currency="NGN",
            label="Wholesale",
        )

    def test_products_list(self):
        response = self.client.get("/api/products")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(any(item["id"] == self.product.id for item in data))

        response = self.client.get("/api/products", {"category": self.category.slug})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(
            all(
                self.category.slug in [c["slug"] for c in item["categories"]]
                for item in data
            )
        )

    def test_product_detail(self):
        response = self.client.get(f"/api/products/{self.product.id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], self.product.id)

    def test_categories_list(self):
        response = self.client.get("/api/categories")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(any(item["id"] == self.category.id for item in data))

    def test_cart_flow(self):
        response = self.client.get("/api/cart")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["items"], [])

        payload = json.dumps({"product_id": self.product.id, "quantity": 2})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["items"][0]["quantity"], 2)

        item_id = data["items"][0]["id"]
        payload = json.dumps({"quantity": 1})
        response = self.client.patch(
            f"/api/cart/items/{item_id}",
            data=payload,
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["items"][0]["quantity"], 1)

        response = self.client.delete(f"/api/cart/items/{item_id}")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["items"], [])

        response = self.client.delete("/api/cart")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["items"], [])

    def test_cart_validation(self):
        payload = json.dumps({"product_id": self.product.id, "quantity": 0})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

        payload = json.dumps({"product_id": self.tiered_product.id, "quantity": 1})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

    def test_checkout(self):
        checkout_payload = json.dumps(
            {
                "full_name": "Test Buyer",
                "email": "test@example.com",
                "phone": "08000000000",
                "address": "Abuja, Nigeria",
                "notes": "Test order",
            }
        )
        response = self.client.post(
            "/api/checkout", data=checkout_payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

        payload = json.dumps({"product_id": self.product.id, "quantity": 1})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            "/api/checkout", data=checkout_payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["subtotal"], 280000)
        self.assertTrue(Order.objects.filter(id=data["id"]).exists())

    @override_settings(PAYSTACK_SECRET_KEY="test_secret")
    @patch("poshapp.api.initialize_paystack_transaction")
    def test_payment_init(self, mock_init):
        mock_init.return_value = {
            "authorization_url": "https://paystack.test/redirect",
            "reference": "ref123",
        }
        payload = json.dumps({"product_id": self.product.id, "quantity": 1})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        checkout_payload = json.dumps(
            {
                "full_name": "Paystack Buyer",
                "email": "pay@example.com",
                "phone": "08000000000",
                "address": "Abuja, Nigeria",
                "notes": "",
            }
        )
        response = self.client.post(
            "/api/payments/init", data=checkout_payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["reference"], "ref123")
        order = Order.objects.get(id=data["order_id"])
        self.assertEqual(order.payment_status, "pending")

    @override_settings(PAYSTACK_SECRET_KEY="webhook_secret")
    def test_payment_webhook(self):
        order = Order.objects.create(
            full_name="Webhook Buyer",
            email="webhook@example.com",
            phone="08000000000",
            address="Abuja",
            subtotal=280000,
            amount=280000,
            currency="NGN",
            payment_status="pending",
            payment_reference="ref-webhook",
        )
        payload = json.dumps(
            {
                "event": "charge.success",
                "data": {"reference": "ref-webhook", "amount": 28000000, "currency": "NGN"},
            }
        ).encode("utf-8")
        signature = hmac.new(
            b"webhook_secret", payload, hashlib.sha512
        ).hexdigest()
        response = self.client.post(
            "/payments/webhook/",
            data=payload,
            content_type="application/json",
            **{"HTTP_X_PAYSTACK_SIGNATURE": signature},
        )
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")

    @override_settings(PAYSTACK_SECRET_KEY="test_secret")
    @patch("poshapp.views.verify_paystack_transaction")
    def test_payment_callback(self, mock_verify):
        order = Order.objects.create(
            full_name="Callback Buyer",
            email="callback@example.com",
            phone="08000000000",
            address="Abuja",
            subtotal=280000,
            amount=280000,
            currency="NGN",
            payment_status="pending",
            payment_reference="ref-callback",
        )
        mock_verify.return_value = {
            "status": True,
            "data": {
                "status": "success",
                "reference": "ref-callback",
                "amount": 28000000,
                "currency": "NGN",
            },
        }
        response = self.client.get("/payments/callback/?reference=ref-callback")
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, "paid")

    @patch("poshapp.views.initialize_paystack_transaction")
    def test_payment_initialize_view(self, mock_init):
        mock_init.return_value = {
            "authorization_url": "https://paystack.test/redirect",
            "reference": "ref-checkout",
        }
        payload = json.dumps({"product_id": self.product.id, "quantity": 1})
        response = self.client.post(
            "/api/cart/items", data=payload, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)

        form_payload = {
            "full_name": "Checkout Buyer",
            "email": "buyer@example.com",
            "phone": "08000000000",
            "address": "Abuja, Nigeria",
            "notes": "",
        }
        response = self.client.post("/payments/initialize/", data=form_payload)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://paystack.test/redirect")

        order = Order.objects.get(payment_reference="ref-checkout")
        self.assertEqual(order.payment_status, "pending")
