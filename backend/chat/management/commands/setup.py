from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Crée l'administrateur par défaut"

    def handle(self, *args, **options):
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser(
                username="admin",
                email="admin@chatapp.local",
                password="admin123",
                nickname="Admin",
                is_admin=True,
            )
            self.stdout.write(self.style.SUCCESS("Admin créé (admin / admin123)"))
        else:
            self.stdout.write("L'utilisateur admin existe déjà")
