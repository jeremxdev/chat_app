import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "chatapp_backend.settings")

from chat import consumers

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": AuthMiddlewareStack(
            URLRouter(
                [
                    path("ws/chat/<int:group_id>/", consumers.ChatConsumer.as_asgi()),
                    path("ws/chat/", consumers.ChatConsumer.as_asgi()),
                ]
            )
        ),
    }
)
