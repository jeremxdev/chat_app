from django.contrib import admin

from .models import AccessCode, ChatGroup, Message, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ["username", "nickname", "is_admin", "is_active"]
    list_filter = ["is_admin", "is_active"]


@admin.register(AccessCode)
class AccessCodeAdmin(admin.ModelAdmin):
    list_display = ["code", "is_active", "created_at"]
    list_filter = ["is_active"]


@admin.register(ChatGroup)
class ChatGroupAdmin(admin.ModelAdmin):
    list_display = ["name", "created_by", "is_private", "created_at"]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["user", "group", "content", "timestamp"]
