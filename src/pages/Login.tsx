import React, { useState } from "react";
import { useStore } from "../state/store";

/**
 * Invite-based onboarding. Accounts are local in the prototype; the flow
 * (username + invite code) mirrors what a real backend would enforce.
 */
export default function Login() {
  const { login, register, users } = useStore();
  const [mode, setMode] = useState<"login" | "register">(users.length ? "login" : "register");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "login") {
      if (!login(username)) setError("No account with that username on this device. Try creating one.");
    } else {
      const err = register(username, displayName, invite);
      if (err) setError(err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="row" style={{ justifyContent: "center", marginBottom: 18, gap: 12 }}>
          <img src="/icons/icon.svg" alt="" style={{ width: 46, height: 46, borderRadius: 12 }} />
          <div>
            <h1 style={{ fontSize: 24 }}>Market Mentor</h1>
            <div className="muted small">Learn the market while you scan it.</div>
          </div>
        </div>

        <form className="card stack" onSubmit={submit} style={{ padding: 22 }}>
          <div className="seg" style={{ alignSelf: "center" }}>
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
          </div>

          <label className="field">
            Username
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. daniel" autoFocus />
          </label>

          {mode === "register" && (
            <>
              <label className="field">
                Display name
                <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How friends see you" />
              </label>
              <label className="field">
                Invite code
                <input className="input" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="e.g. MENTOR-FRIENDS" />
                <span className="faint" style={{ fontWeight: 400 }}>
                  Market Mentor is invite-only for you and your friends. First time here? Use <b>MENTOR-FRIENDS</b>.
                </span>
              </label>
            </>
          )}

          {error && <div className="small" style={{ color: "var(--down)" }}>{error}</div>}

          <button className="btn primary" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>

        <p className="faint" style={{ textAlign: "center", marginTop: 16, lineHeight: 1.5 }}>
          Educational and analytical software — not financial advice.<br />
          This prototype uses simulated market data.
        </p>
      </div>
    </div>
  );
}
