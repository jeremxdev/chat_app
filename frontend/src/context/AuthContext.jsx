import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const API = "/api";

// Lit le token CSRF depuis le cookie Django
function getCSRFToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

// En-têtes par défaut pour les requêtes API avec CSRF
function csrfHeaders() {
  return { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Vérifie si l'utilisateur est déjà connecté via la session au chargement
  useEffect(() => {
    fetch(`${API}/auth/me/`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setUser(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Connexion admin (nom d'utilisateur + mot de passe)
  const login = async (username, password) => {
    const res = await fetch(`${API}/auth/login/`, {
      method: "POST",
      headers: csrfHeaders(),
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur de connexion");
    setUser(data);
    return data;
  };

  // Inscription d'un nouvel utilisateur (email + username + mot de passe)
  const register = async (email, username, password) => {
    const res = await fetch(`${API}/auth/register/`, {
      method: "POST",
      headers: csrfHeaders(),
      credentials: "include",
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur d'inscription");
    setUser(data);
    return data;
  };

  // Déconnexion : détruit la session côté serveur et vide l'état local
  const logout = async () => {
    await fetch(`${API}/auth/logout/`, {
      method: "POST",
      headers: csrfHeaders(),
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
