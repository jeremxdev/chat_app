import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import Message


class ChatConsumer(AsyncWebsocketConsumer):
    # Consumer WebSocket : gère la connexion temps réel par salon

    async def connect(self):
        # Récupère l'utilisateur et l'ID du salon depuis l'URL (ws/chat/<id>/ ou ws/chat/)
        self.user = self.scope["user"]
        self.group_id = self.scope["url_route"]["kwargs"].get("group_id")
        if self.group_id:
            self.room_group_name = f"chat_{self.group_id}"
        else:
            self.room_group_name = "chat_general"

        # Rejoint le groupe de salle (channel layer) pour recevoir les messages
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        # Quitte le groupe à la déconnexion
        await self.channel_layer.group_discard(
            self.room_group_name, self.channel_name
        )

    async def receive(self, text_data):
        # Réception d'un message : sauvegarde en BDD + diffusion aux autres clients
        data = json.loads(text_data)
        content = data.get("message", "")
        if not content.strip():
            return
        nickname = self.user.nickname if self.user.is_authenticated else "Anonymous"

        # Persiste le message en base de données
        msg = await self.save_message(content)
        if msg is None:
            return

        # Diffuse le message à tous les clients connectés au même salon
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "id": msg.id,
                "message": msg.content,
                "nickname": nickname,
                "user_id": self.user.id if self.user.is_authenticated else 0,
                "timestamp": msg.timestamp.isoformat(),
            },
        )

    async def chat_message(self, event):
        # Envoie le message au client WebSocket (format JSON)
        await self.send(
            text_data=json.dumps(
                {
                    "id": event["id"],
                    "content": event["message"],
                    "nickname": event["nickname"],
                    "user_id": event["user_id"],
                    "timestamp": event.get("timestamp"),
                }
            )
        )

    @database_sync_to_async
    def save_message(self, content):
        # Sauvegarde synchrone du message en base, appelée depuis un contexte async
        if not self.user.is_authenticated:
            return None
        group_id = int(self.group_id) if self.group_id else None
        return Message.objects.create(
            user=self.user,
            group_id=group_id,
            content=content,
        )
