import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = "/api";

function getCSRFToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);

  // Utilitaire : fetch GET avec gestion d'erreur silencieuse
  const fetchData = async (url, setter) => {
    try {
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) setter(await res.json());
    } catch {}
  };

  // Charge les données au montage
  useEffect(() => {
    fetchData(`${API}/users/`, setUsers);
    fetchData(`${API}/groups/`, setGroups);
  }, []);

  // Supprime un utilisateur (sauf les admins)
  const deleteUser = async (id) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await fetch(`${API}/users/${id}/`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "include",
    });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // Supprime un salon
  const deleteGroup = async (id) => {
    if (!confirm("Supprimer ce groupe ?")) return;
    await fetch(`${API}/groups/${id}/`, {
      method: "DELETE",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "include",
    });
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Administration</h1>
        <div className="admin-header-actions">
          <span>{user?.nickname || user?.username}</span>
          <button className="btn-beige btn-sm" onClick={() => navigate("/chat")}>
            Retour au chat
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button
          className={`tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          Utilisateurs
        </button>
        <button
          className={`tab ${tab === "groups" ? "active" : ""}`}
          onClick={() => setTab("groups")}
        >
          Salons
        </button>
      </div>

      <div className="admin-content">
        {/* ─── Onglet Utilisateurs ─────────────────────── */}
        {tab === "users" && (
          <div className="card">
            <h3>Utilisateurs ({users.length})</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Pseudo</th>
                  <th>Email</th>
                  <th>Admin</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.nickname || u.username}</td>
                    <td>{u.email || "—"}</td>
                    <td>{u.is_admin ? "✓" : "✗"}</td>
                    <td>{new Date(u.date_joined).toLocaleDateString()}</td>
                    <td>
                      {!u.is_admin && (
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => deleteUser(u.id)}
                        >
                          Supprimer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Onglet Salons ──────────────────────────── */}
        {tab === "groups" && (
          <div className="card">
            <h3>Salons ({groups.length})</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Description</th>
                  <th>Membres</th>
                  <th>Créé par</th>
                  <th>Créé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{g.name}</strong></td>
                    <td>{g.description || "—"}</td>
                    <td>{g.member_count}</td>
                    <td>{g.created_by_username || "—"}</td>
                    <td>{new Date(g.created_at).toLocaleString("fr-FR")}</td>
                    <td>
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => deleteGroup(g.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: var(--green-dark);
          padding: 20px;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1000px;
          margin: 0 auto 24px;
        }

        .admin-header h1 {
          color: var(--beige);
          font-size: 28px;
        }

        .admin-header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--beige-light);
          font-size: 14px;
        }

        .admin-tabs {
          display: flex;
          gap: 8px;
          max-width: 1000px;
          margin: 0 auto 20px;
        }

        .admin-tabs .tab {
          padding: 10px 24px;
          background: var(--white);
          color: var(--text-dark);
          border-radius: 8px;
          font-size: 14px;
        }

        .admin-tabs .tab.active {
          background: var(--green-medium);
          color: var(--white);
        }

        .admin-content {
          max-width: 1000px;
          margin: 0 auto;
        }

        .admin-content .card h3 {
          margin-bottom: 16px;
          color: var(--green-dark);
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        .admin-table th {
          text-align: left;
          padding: 10px 12px;
          border-bottom: 2px solid var(--beige);
          color: var(--green-dark);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .admin-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #e8e0d0;
        }

        .actions-cell {
          display: flex;
          gap: 6px;
        }

        .inline-form {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }

        .inline-form input {
          flex: 1;
        }
      `}</style>
    </div>
  );
}
