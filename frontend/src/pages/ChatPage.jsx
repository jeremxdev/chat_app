import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import EmojiPicker from "emoji-picker-react";

const API = "/api";
const WS_BASE = `ws://${window.location.host}/ws/chat`;

// Lit le token CSRF depuis le cookie Django
function getCSRFToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { code } = useParams();     // Code salon depuis l'URL (/chat/:code)

  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextMsg, setContextMsg] = useState(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const REACTIONS = [
    "👍", "❤️", "😂", "😮", "😢", "😡", "🔥", "🎉", "💯", "👏",
    "🥰", "🤣", "😍", "🙏", "💪", "✨", "🥳", "😎", "🤗", "😱",
    "🤔", "😴", "🥺", "😈", "🇫🇷"
  ];

  // Charge la liste des salons accessibles au démarrage
  useEffect(() => {
    fetch(`${API}/groups/`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setGroups)
      .catch(() => {});
  }, []);

  // Si l'URL contient un code salon, tente de rejoindre ce salon
  useEffect(() => {
    if (!code) return;
    setJoinLoading(true);
    setJoinError("");
    fetch(`${API}/groups/join-by-code/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
      credentials: "include",
      body: JSON.stringify({ code }),
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const text = await r.text().catch(() => "");
        let msg;
        try { const p = JSON.parse(text); msg = typeof p === "string" ? p : Object.values(p).flat().join(" "); } catch { msg = text || `Erreur ${r.status}`; }
        throw new Error(msg);
      })
      .then((group) => {
        setJoinLoading(false);
        setActiveGroup(group);
        setGroups((prev) => {
          if (prev.find((g) => g.id === group.id)) return prev;
          return [...prev, group];
        });
      })
      .catch((err) => {
        setJoinLoading(false);
        setJoinError(err.message);
      });
  }, [code]);

  // Charge les messages du salon actif (ou du général si aucun salon)
  useEffect(() => {
    const url = activeGroup
      ? `${API}/messages/?group=${activeGroup.id}`
      : `${API}/messages/`;
    fetch(url, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then(setMessages)
      .catch(() => {});
  }, [activeGroup]);

  // Ouvre une connexion WebSocket vers le salon actif pour les messages temps réel
  useEffect(() => {
    const groupId = activeGroup ? activeGroup.id : "";
    const url = groupId ? `${WS_BASE}/${groupId}/` : `${WS_BASE}/`;

    ws.current = new WebSocket(url);
    ws.current.onmessage = (event) => {
      if (!event.data) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === "reaction") {
        setMessages((prev) => prev.map((m) => {
          if (m.id !== data.message_id) return m;
          const reactions = [...(m.reactions || [])];
          const existing = reactions.find((r) => r.emoji === data.emoji);
          if (data.action === "removed") {
            if (existing && existing.count <= 1) {
              return { ...m, reactions: reactions.filter((r) => r.emoji !== data.emoji) };
            }
            return { ...m, reactions: reactions.map((r) =>
              r.emoji === data.emoji ? { ...r, count: r.count - 1, reacted: data.user_id === user?.id ? false : r.reacted } : r
            ) };
          }
          if (existing) {
            return { ...m, reactions: reactions.map((r) =>
              r.emoji === data.emoji ? { ...r, count: r.count + 1, reacted: data.user_id === user?.id ? true : r.reacted } : r
            ) };
          }
          return { ...m, reactions: [...reactions, { emoji: data.emoji, count: 1, reacted: data.user_id === user?.id }] };
        }));
        return;
      }
      setMessages((prev) => [...prev, data]);
    };
    ws.current.onerror = () => {};

    return () => ws.current?.close();
  }, [activeGroup]);

  // Ferme le menu contextuel au clic ailleurs
  useEffect(() => {
    if (!contextMsg) return;
    const close = () => setContextMsg(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [contextMsg]);

  // Scroll automatique vers le bas à l'arrivée d'un nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Envoie un message via WebSocket
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    ws.current.send(JSON.stringify({ message: input }));
    setInput("");
  };

  // Ajoute/retire une réaction sur un message
  const toggleReaction = async (msgId, emoji) => {
    setContextMsg(null);
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m;
      const reactions = [...(m.reactions || [])];
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing && existing.reacted) {
        if (existing.count <= 1) return { ...m, reactions: reactions.filter((r) => r.emoji !== emoji) };
        return { ...m, reactions: reactions.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
        ) };
      }
      if (existing) {
        return { ...m, reactions: reactions.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
        ) };
      }
      return { ...m, reactions: [...reactions, { emoji, count: 1, reacted: true }] };
    }));

    try {
      const res = await fetch(`${API}/messages/${msgId}/react/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCSRFToken(),
        },
        credentials: "include",
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) {
        // Revert on error
        setMessages((prev) => prev.map((m) => {
          if (m.id !== msgId) return m;
          const reactions = [...(m.reactions || [])];
          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing && existing.count <= 1) return { ...m, reactions: reactions.filter((r) => r.emoji !== emoji) };
          if (existing) return { ...m, reactions: reactions.map((r) =>
            r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
          ) };
          return m;
        }));
      }
    } catch {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = [...(m.reactions || [])];
        const existing = reactions.find((r) => r.emoji === emoji);
        if (existing && existing.count <= 1) return { ...m, reactions: reactions.filter((r) => r.emoji !== emoji) };
        if (existing) return { ...m, reactions: reactions.map((r) =>
          r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false } : r
        ) };
        return m;
      }));
    }
  };

  // Déconnexion : vide la session et retourne à l'accueil
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Crée un nouveau salon (appel API POST /api/groups/)
  const createGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const res = await fetch(`${API}/groups/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": getCSRFToken() },
      credentials: "include",
      body: JSON.stringify({
        name: newGroupName,
        description: newGroupDesc,
      }),
    });
    if (res.ok) {
      const group = await res.json();
      setGroups((prev) => [...prev, group]);
      setShowCreate(false);
      setNewGroupName("");
      setNewGroupDesc("");
    } else {
      const text = await res.text().catch(() => "");
      let msg;
      try { const parsed = JSON.parse(text); msg = typeof parsed === 'string' ? parsed : Object.values(parsed).flat().join(" "); } catch { msg = text || `Erreur ${res.status}`; }
      alert(msg);
    }
  };

  // Rejoint un salon existant
  const joinGroup = async (group) => {
    await fetch(`${API}/groups/${group.id}/join/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "include",
    });
    setActiveGroup(group);
  };

  // Quitte un salon
  const leaveGroup = async (group) => {
    await fetch(`${API}/groups/${group.id}/leave/`, {
      method: "POST",
      headers: { "X-CSRFToken": getCSRFToken() },
      credentials: "include",
    });
    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? { ...g, member_count: g.member_count - 1 }
          : g
      )
    );
    if (activeGroup?.id === group.id) setActiveGroup(null);
  };

  return (
    <div className="chat-layout">
      {/* ─── Barre latérale : liste des salons ─────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>ChatApp</h2>
          <div className="user-info">
            <span>{user?.nickname || user?.username}</span>
            {user?.is_admin && (
              <button
                className="btn-beige btn-sm"
                onClick={() => navigate("/admin")}
              >
                Admin
              </button>
            )}
            <button className="btn-danger btn-sm" onClick={handleLogout}>
              Quitter
            </button>
          </div>
        </div>

        <div className="sidebar-body">
          <div className="sidebar-section-title">
            <span>Salons</span>
            <button className="btn-beige btn-sm" onClick={() => setShowCreate(true)}>
              +
            </button>
          </div>

          {/* Salon général (pas de groupe) */}
          <div
            className={`group-item ${!activeGroup ? "active" : ""}`}
            onClick={() => setActiveGroup(null)}
          >
            <span className="group-icon">#</span>
            <span>Général</span>
          </div>

          {/* Liste des salons */}
          {groups.map((group) => (
            <div key={group.id} className="group-item-wrapper">
              <div
                className={`group-item ${activeGroup?.id === group.id ? "active" : ""}`}
                onClick={() => setActiveGroup(group)}
              >
                <span className="group-icon">#</span>
                <span>{group.name}</span>
                <span className="member-badge">{group.member_count}</span>
              </div>
              <button
                className="join-leave-btn"
                onClick={() =>
                  group.member_count > 0
                    ? leaveGroup(group)
                    : joinGroup(group)
                }
              >
                {group.member_count > 0 ? "✕" : "+"}
              </button>
            </div>
          ))}
        </div>
      </aside> 

      {/* ─── Zone principale : chat ────────────────────────── */}
      <main className="chat-main">
        <div className="chat-header">
          <h3>{activeGroup ? activeGroup.name : "Général"}</h3>
          {activeGroup?.description && (
            <p className="group-desc">{activeGroup.description}</p>
          )}
          {/* Affiche le code du salon pour le partager */}
          {activeGroup?.code && (
            <p className="group-code">
              Code : <code onClick={() => navigator.clipboard.writeText(activeGroup.code).catch(() => {})}>{activeGroup.code}</code>
              <button className="btn-copy" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/chat/${activeGroup.code}`)}>
                Copier le lien
              </button>
            </p>
          )}
        </div>

        {/* État de chargement lors de la jointure d'un salon via code */}
        {joinLoading && (
          <div className="join-status">
            <p>Connexion au salon...</p>
          </div>
        )}

        {/* Erreur si le code salon est invalide */}
        {joinError && (
          <div className="join-status join-error">
            <p>{joinError}</p>
            <button className="btn-primary btn-sm" onClick={() => { setJoinError(""); navigate("/chat"); }}>
              Retour au chat général
            </button>
          </div>
        )}

        {/* Liste des messages */}
        <div className="messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.user_id === user?.id ? "message--own" : ""}`}
              onContextMenu={(e) => {
                if (msg.user_id === user?.id) return;
                e.preventDefault();
                setContextMsg(msg.id);
                setContextPos({ x: e.clientX, y: e.clientY });
              }}
            >
              <strong className="msg-author">{msg.nickname || msg.user_nickname}:</strong>
              <span className="msg-text">{msg.message || msg.content}</span>
              {msg.timestamp && <span className="msg-date">{new Date(msg.timestamp).toLocaleString("fr-FR")}</span>}

              {/* Réactions existantes */}
              {msg.reactions?.length > 0 && (
                <div className="reactions-row">
                  {msg.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      className={`reaction-badge ${r.reacted ? "reacted" : ""}`}
                      onClick={() => toggleReaction(msg.id, r.emoji)}
                    >
                      {r.emoji} <span>{r.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Menu contextuel de réactions */}
        {contextMsg && (
          <div
            className="reaction-context"
            style={{ left: contextPos.x, top: contextPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                className="reaction-option"
                onClick={() => toggleReaction(contextMsg, emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Formulaire d'envoi de message */}
        <div className="message-form-wrapper">
          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  setInput((prev) => prev + emoji.emoji);
                  setShowEmojiPicker(false);
                }}
              />
            </div>
          )}
          <form onSubmit={sendMessage} className="message-form">
            <button
              type="button"
              className="btn-emoji"
              onClick={() => setShowEmojiPicker((v) => !v)}
              title="Emojis"
            >
              😊
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre message..."
              className="msg-input"
            />
            <button type="submit" className="btn-primary">
              Envoyer
            </button>
          </form>
        </div>
      </main>

      {/* ─── Modale de création de salon ───────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h3>Créer un salon</h3>
            <form onSubmit={createGroup}>
              <div className="form-group">
                <label>Nom du salon</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-danger" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary">
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .chat-layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }

        .sidebar {
          width: 280px;
          background: var(--green-medium);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .sidebar-header h2 {
          color: var(--beige);
          font-size: 22px;
          margin-bottom: 12px;
        }

        .user-info {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .user-info span {
          font-size: 14px;
          color: var(--beige-light);
          margin-right: auto;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 12px;
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .sidebar-section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 4px;
          font-weight: 600;
          color: var(--beige-light);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .group-item-wrapper {
          display: flex;
          align-items: center;
        }

        .group-item-wrapper .join-leave-btn {
          background: none;
          color: var(--beige);
          font-size: 12px;
          padding: 4px 6px;
          margin-left: auto;
          opacity: 0.6;
        }

        .group-item-wrapper .join-leave-btn:hover {
          opacity: 1;
        }

        .group-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          color: var(--beige-light);
          font-size: 14px;
          flex: 1;
          transition: background 0.2s;
        }

        .group-item:hover {
          background: rgba(255,255,255,0.08);
        }

        .group-item.active {
          background: rgba(255,255,255,0.15);
          color: var(--white);
          font-weight: 600;
        }

        .group-icon {
          font-weight: 700;
          opacity: 0.7;
        }

        .member-badge {
          margin-left: auto;
          background: rgba(255,255,255,0.12);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 11px;
        }

        .chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--beige-light);
        }

        .chat-header {
          padding: 16px 24px;
          background: var(--white);
          border-bottom: 2px solid var(--beige);
        }

        .chat-header h3 {
          color: var(--green-dark);
          font-size: 18px;
        }

        .group-desc {
          color: #666;
          font-size: 13px;
          margin-top: 4px;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message {
          background: var(--white);
          padding: 10px 16px;
          border-radius: 12px;
          max-width: 80%;
          align-self: flex-start;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          position: relative;
        }

        .message--own {
          background: #d4edda;
          align-self: flex-end;
        }

        .msg-author {
          color: var(--green-dark);
          margin-right: 8px;
        }

        .msg-text {
          color: var(--text-dark);
        }

        .msg-date {
          display: block;
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }

        .reactions-row {
          display: flex;
          gap: 4px;
          margin-top: 6px;
          flex-wrap: wrap;
        }

        .reaction-badge {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 2px 7px;
          border-radius: 12px;
          font-size: 13px;
          background: #f0f0f0;
          border: 1px solid transparent;
          cursor: pointer;
          transition: background 0.15s;
        }

        .reaction-badge:hover {
          background: #e0e0e0;
        }

        .reaction-badge.reacted {
          background: #d4edda;
          border-color: var(--green-medium);
        }

        .reaction-badge span {
          font-size: 11px;
          color: #666;
        }

        .reaction-context {
          position: fixed;
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
          padding: 8px 10px;
          max-width: 260px;
          background: var(--white);
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          z-index: 1000;
          transform: translate(-50%, 10px);
        }

        .reaction-option {
          font-size: 22px;
          padding: 4px;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.12s;
          background: none;
          border: none;
          line-height: 1;
        }

        .reaction-option:hover {
          transform: scale(1.35);
        }

        .message-form-wrapper {
          position: relative;
        }

        .emoji-picker-container {
          position: absolute;
          bottom: 100%;
          right: 24px;
          z-index: 10;
        }

        .message-form {
          display: flex;
          gap: 12px;
          padding: 16px 24px;
          background: var(--white);
          border-top: 2px solid var(--beige);
        }

        .btn-emoji {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
        }

        .msg-input {
          flex: 1;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          width: 100%;
          max-width: 440px;
        }

        .modal h3 {
          margin-bottom: 16px;
          color: var(--green-dark);
        }

        .modal .form-group {
          margin-bottom: 14px;
        }

        .modal .form-group label {
          display: block;
          margin-bottom: 4px;
          font-weight: 600;
          font-size: 13px;
          color: var(--green-dark);
        }

        .modal .form-group input,
        .modal .form-group textarea {
          width: 100%;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 16px;
        }

        .join-status {
          text-align: center;
          padding: 40px 24px;
          background: var(--white);
          margin: 20px;
          border-radius: 12px;
        }

        .join-status p {
          color: var(--text-dark);
          font-size: 15px;
          margin-bottom: 12px;
        }

        .join-status.join-error p {
          color: var(--danger);
        }

        .group-code {
          margin-top: 6px;
          font-size: 13px;
          color: #666;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .group-code code {
          background: var(--beige-light);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-copy {
          background: none;
          color: var(--green-medium);
          font-size: 12px;
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
