"use client";

import { useMemo, useState } from "react";
import { GENERATION_COST, STYLE_LABELS, STYLES, type StyleId } from "@/lib/constants";

type User = { id: string; email: string; credits: number } | null;
type Design = {
  index: number;
  engine: "deterministic" | "grok";
  png: string;
  svg: string;
};

export function HomeApp({ user }: { user: User }) {
  const [credits, setCredits] = useState(user?.credits ?? 0);
  const [name, setName] = useState("Merve");
  const [style, setStyle] = useState<StyleId>("classic");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);

  const canGenerate = Boolean(user) && credits >= GENERATION_COST && name.trim().length > 0;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, style }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Üretim başarısız");
      setCredits(data.credits);
      setDesigns(data.designs);
      setMessage(
        data.usedGrok
          ? "Grok görselleri doğrulanıp tek parça haline getirildi."
          : "Deterministik vektör üretici kullanıldı (doğru yazım + tek parça).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Üretim başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Kod kullanılamadı");
      return;
    }
    setCredits(data.credits);
    setCode("");
    setMessage(`+${data.added} kredi yüklendi.`);
  }

  const previewName = useMemo(() => name.trim() || "isim", [name]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <strong>NameGen</strong>
          <span>Lazer kesim isim kolyesi</span>
        </a>
        <nav className="nav">
          {user ? (
            <>
              <div className="credits-pill">{credits} kredi</div>
              <span className="hint" style={{ margin: 0 }}>
                {user.email}
              </span>
              <button className="btn btn-ghost btn-small" onClick={logout} type="button">
                Çıkış
              </button>
            </>
          ) : (
            <>
              <a className="btn btn-ghost btn-small" href="/login">
                Giriş yap
              </a>
              <a className="btn btn-primary btn-small" href="/register">
                Kayıt ol
              </a>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <h1>İsminizi tek parça bir kolyeye dönüştürün.</h1>
        <p>
          Kalın, akıcı script; birleşik harfler; uçlarda zincir halkaları. Her tasarım lazer
          kesime uygun, saf siyah-beyaz PNG ve SVG olarak iner.
        </p>
      </section>

      <div className="grid">
        <form className="panel" onSubmit={generate}>
          <h2>Tasarım oluştur</h2>
          <label htmlFor="name">İsim</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={18}
            placeholder="Merve, Zeynep, Şükrü…"
            autoComplete="off"
          />

          <label>Stil</label>
          <div className="styles">
            {STYLES.map((id) => (
              <button
                key={id}
                type="button"
                className={`style-btn ${style === id ? "active" : ""}`}
                onClick={() => setStyle(id)}
              >
                {STYLE_LABELS[id]}
              </button>
            ))}
          </div>

          <p className="hint">
            Her üretim {GENERATION_COST} kredi düşer ve 4 alternatif verir. Yazım, yazdığınız gibi
            korunur (ç, ğ, ı, ö, ş, ü dahil).
          </p>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="ok">{message}</p> : null}
          <button className="btn btn-accent" disabled={!canGenerate || busy} type="submit">
            {busy ? "Üretiliyor…" : `${previewName} için tasarla (${GENERATION_COST} kredi)`}
          </button>
          {!user ? <p className="hint">Üretmek için giriş yapın. Yeni hesap 60 kredi ile başlar.</p> : null}
          {user && credits < GENERATION_COST ? (
            <p className="error">Yetersiz kredi. Aşağıdan kod girerek yükleme yapabilirsiniz.</p>
          ) : null}
        </form>

        <aside className="panel">
          <h2>Kod gir</h2>
          <p className="hint">Yöneticiden aldığınız 60 / 120 / 240 kredilik kodu bir kez kullanın.</p>
          <form onSubmit={redeem}>
            <label htmlFor="code">Kod</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="NG60-XXXX-XXXX-XXXX-XXXXXXXX"
              disabled={!user}
            />
            <button className="btn btn-primary" type="submit" disabled={!user || !code.trim()}>
              Krediyi yükle
            </button>
          </form>
        </aside>
      </div>

      {designs.length > 0 ? (
        <section>
          <div className="results">
            {designs.map((design) => (
              <article className="design-card" key={design.index}>
                <img
                  alt={`${previewName} tasarım ${design.index + 1}`}
                  src={`data:image/png;base64,${design.png}`}
                />
                <div className="design-meta">
                  <span className="hint" style={{ margin: 0 }}>
                    #{design.index + 1} · {design.engine === "grok" ? "Grok + doğrulama" : "Vektör"}
                  </span>
                  <div className="downloads">
                    <a
                      className="btn btn-ghost btn-small"
                      download={`${previewName}-${design.index + 1}.png`}
                      href={`data:image/png;base64,${design.png}`}
                    >
                      PNG
                    </a>
                    <a
                      className="btn btn-primary btn-small"
                      download={`${previewName}-${design.index + 1}.svg`}
                      href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(design.svg)}`}
                    >
                      SVG
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <p className="footer">
        Çıktılar tek bağlı siyah parça olacak şekilde kontrol edilir. Kopuk adalar birleştirilir
        veya silinir; aksi halde tasarım teslim edilmez.
      </p>
    </div>
  );
}
