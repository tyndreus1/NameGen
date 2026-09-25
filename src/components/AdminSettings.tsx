"use client";

import { useEffect, useState } from "react";

type Category = {
  id: string;
  slug: string;
  label: string;
  description: string;
  promptText: string;
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
};

export function AdminSettings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [envDefaults, setEnvDefaults] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrompt, setNewPrompt] = useState("");

  async function reload() {
    const [cat, ref, set] = await Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/references").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
    ]);
    setCategories(cat.categories ?? []);
    setReferences(ref.references ?? []);
    setSettings(set.settings ?? null);
    setEnvDefaults(set.envDefaults ?? null);
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
          <label htmlFor="cat-prompt">Grok süs / stil cümlesi</label>
          <textarea
            id="cat-prompt"
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            rows={3}
          />
          <button className="btn btn-accent" type="submit" disabled={!newLabel.trim() || !newPrompt.trim()}>
            Kategori ekle
          </button>
        </form>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Ad</th>
                <th>Açıklama</th>
                <th>Prompt</th>
                <th>Açık</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <button className="btn btn-ghost btn-small" type="button" onClick={() => void moveCategory(index, -1)}>
                      ↑
                    </button>
                    <button className="btn btn-ghost btn-small" type="button" onClick={() => void moveCategory(index, 1)}>
                      ↓
                    </button>
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
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
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => void patchCategory(row.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-small"
                      type="button"
                      onClick={() => void fetch(`/api/admin/categories/${row.id}`, { method: "DELETE" }).then(reload)}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
