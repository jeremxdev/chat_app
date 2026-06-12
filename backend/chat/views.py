from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import authenticate, login, logout
from django.db import models
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import ChatGroup, Message, Reaction, User
from .serializers import (
    ChatGroupSerializer,
    MessageSerializer,
    UserSerializer,
)


class IsAdmin(permissions.BasePermission):
    # Permission personnalisée : seul un admin peut accéder
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_admin


# ─── Vues d'authentification ─────────────────────────────────────


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def login_view(request):
    # Connexion admin par nom d'utilisateur / mot de passe
    username = request.data.get("username")
    password = request.data.get("password")
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        return Response(UserSerializer(user).data)
    return Response(
        {"error": "Identifiants invalides"}, status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    # Déconnexion : détruit la session
    logout(request)
    return Response({"success": "Déconnecté"})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def me(request):
    # Renvoie l'utilisateur connecté, ou une erreur 401 si anonyme
    if request.user.is_authenticated:
        return Response(UserSerializer(request.user).data)
    return Response({"error": "Non authentifié"}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@csrf_exempt
def register_view(request):
    # Inscription d'un nouvel utilisateur avec email, username et mot de passe
    email = request.data.get("email", "").strip()
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not email or not username or not password:
        return Response(
            {"error": "Email, nom d'utilisateur et mot de passe requis"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username__iexact=username).exists():
        return Response(
            {"error": "Ce nom d'utilisateur est déjà pris"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(email__iexact=email).exists():
        return Response(
            {"error": "Cet email est déjà utilisé"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        nickname=username,
    )
    login(request, user)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


# ─── ViewSets (API REST) ─────────────────────────────────────────


class UserViewSet(viewsets.ModelViewSet):
    # CRUD des utilisateurs (admin seulement)
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]


class ChatGroupViewSet(viewsets.ModelViewSet):
    # CRUD des salons + actions personnalisées (join, leave, members, join-by-code)
    queryset = ChatGroup.objects.all()
    serializer_class = ChatGroupSerializer

    def get_permissions(self):
        # La modification et la suppression sont réservées aux admins
        if self.action in ["destroy", "update", "partial_update"]:
            return [IsAdmin()]
        # Les autres actions d'écriture nécessitent une authentification
        if self.action in ["create"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        # À la création, le créateur devient automatiquement membre du salon
        group = serializer.save(created_by=self.request.user)
        group.members.add(self.request.user)

    def get_queryset(self):
        # Un utilisateur connecté voit ses salons + les salons publics
        # Un visiteur ne voit que les salons publics
        # Un admin voit tous les salons
        user = self.request.user
        if user.is_authenticated and user.is_admin:
            return ChatGroup.objects.all()
        if user.is_authenticated:
            return ChatGroup.objects.filter(
                models.Q(members=user) | models.Q(is_private=False)
            ).distinct()
        return ChatGroup.objects.filter(is_private=False)

    @action(detail=True, methods=["post"])
    def join(self, request, pk=None):
        # Rejoint un salon par son ID
        group = self.get_object()
        group.members.add(request.user)
        return Response({"success": f"Rejoint {group.name}"})

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        # Quitte un salon par son ID
        group = self.get_object()
        group.members.remove(request.user)
        return Response({"success": f"Quitté {group.name}"})

    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        # Liste les membres d'un salon
        group = self.get_object()
        return Response(UserSerializer(group.members.all(), many=True).data)

    @action(detail=False, methods=["post"], url_path="join-by-code")
    def join_by_code(self, request):
        # Rejoint un salon via son code partagé (ex: /chat/abc12345)
        code = request.data.get("code", "")
        group = get_object_or_404(ChatGroup, code=code)
        group.members.add(request.user)
        return Response(ChatGroupSerializer(group, context={"request": request}).data)


class MessageViewSet(viewsets.ModelViewSet):
    # CRUD des messages : lecture par salon, création via WebSocket
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filtre les messages par groupe, ou renvoie ceux du général
        group_id = self.request.query_params.get("group")
        if group_id:
            return Message.objects.filter(group_id=group_id)
        return Message.objects.filter(group__isnull=True)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def react(self, request, pk=None):
        # Ajoute ou retire une réaction (émoji) sur un message (toggle)
        message = self.get_object()
        if message.user == request.user:
            return Response({"error": "Vous ne pouvez pas réagir à vos propres messages"}, status=status.HTTP_403_FORBIDDEN)

        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            return Response({"error": "Emoji requis"}, status=status.HTTP_400_BAD_REQUEST)

        reaction, created = Reaction.objects.get_or_create(
            message=message, user=request.user, emoji=emoji
        )
        action_type = "added" if created else "removed"
        if not created:
            reaction.delete()

        # Broadcast en temps réel via WebSocket
        group_name = f"chat_{message.group_id}" if message.group_id else "chat_general"
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "reaction_update",
                "message_id": message.id,
                "emoji": emoji,
                "user_id": request.user.id,
                "action": action_type,
            },
        )

        return Response({"action": action_type})
