import uuid

from django.db import migrations, models


def generate_codes(apps, schema_editor):
    ChatGroup = apps.get_model("chat", "ChatGroup")
    for group in ChatGroup.objects.all():
        group.code = uuid.uuid4().hex[:8]
        while ChatGroup.objects.filter(code=group.code).exclude(pk=group.pk).exists():
            group.code = uuid.uuid4().hex[:8]
        group.save()


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="chatgroup",
            name="code",
            field=models.CharField(blank=True, max_length=12, null=True),
        ),
        migrations.RunPython(generate_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="chatgroup",
            name="code",
            field=models.CharField(blank=True, max_length=12, unique=True),
        ),
    ]
