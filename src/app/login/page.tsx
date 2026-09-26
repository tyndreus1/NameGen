"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Giriş başarısız");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <strong>NameGen</strong>
          <span>Giriş</span>
        </a>
      </header>
      <form className="panel auth-wrap" onSubmit={onSubmit}>
        <h2>Giriş yap</h2>
        <label htmlFor="email">E-posta</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Şifre</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
        <p className="hint">
          Hesabınız yok mu? <a href="/register">Kayıt olun</a>
        </p>
      </form>
    </div>
  );
}
