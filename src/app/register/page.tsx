"use client";

import { useEffect, useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startingCredits, setStartingCredits] = useState(60);
  const [generationCost, setGenerationCost] = useState(3);

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((data) => {
        if (typeof data.credits?.startingCredits === "number") {
          setStartingCredits(data.credits.startingCredits);
        }
        if (typeof data.credits?.generationCost === "number") {
          setGenerationCost(data.credits.generationCost);
        }
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "Kayıt başarısız");
      return;
    }
    window.location.href = "/";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <strong>NameGen</strong>
          <span>Kayıt</span>
        </a>
      </header>
      <form className="panel auth-wrap" onSubmit={onSubmit}>
        <h2>Kayıt ol</h2>
        <p className="hint">
          {startingCredits > 0
            ? `Yeni hesap ${startingCredits} kredi ile başlar.`
            : "Yeni hesap kredi almaz; kod ile yükleme gerekir."}{" "}
          Her üretim {generationCost} kredi.
        </p>
        <label htmlFor="email">E-posta</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Şifre (en az 8 karakter)</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Kaydediliyor…" : "Hesap oluştur"}
        </button>
        <p className="hint">
          Zaten hesabınız var mı? <a href="/login">Giriş yapın</a>
        </p>
      </form>
    </div>
  );
}
