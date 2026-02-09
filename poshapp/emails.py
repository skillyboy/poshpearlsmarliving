from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone


def _send_email(subject, template_name, context, recipient):
    try:
        body = render_to_string(template_name, context).strip()
        send_mail(
            subject,
            body,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            fail_silently=False,
        )
        return True
    except Exception:
        return False


def send_order_received_email(order):
    if order.confirmation_sent_at:
        return False
    context = {
        "order": order,
        "items": order.items.select_related("product"),
        "site_url": settings.SITE_URL,
    }
    sent = _send_email(
        f"Order #{order.id} received",
        "emails/order_received.txt",
        context,
        order.email,
    )
    if sent:
        order.confirmation_sent_at = timezone.now()
        order.save(update_fields=["confirmation_sent_at"])
    return sent


def send_payment_confirmed_email(order):
    if order.payment_confirmation_sent_at:
        return False
    context = {
        "order": order,
        "items": order.items.select_related("product"),
        "site_url": settings.SITE_URL,
    }
    sent = _send_email(
        f"Payment confirmed for order #{order.id}",
        "emails/order_paid.txt",
        context,
        order.email,
    )
    if sent:
        order.payment_confirmation_sent_at = timezone.now()
        order.save(update_fields=["payment_confirmation_sent_at"])
    return sent


def send_welcome_new_user_email(user, order, password_reset_url):
    """Send welcome email to auto-created users with password reset link."""
    context = {
        "user": user,
        "order": order,
        "items": order.items.select_related("product"),
        "site_url": settings.SITE_URL,
        "password_reset_url": password_reset_url,
    }
    sent = _send_email(
        f"Welcome to PoshPearl - Order #{order.id} Received",
        "emails/welcome_new_user.txt",
        context,
        user.email,
    )
    if sent:
        order.confirmation_sent_at = timezone.now()
        order.save(update_fields=["confirmation_sent_at"])
    return sent
