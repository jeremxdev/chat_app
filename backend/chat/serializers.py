from rest_framework import serializers

from .models import ChatGroup, Message, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "nickname", "is_admin", "date_joined"]
        read_only_fields = ["id", "date_joined"]


class ChatGroupSerializer(serializers.ModelSerializer):
    # Compte le nombre de membres du groupe (champ calculé)
    member_count = serializers.SerializerMethodField()
    # Expose le nom du créateur en lecture seule
    created_by_username = serializers.CharField(source="created_by.username", read_only=True)

    class Meta:
        model = ChatGroup
        fields = [
            "id", "name", "description", "code", "created_by", "created_by_username",
            "members", "is_private", "created_at", "member_count",
        ]
        read_only_fields = ["id", "code", "created_by", "created_at", "member_count", "members"]

    def get_member_count(self, obj):
        return obj.members.count()


class MessageSerializer(serializers.ModelSerializer):
    # Expose le pseudo de l'utilisateur directement dans le message
    user_nickname = serializers.CharField(source="user.nickname", read_only=True)
    user_id = serializers.IntegerField(source="user.id", read_only=True)

    class Meta:
        model = Message
        fields = [
            "id", "user", "user_id", "user_nickname",
            "group", "content", "timestamp",
        ]
        read_only_fields = ["id", "user", "timestamp"]
