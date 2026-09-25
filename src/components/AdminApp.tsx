"use client";

import { useEffect, useState } from "react";
import { CODE_VALUES, type CodeValue } from "@/lib/constants";

type CodeRow = {
  id: string;
  code: string;
  credits: number;
  createdAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
};

export function AdminApp({ unlocked }: { unlocked: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<CodeValue>(60);
  const [count, setCount] = useState(1);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [created, setCreated] = useState<string[]>([]);

  async function loadCodes() {
    const response = await fetch("/api/admin/codes");
    if (!response.ok) return;
    const data = await response.json();
    setCodes(data.codes);
  }

  useEffect(() => {
    if (unlocked) {
      void loadCodes();
    }
  }, [unlocked]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Giriş başarısız");
      return;
    }
    window.location.reload();
  }

  async function createCodes(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits, count }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Kod üretilemedi");
      return;
    }
    setCreated(data.codes.map((row: { code: string }) => row.code));
    await loadCodes();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  if (!unlocked) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="/">
            <strong>NameGen</strong>
            <span>Yönetici</span>
          </a>
        </header>
        <form className="panel auth-wrap" onSubmit={login}>
          <h2>Yönetici girişi</h2>
          <label htmlFor="admin-pass">Yönetici şifresi</label>
          <input
            id="admin-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit">
            Giriş
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <strong>NameGen</strong>
          <span>Kod üretimi</span>
        </a>
        <button className="btn btn-ghost btn-small" onClick={logout} type="button">
          Yönetici çıkışı
        </button>
      </header>

      <form className="panel" onSubmit={createCodes}>
        <h2>Yeni kod üret</h2>
        <label htmlFor="credits">Kredi</label>
        <select
          id="credits"
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) as CodeValue)}
        >
          {CODE_VALUES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label htmlFor="count">Adet</label>
        <input
          id="count"
          type="number"
          min={1}
          max={25}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-accent" type="submit">
          Kod oluştur
        </button>
        {created.length > 0 ? (
          <div>
            <p className="ok">Yeni kodlar:</p>
            {created.map((value) => (
              <p key={value}>
                <code>{value}</code>
              </p>
            ))}
          </div>
        ) : null}
      </form>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Üretilen / kullanılan kodlar</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kod</th>
                <th>Kredi</th>
                <th>Durum</th>
                <th>Kullanan</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code>{row.code}</code>
                  </td>
                  <td>{row.credits}</td>
                  <td>{row.redeemedAt ? "Kullanıldı" : "Bekliyor"}</td>
                  <td>{row.redeemedBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
