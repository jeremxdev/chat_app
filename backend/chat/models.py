import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # Utilisateur personnalisé avec pseudo et statut admin
    is_admin = models.BooleanField(default=False)
    nickname = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "chat_user"

    def __str__(self):
        return self.nickname or self.username


class AccessCode(models.Model):
    # Code d'accès pour permettre à des invités de se connecter
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_access_code"

    def __str__(self):
        return self.code


class ChatGroup(models.Model):
    # Salon de discussion. Chaque salon a un code unique partageable.
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    code = models.CharField(max_length=12, unique=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_groups"
    )
    members = models.ManyToManyField(User, related_name="chat_groups")
    is_private = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_group"

    def save(self, *args, **kwargs):
        # Génère un code unique de 8 caractères si aucun n'est défini
        if not self.code:
            self.code = uuid.uuid4().hex[:8]
            while ChatGroup.objects.filter(code=self.code).exclude(pk=self.pk).exists():
                self.code = uuid.uuid4().hex[:8]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Message(models.Model):
    # Message envoyé dans un salon ou dans le chat général (group=null)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages")
    group = models.ForeignKey(
        ChatGroup, on_delete=models.CASCADE, related_name="messages", null=True, blank=True
    )
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_message"
        ordering = ["timestamp"]

    def __str__(self):
        return f"{self.user.nickname}: {self.content[:50]}"
