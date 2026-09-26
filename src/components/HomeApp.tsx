"use client";

import { useEffect, useMemo, useState } from "react";

type User = { id: string; email: string; credits: number } | null;
type Design = {
  index: number;
  engine: "deterministic" | "grok";
  fallback?: boolean;
  png: string;
  svg: string;
};
type CatalogStyle = {
  slug: string;
  label: string;
  description: string;
  thumbUrl: string | null;
};

export function HomeApp({
  user,
  startingCredits,
  generationCost: initialCost,
}: {
  user: User;
  startingCredits: number;
  generationCost: number;
}) {
  const [credits, setCredits] = useState(user?.credits ?? 0);
  const [generationCost, setGenerationCost] = useState(initialCost);
  const [welcomeCredits, setWelcomeCredits] = useState(startingCredits);
  const [name, setName] = useState("Merve");
  const [styles, setStyles] = useState<CatalogStyle[]>([]);
  const [style, setStyle] = useState("classic");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemOk, setRedeemOk] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/catalog")
      .then((response) => response.json())
      .then((data) => {
        const rows = (data.categories ?? []) as CatalogStyle[];
        setStyles(rows);
        if (rows.length && !rows.some((row) => row.slug === style)) {
          setStyle(rows[0]!.slug);
        }
        if (data.credits?.generationCost) setGenerationCost(data.credits.generationCost);
        if (typeof data.credits?.startingCredits === "number") {
          setWelcomeCredits(data.credits.startingCredits);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!redeemOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRedeemOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redeemOpen]);

  // Display-only gate. The server charges via generationCharge() + spend(); never trust this.
  const canGenerate = Boolean(user) && credits >= generationCost && name.trim().length > 0;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setDesigns([]);
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
          ? `Grok image-to-image: ${data.grokAccepted} tasarım doğrulandı${
              data.fallbackCount ? `, ${data.fallbackCount} yedek font` : ""
            }.${typeof data.apiCostUsd === "number" ? ` API ~$${Number(data.apiCostUsd).toFixed(3)}` : ""}`
          : "xAI anahtarı yok veya Grok doğrulamayı geçemedi; yedek font üretici kullanıldı.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Üretim başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function redeem(event: React.FormEvent) {
    event.preventDefault();
    setRedeemError(null);
    setRedeemOk(null);
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    if (!response.ok) {
      setRedeemError(data.error || "Kod kullanılamadı");
      return;
    }
    setCredits(data.credits);
    setCode("");
    setRedeemOk(`+${data.added} kredi yüklendi.`);
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
              <button
                type="button"
                className="credits-pill"
                title="Kod girerek kredi yükle"
                onClick={() => {
                  setRedeemOpen(true);
                  setRedeemError(null);
                  setRedeemOk(null);
                }}
              >
                {credits} kredi <span className="credits-plus">+</span>
              </button>
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
            {styles.map((item) => (
              <button
                key={item.slug}
                type="button"
                className={`style-btn ${style === item.slug ? "active" : ""}`}
                onClick={() => setStyle(item.slug)}
              >
                {item.thumbUrl ? <img alt="" className="style-thumb" src={item.thumbUrl} /> : null}
                <span>{item.label}</span>
                {item.description ? <small>{item.description}</small> : null}
              </button>
            ))}
          </div>

          <p className="hint">
            Her üretim {generationCost} kredi düşer ve 4 alternatif verir. Yazım, yazdığınız gibi
            korunur (ç, ğ, ı, ö, ş, ü dahil).
          </p>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-accent" disabled={!canGenerate || busy} type="submit">
            {busy ? "Üretiliyor…" : `${previewName} için tasarla (${generationCost} kredi)`}
          </button>
          {!user ? (
            <p className="hint">
              Üretmek için giriş yapın.
              {welcomeCredits > 0
                ? ` Yeni hesap ${welcomeCredits} kredi ile başlar.`
                : " Yeni hesap kredi almaz; kod ile yükleme gerekir."}
            </p>
          ) : null}
          {user && credits < generationCost ? (
            <p className="error">Yetersiz kredi. Üstteki kredi rozetine tıklayarak kod yükleyin.</p>
          ) : null}
        </form>

        <aside className="panel results-panel" aria-live="polite">
          <h2>Sonuçlar</h2>
          {busy ? (
            <p className="hint">Üretiliyor… 4 tasarım bu kartta görünecek.</p>
          ) : null}
          {message && !busy ? <p className="ok">{message}</p> : null}
          {!busy && designs.length === 0 ? (
            <p className="hint">
              Henüz tasarım yok. Soldan bir isim ve stil seçip üretin; 4 sonuç burada, alt alta
              görünür.
            </p>
          ) : null}
          {designs.length > 0 ? (
            <div className="results">
              {designs.map((design) => (
                <article className="design-card" key={design.index}>
                  <img
                    alt={`${previewName} tasarım ${design.index + 1}`}
                    src={`data:image/png;base64,${design.png}`}
                  />
                  <div className="design-meta">
                    <span className="hint" style={{ margin: 0 }}>
                      #{design.index + 1} · {design.engine === "grok" ? "Grok" : "Yedek (font)"}
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
          ) : null}
        </aside>
      </div>

      {redeemOpen ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setRedeemOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="redeem-title">
            <div className="modal-head">
              <h2 id="redeem-title">Kod gir</h2>
              <button className="btn btn-ghost btn-small" type="button" onClick={() => setRedeemOpen(false)}>
                Kapat
              </button>
            </div>
            <p className="hint">Yöneticiden aldığınız 60 / 120 / 240 kredilik kodu bir kez kullanın.</p>
            <form onSubmit={redeem}>
              <label htmlFor="code">Kod</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="NG60-XXXX-XXXX-XXXX-XXXXXXXX"
                autoFocus
              />
              {redeemError ? <p className="error">{redeemError}</p> : null}
              {redeemOk ? <p className="ok">{redeemOk}</p> : null}
              <button className="btn btn-primary" type="submit" disabled={!code.trim()}>
                Krediyi yükle
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <p className="footer">
        Asıl üretici Grok image-to-image’dir; font yolu yalnızca doğrulama 3 denemede
        başarısız olursa yedek olarak kullanılır. Teslim edilen her tasarım tek bağlı siyah
        parçadır.
      </p>
    </div>
  );
}
