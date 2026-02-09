from django import forms
from django.core.exceptions import ValidationError

import re


class CheckoutForm(forms.Form):
    full_name = forms.CharField(
        max_length=120,
        widget=forms.TextInput(attrs={"class": "pp-input", "placeholder": "Full name"}),
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={"class": "pp-input", "placeholder": "Email address"})
    )
    phone = forms.CharField(
        max_length=32,
        widget=forms.TextInput(attrs={"class": "pp-input", "placeholder": "+234 800 123 4567"}),
    )
    address = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 3, "class": "pp-textarea", "placeholder": "Delivery address"})
    )
    notes = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"rows": 3, "class": "pp-textarea", "placeholder": "Order notes (optional)"}),
    )

    def clean_phone(self):
        value = self.cleaned_data.get("phone", "")
        digits = re.sub(r"\D+", "", value)
        if len(digits) < 7:
            raise ValidationError("Enter a valid phone number.")
        return value

    def clean_address(self):
        value = (self.cleaned_data.get("address") or "").strip()
        if len(value) < 8:
            raise ValidationError("Enter a full delivery address.")
        return value


class OrderTrackingForm(forms.Form):
    order_number = forms.IntegerField(
        min_value=1,
        label="Order number",
        widget=forms.NumberInput(
            attrs={"class": "pp-input", "placeholder": "e.g. 10021"}
        ),
    )
    email = forms.EmailField(
        label="Email address",
        widget=forms.EmailInput(
            attrs={"class": "pp-input", "placeholder": "you@example.com"}
        ),
    )
