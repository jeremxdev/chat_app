from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"users", views.UserViewSet)
router.register(r"groups", views.ChatGroupViewSet)
router.register(r"messages", views.MessageViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("auth/me/", views.me, name="me"),
    path("auth/register/", views.register_view, name="register"),
]
