from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("poshapp", "0008_admin_upgrade"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="sitesettings",
            options={"ordering": ["-updated_at"], "verbose_name_plural": "Site Settings"},
        ),
    ]
