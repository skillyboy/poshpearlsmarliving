from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("poshapp", "0007_order_confirmation_sent_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="product",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=3),
        ),
        migrations.AddField(
            model_name="order",
            name="internal_note",
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name="SiteSettings",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("store_name", models.CharField(default="PoshPearl", max_length=200)),
                ("support_email", models.EmailField(default="support@example.com", max_length=254)),
                ("default_currency", models.CharField(default="NGN", max_length=3)),
                ("low_stock_threshold", models.PositiveIntegerField(default=3)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
