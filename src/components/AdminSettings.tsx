"use client";

import { useEffect, useState } from "react";
import { buildGenerationPrompt } from "@/lib/generate/prompt";
import { ringPolicyFrom, type RingCount, type RingPosition } from "@/lib/generate/ring-policy";

type Category = {
  id: string;
  slug: string;
  label: string;
  description: string;
  promptText: string;
  ringCount: RingCount;
  ringPosition: RingPosition;
  enforceRings: boolean;
  enabled: boolean;
  sortOrder: number;
  referenceIds: string[];
};

type Reference = {
  id: string;
  filename: string;
  writtenName: string | null;
  enabled: boolean;
  onePiece: boolean;
  warning: string | null;
  url: string;
  categoryIds: string[];
};

type Settings = {
  imageModel: string;
  quality: string;
  refCount: number;
  batches: number;
  nPerBatch: number;
  resolution: string;
  maxRetries: number;
  basePrompt: string;
  startingCredits: number;
  generationCost: number;
};

export function AdminSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [envDefaults, setEnvDefaults] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [technicalRules, setTechnicalRules] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newRingCount, setNewRingCount] = useState<RingCount>("two");
  const [newRingPosition, setNewRingPosition] = useState<RingPosition>("left");
  const [newEnforceRings, setNewEnforceRings] = useState(true);
  const [previewName, setPreviewName] = useState("Christopher");

  async function reload() {
    try {
      const [cat, ref, set] = await Promise.all([
        fetch("/api/admin/categories").then((r) => r.json()),
        fetch("/api/admin/references").then((r) => r.json()),
        fetch("/api/admin/settings").then((r) => r.json()),
      ]);
      if (set.error || !set.settings) {
        setError(set.error || "Ayarlar yüklenemedi");
        return;
      }
      setCategories(
        (cat.categories ?? []).map((row: Category) => ({
          ...row,
          ringCount: row.ringCount ?? "two",
          ringPosition: row.ringPosition ?? "left",
          enforceRings: row.enforceRings !== false,
        })),
      );
      setReferences(ref.references ?? []);
      setSettings({
        ...set.settings,
        startingCredits: set.settings.startingCredits ?? 60,
        generationCost: set.settings.generationCost ?? 3,
      });
      setEnvDefaults(set.envDefaults ?? null);
      setTechnicalRules(set.technicalRules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ayarlar yüklenemedi");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    const response = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Ayarlar kaydedilemedi");
      return;
    }
    setSettings(data.settings);
    setOk("Üretim ayarları kaydedildi.");
  }

  async function createCategory(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newLabel,
        description: newDescription,
        promptText: newPrompt,
        ringCount: newRingCount,
        ringPosition: newRingPosition,
        enforceRings: newEnforceRings,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Kategori eklenemedi");
      return;
    }
    setNewLabel("");
    setNewDescription("");
    setNewPrompt("");
    setNewRingCount("two");
    setNewRingPosition("left");
    setNewEnforceRings(true);
    await reload();
  }

  async function patchCategory(id: string, body: Partial<Category>) {
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await reload();
  }

  async function moveCategory(index: number, dir: -1 | 1) {
    const next = [...categories];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[swap]!;
    next[swap] = tmp;
    await fetch("/api/admin/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((row) => row.id) }),
    });
    await reload();
  }

  async function uploadRefs(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    const form = new FormData();
    for (const file of files) form.append("files", file);
    const response = await fetch("/api/admin/references", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Yükleme başarısız");
      return;
    }
    if (data.warnings?.length) setError(data.warnings.join(" "));
    else setOk(`${data.references.length} referans yüklendi.`);
    event.target.value = "";
    await reload();
  }

  async function patchReference(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/references/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await reload();
  }

  function categoryPreview(row: Pick<Category, "promptText" | "ringCount" | "ringPosition" | "enforceRings">) {
    if (!settings) return "";
    return buildGenerationPrompt({
      name: previewName.trim() || "Christopher",
      ornament: row.promptText,
      basePrompt: settings.basePrompt,
      ring: ringPolicyFrom(row),
      hasReferences: true,
    });
  }

  if (!settings) return <p className="hint">Ayarlar yükleniyor…</p>;

  return (
    <div>
      {error ? <p className="error">{error}</p> : null}
      {ok ? <p className="ok">{ok}</p> : null}

      <form className="panel" onSubmit={saveSettings}>
        <h2>Üretim ayarları</h2>
        <p className="hint">
          Env varsayılanları üzerine yazılır. Boş bırakılmaz; kaydettiğiniz değer canlı kullanılır.
          Env: model {envDefaults?.imageModel}, quality {envDefaults?.quality}, refs {envDefaults?.refCount},{" "}
          {envDefaults?.batches}×n={envDefaults?.nPerBatch}.
        </p>
        <label htmlFor="model">Model</label>
        <select
          id="model"
          value={settings.imageModel}
          onChange={(e) => setSettings({ ...settings, imageModel: e.target.value })}
        >
          <option value="grok-imagine-image-2.0">grok-imagine-image-2.0</option>
          <option value="grok-imagine-image">grok-imagine-image</option>
          <option value="grok-imagine-image-quality">grok-imagine-image-quality</option>
        </select>
        <label htmlFor="quality">Quality</label>
        <select
          id="quality"
          value={settings.quality}
          onChange={(e) => setSettings({ ...settings, quality: e.target.value })}
        >
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
        <label htmlFor="refCount">Referans sayısı / istek</label>
        <select
          id="refCount"
          value={settings.refCount}
          onChange={(e) => setSettings({ ...settings, refCount: Number(e.target.value) })}
        >
          <option value={0}>0 — text-only</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
        <div className="settings-grid">
          <div>
            <label htmlFor="batches">Batch</label>
            <input
              id="batches"
              type="number"
              min={1}
              max={8}
              value={settings.batches}
              onChange={(e) => setSettings({ ...settings, batches: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="nPer">n / batch</label>
            <input
              id="nPer"
              type="number"
              min={1}
              max={8}
              value={settings.nPerBatch}
              onChange={(e) => setSettings({ ...settings, nPerBatch: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="res">Çözünürlük</label>
            <select
              id="res"
              value={settings.resolution}
              onChange={(e) => setSettings({ ...settings, resolution: e.target.value })}
            >
              <option value="1k">1k</option>
              <option value="2k">2k</option>
            </select>
          </div>
          <div>
            <label htmlFor="retries">Max retry</label>
            <input
              id="retries"
              type="number"
              min={0}
              max={8}
              value={settings.maxRetries}
              onChange={(e) => setSettings({ ...settings, maxRetries: Number(e.target.value) })}
            />
          </div>
        </div>
        <div className="settings-grid">
          <div>
            <label htmlFor="startingCredits">Yeni hesap başlangıç kredisi</label>
            <input
              id="startingCredits"
              type="number"
              min={0}
              max={10000}
              value={settings.startingCredits}
              onChange={(e) => setSettings({ ...settings, startingCredits: Number(e.target.value) })}
            />
            <p className="hint">Kayıt olunca verilen miktar. 0 = yalnızca kod ile kredi.</p>
          </div>
          <div>
            <label htmlFor="generationCost">Üretim maliyeti (kredi)</label>
            <input
              id="generationCost"
              type="number"
              min={1}
              max={100}
              value={settings.generationCost}
              onChange={(e) => setSettings({ ...settings, generationCost: Number(e.target.value) })}
            />
            <p className="hint">Her isim üretiminde düşülür. Varsayılan 3.</p>
          </div>
        </div>
        <label htmlFor="basePrompt">Ortak temel prompt (her kategoriye eklenir)</label>
        <p className="hint">
          Stil, halka sayısı ve süs buraya yazılmaz. Bunlar kategori ayarındadır. Bu metin Grok’a her istekte gider.
        </p>
        <textarea
          id="basePrompt"
          rows={5}
          value={settings.basePrompt}
          onChange={(e) => setSettings({ ...settings, basePrompt: e.target.value })}
        />
        <div className="tech-rules">
          <p className="hint">
            Teknik doğrulama (kodda sabit; ürün stili değil — kapatılamaz):
          </p>
          <ul>
            {technicalRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <button className="btn btn-primary" type="submit">
          Ayarları kaydet
        </button>
      </form>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Kategoriler (stiller)</h2>
        <form onSubmit={createCategory}>
          <label htmlFor="cat-label">Yeni kategori adı (müşteriye gösterilir)</label>
          <input id="cat-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <label htmlFor="cat-desc">Kısa açıklama / önizleme (isteğe bağlı)</label>
          <input
            id="cat-desc"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Swash ve kıvrımlarda kalpler."
          />
          <label htmlFor="cat-prompt">Kategoriye özel prompt (stil / süs)</label>
          <textarea
            id="cat-prompt"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={3}
          />
          <div className="settings-grid">
            <div>
              <label htmlFor="new-ring-count">Halka</label>
              <select
                id="new-ring-count"
                value={newRingCount}
                onChange={(e) => setNewRingCount(e.target.value as RingCount)}
              >
                <option value="none">Yok</option>
                <option value="one">Bir</option>
                <option value="two">İki (uçlar)</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-ring-pos">Tek halka konumu</label>
              <select
                id="new-ring-pos"
                value={newRingPosition}
                disabled={newRingCount !== "one"}
                onChange={(e) => setNewRingPosition(e.target.value as RingPosition)}
              >
                <option value="left">Sol uç</option>
                <option value="right">Sağ uç</option>
                <option value="first-letter">İlk harf</option>
              </select>
            </div>
          </div>
          <label className="hint">
            <input
              type="checkbox"
              checked={newEnforceRings}
              onChange={(e) => setNewEnforceRings(e.target.checked)}
            />{" "}
            Halka kontrolünü zorla
          </label>
          <button className="btn btn-accent" type="submit" disabled={!newLabel.trim() || !newPrompt.trim()}>
            Kategori ekle
          </button>
        </form>
        <label htmlFor="preview-name">Örnek isim (son prompt önizlemesi)</label>
        <input
          id="preview-name"
          value={previewName}
          onChange={(e) => setPreviewName(e.target.value)}
        />
        <div className="category-list">
          {categories.map((row, index) => (
            <article className="category-card" key={row.id}>
              <div className="category-card-top">
                <div className="category-order">
                  <button className="btn btn-ghost btn-small" type="button" onClick={() => void moveCategory(index, -1)}>
                    ↑
                  </button>
                  <button className="btn btn-ghost btn-small" type="button" onClick={() => void moveCategory(index, 1)}>
                    ↓
                  </button>
                </div>
                <div>
                  <label>Ad</label>
                  <input
                    value={row.label}
                    onChange={(e) =>
                      setCategories((list) =>
                        list.map((item) => (item.id === row.id ? { ...item, label: e.target.value } : item)),
                      )
                    }
                    onBlur={() => void patchCategory(row.id, { label: row.label })}
                  />
                  <p className="hint">{row.slug}</p>
                </div>
                <div>
                  <label>Açıklama</label>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      setCategories((list) =>
                        list.map((item) =>
                          item.id === row.id ? { ...item, description: e.target.value } : item,
                        ),
                      )
                    }
                    onBlur={() => void patchCategory(row.id, { description: row.description })}
                  />
                </div>
                <label className="hint">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => void patchCategory(row.id, { enabled: e.target.checked })}
                  />{" "}
                  Açık
                </label>
                <button
                  className="btn btn-ghost btn-small"
                  type="button"
                  onClick={() => void fetch(`/api/admin/categories/${row.id}`, { method: "DELETE" }).then(reload)}
                >
                  Sil
                </button>
              </div>
              <label>Kategori promptu</label>
              <textarea
                rows={3}
                value={row.promptText}
                onChange={(e) =>
                  setCategories((list) =>
                    list.map((item) => (item.id === row.id ? { ...item, promptText: e.target.value } : item)),
                  )
                }
                onBlur={() => void patchCategory(row.id, { promptText: row.promptText })}
              />
              <div className="settings-grid">
                <div>
                  <label>Halka</label>
                  <select
                    value={row.ringCount}
                    onChange={(e) => void patchCategory(row.id, { ringCount: e.target.value as RingCount })}
                  >
                    <option value="none">Yok</option>
                    <option value="one">Bir</option>
                    <option value="two">İki (uçlar)</option>
                  </select>
                </div>
                <div>
                  <label>Tek halka konumu</label>
                  <select
                    value={row.ringPosition}
                    disabled={row.ringCount !== "one"}
                    onChange={(e) => void patchCategory(row.id, { ringPosition: e.target.value as RingPosition })}
                  >
                    <option value="left">Sol uç</option>
                    <option value="right">Sağ uç</option>
                    <option value="first-letter">İlk harf</option>
                  </select>
                </div>
              </div>
              <label className="hint">
                <input
                  type="checkbox"
                  checked={row.enforceRings}
                  onChange={(e) => void patchCategory(row.id, { enforceRings: e.target.checked })}
                />{" "}
                Halka kontrolünü zorla
              </label>
              <label>Grok’a gidecek tam metin ({previewName || "Christopher"})</label>
              <textarea className="prompt-preview" rows={7} readOnly value={categoryPreview(row)} />
            </article>
          ))}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Referans görseller</h2>
        <p className="hint">PNG/JPG yükleyin. Siyah-beyaza çekilir; tek parça değilse uyarı gösterilir.</p>
        <input type="file" accept="image/png,image/jpeg" multiple onChange={uploadRefs} />
        <div className="ref-grid">
          {references.map((ref) => (
            <article className="ref-card" key={ref.id}>
              <img alt={ref.filename} src={ref.url} />
              <label>Yazılı isim</label>
              <input
                value={ref.writtenName ?? ""}
                onChange={(e) =>
                  setReferences((list) =>
                    list.map((item) => (item.id === ref.id ? { ...item, writtenName: e.target.value } : item)),
                  )
                }
                onBlur={() => void patchReference(ref.id, { writtenName: ref.writtenName })}
                placeholder="merve"
              />
              <label className="hint">
                <input
                  type="checkbox"
                  checked={ref.enabled}
                  onChange={(e) => void patchReference(ref.id, { enabled: e.target.checked })}
                />{" "}
                Aktif
              </label>
              {ref.warning ? <p className="error">{ref.warning}</p> : null}
              <p className="hint">Kategoriler</p>
              {categories.map((cat) => (
                <label key={cat.id} className="hint">
                  <input
                    type="checkbox"
                    checked={ref.categoryIds.includes(cat.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...ref.categoryIds, cat.id]
                        : ref.categoryIds.filter((id) => id !== cat.id);
                      void patchReference(ref.id, { categoryIds: next });
                    }}
                  />{" "}
                  {cat.label}
                </label>
              ))}
              <button
                className="btn btn-ghost btn-small"
                type="button"
                onClick={() => void fetch(`/api/admin/references/${ref.id}`, { method: "DELETE" }).then(reload)}
              >
                Sil
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
