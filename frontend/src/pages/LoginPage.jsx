import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");     // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Connexion avec nom d'utilisateur et mot de passe
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  // Inscription d'un nouveau compte
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await register(email, username, password);
      navigate("/chat");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>ChatApp</h1>
          <p>Connectez-vous pour rejoindre la discussion</p>
        </div>

        <div className="login-tabs">
          <button
            className={`tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Connexion
          </button>
          <button
            className={`tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            Inscription
          </button>
        </div>

        {mode === "login" ? (
          // Formulaire de connexion
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="form-group">
              <label>Nom d'utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre nom d'utilisateur"
                required
              />
            </div>
            <div className="form-group">
              <label>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary btn-full">
              Se connecter
            </button>
          </form>
        ) : (
          // Formulaire d'inscription
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="form-group">
              <label>Adresse email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Nom d'utilisateur</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choisissez un nom d'utilisateur unique"
                required
              />
            </div>
            <div className="form-group">
              <label>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                minLength={4}
              />
            </div>
            <div className="form-group">
              <label>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
              />
            </div>
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn-primary btn-full">
              Créer mon compte
            </button>
          </form>
        )}
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .login-container {
          width: 100%;
          max-width: 420px;
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-header h1 {
          font-size: 42px;
          color: var(--beige);
          margin-bottom: 8px;
        }
        .login-header p {
          color: var(--beige-light);
          opacity: 0.8;
        }
        .login-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 24px;
          background: var(--white);
          border-radius: 10px;
          overflow: hidden;
        }
        .tab {
          flex: 1;
          padding: 14px;
          background: transparent;
          color: var(--text-dark);
          font-size: 14px;
          border-radius: 0;
        }
        .tab.active {
          background: var(--green-medium);
          color: var(--white);
        }
        .login-form {
          background: var(--white);
          border-radius: 12px;
          padding: 28px;
        }
        .form-group {
          margin-bottom: 18px;
        }
        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: var(--text-dark);
          font-size: 14px;
        }
        .form-group input {
          width: 100%;
        }
        .btn-full {
          width: 100%;
          margin-top: 8px;
        }
        .error {
          color: var(--danger);
          font-size: 13px;
          margin-bottom: 10px;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          font-size: 18px;
          color: var(--beige);
        }
      `}</style>
    </div>
  );
}
