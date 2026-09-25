# NameGen

Lazer kesim isim kolyesi / pendant tasarımları üreten bir web uygulaması. Müşteri bir isim yazar, stil seçer ve birbirine bağlı (tek parça) siyah-beyaz tasarımlar indirir: PNG ve SVG.

## Yaklaşım

**Asıl üretici Grok image-to-image’dir.** Font yolu yalnızca son çare yedektir. Strateji env ile kod değiştirmeden ayarlanır (maliyet: her input referansı da faturalanır; 2.0 + 2 ref ≈ $0.08/görsel).

Varsayılan: `XAI_IMAGE_MODEL=grok-imagine-image-2.0`, `XAI_REF_COUNT=1`, `XAI_RESOLUTION=1k`, `XAI_MAX_RETRIES=2`.

1. **Grok (birincil)**  
   İhtiyaç duyulan görseller **tek istekte `n` ile** alınır. Doğrulamayı geçmeyen slot’lar için sonraki tur `n = kalan` olur (`XAI_MAX_RETRIES` ekstra tur, varsayılan 2).

   - `XAI_REF_COUNT=1` veya `2` → `POST https://api.x.ai/v1/images/edits` JSON body (multipart / OpenAI SDK çalışmaz). Tek ref’te `image`, iki ref’te `images[]`.
   - `XAI_REF_COUNT=0` → `POST https://api.x.ai/v1/images/generations` (text-only). Stil metni [`prompts/style-description.md`](prompts/style-description.md) dosyasındandır; sonradan değiştirilebilir.

   ```json
   {
     "model": "grok-imagine-image-2.0",
     "prompt": "...",
     "image": { "url": "data:image/png;base64,...", "type": "image_url" },
     "aspect_ratio": "5:2",
     "n": 4,
     "response_format": "b64_json",
     "resolution": "1k"
   }
   ```

   `XAI_RESOLUTION=2k` lazer kalitesi PNG (~3200×1280, daha pahalı). Model: `grok-imagine-image` | `grok-imagine-image-2.0` | `grok-imagine-image-quality`.

   Referanslar [assets/references/](assets/references/): hedef isimle aynı ref yok; kelebek stili `sophia.png` içerir. Prompt şablonu `src/lib/generate/prompt.ts`.

   Doğrulama: S/B, ada/cedilla, tek parça, uç halkaları, Grok vision yazım (`XAI_TEXT_MODEL`). Geçen B/W [potrace](https://potrace.sourceforge.net/) ile SVG.

2. **Deterministik font yedeği (son çare)**  
   Tüm retry’ler bitince kalan slot’lar font yoluyla doldurulur ve **Yedek (font)** işaretlenir.

`/admin` her üretimin USD maliyetini ve `cost_in_usd_ticks` (1e10 ticks = $1) değerini listeler. Kredi aynı: **4 tasarım = 3 kredi**; hiç çıktı yoksa iade.

Her teslim edilen tasarım:

- yalnızca `#000` / `#fff`
- tek bağlı siyah parça (iç boşluklar / harf gözleri / halka delikleri serbest)
- solda ve sağda zincir halkası
- gömülü raster **olmayan** vektör SVG

## Stil listesi

| UI | id |
|---|---|
| Klasik script | `classic` |
| Kalpli | `hearts` |
| Yıldızlı | `star` |
| Kelebekli | `butterfly` |
| Zarif / Minimal | `elegant` |

Her üretim **4 alternatif** döner.

## Örnek çıktılar

Hedef kalite, owner’ın canlı Grok edits sonuçlarıdır (Latin isimler 17/17 doğru ve tek parça). Owner referansları: [`assets/references/`](assets/references/).

Aşağıdaki galeri **yedek font** üreticisinden (anahtar olmadan) gelir; asıl ürün kalitesi Grok i2i’dir. [`docs/samples/`](docs/samples/). Adlandırma: `{isim}_{stil}.png`. Vektör örnek: [`docs/samples/merve_kalpli.svg`](docs/samples/merve_kalpli.svg).

| | Klasik | Kalpli | Yıldızlı | Kelebekli | Zarif |
|---|---|---|---|---|---|
| Merve | ![](docs/samples/merve_klasik.png) | ![](docs/samples/merve_kalpli.png) | ![](docs/samples/merve_yildizli.png) | ![](docs/samples/merve_kelebekli.png) | ![](docs/samples/merve_zarif.png) |
| Zeynep | ![](docs/samples/zeynep_klasik.png) | ![](docs/samples/zeynep_kalpli.png) | ![](docs/samples/zeynep_yildizli.png) | ![](docs/samples/zeynep_kelebekli.png) | ![](docs/samples/zeynep_zarif.png) |
| Aleyna | ![](docs/samples/aleyna_klasik.png) | ![](docs/samples/aleyna_kalpli.png) | ![](docs/samples/aleyna_yildizli.png) | ![](docs/samples/aleyna_kelebekli.png) | ![](docs/samples/aleyna_zarif.png) |
| Sophia | ![](docs/samples/sophia_klasik.png) | ![](docs/samples/sophia_kalpli.png) | ![](docs/samples/sophia_yildizli.png) | ![](docs/samples/sophia_kelebekli.png) | ![](docs/samples/sophia_zarif.png) |
| Şükrü | ![](docs/samples/sukru_klasik.png) | ![](docs/samples/sukru_kalpli.png) | ![](docs/samples/sukru_yildizli.png) | ![](docs/samples/sukru_kelebekli.png) | ![](docs/samples/sukru_zarif.png) |

Ana ekranlar:

| Ana sayfa | Sonuçlar |
|---|---|
| ![](docs/samples/ui_home.png) | ![](docs/samples/ui_results.png) |
| **Admin kod** | **Kod yükleme** |
| ![](docs/samples/ui_admin.png) | ![](docs/samples/ui_redeem.png) |

Aynı seti yeniden üretmek için: `npx tsx scripts/write-docs-samples.ts`

## Kredi sistemi

- Yeni hesap: **60** kredi
- Her üretim: **3** kredi (sunucuda atomik düşüm; üretim tamamen başarısızsa iade)
- Bakiye &lt; 3 ise üretim reddedilir
- Top-up: **Kod gir**. Kodlar yalnızca **60 / 120 / 240** kredi taşır
- Kodlar HMAC-SHA256 ile `CODE_SECRET` kullanılarak imzalanır (`NG60-XXXX-XXXX-XXXX-XXXXXXXX`)
- Bir kod sistem genelinde **bir kez** kullanılabilir (unique + transaction)
- Admin UI (`/admin`) ve CLI kod üretir; admin üretilen/kullanılan kodları listeler

## Kurulum

Gereksinimler: Node.js 20+.

```bash
cp .env.example .env
# .env içinde CODE_SECRET, SESSION_SECRET, ADMIN_PASSWORD doldurun
# XAI_API_KEY ve isteğe bağlı XAI_IMAGE_MODEL / XAI_REF_COUNT / XAI_RESOLUTION / XAI_MAX_RETRIES / XAI_TEXT_MODEL

npm install
npx prisma db push
npm run dev
```

Açılış: [http://localhost:3000](http://localhost:3000)

### Kod üretmek

```bash
# Veritabanına kaydeder (kullanılabilir hale gelir)
npx tsx scripts/generate-codes.ts --value 60 --count 3 --persist
npx tsx scripts/generate-codes.ts --value 120 --count 1 --persist
npx tsx scripts/generate-codes.ts --value 240 --count 1 --persist
```

Veya `/admin` sayfasından `ADMIN_PASSWORD` ile giriş yapıp kod üretin.

### Testler

```bash
npm test
```

Kapsam: kod imzalama/doğrulama, tek kullanımlık (eşzamanlı çift kullanım dahil), kredi düşümü, tek-parça bağlılık, Grok prompt/referans/halka/ada doğrulama, mock’lu edits istemcisi ve pipeline (3 deneme + font yedeği), örnek isim üretimi (Merve, Şükrü). xAI anahtarı testlerde kullanılmaz.

Örnek tasarımları diske yazmak:

```bash
npx tsx scripts/write-docs-samples.ts
npx tsx scripts/preview-designs.ts Merve Zeynep Şükrü
```

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | evet | Prisma SQLite, örn. `file:./dev.db` |
| `CODE_SECRET` | evet | Kod HMAC sırrı |
| `SESSION_SECRET` | evet | Oturum JWT sırrı |
| `ADMIN_PASSWORD` | evet | `/admin` şifresi |
| `XAI_API_KEY` | hayır | xAI / Grok edits + vision API |
| `XAI_IMAGE_MODEL` | hayır | `grok-imagine-image` / `grok-imagine-image-2.0` / `grok-imagine-image-quality` |
| `XAI_REF_COUNT` | hayır | `0` text-only, `1` (varsayılan) veya `2` edits |
| `XAI_RESOLUTION` | hayır | `1k` (varsayılan) veya `2k` |
| `XAI_MAX_RETRIES` | hayır | İlk `n` batch’ten sonraki tur sayısı; varsayılan `2` |
| `XAI_TEXT_MODEL` | hayır | Yazım kontrolü (vision); varsayılan `grok-4.6` |

Sırlar asla commit edilmez. `.env` gitignore’dadır.

## Deploy

Next.js App Router. [Netlify](https://www.netlify.com/) için `netlify.toml` hazır (`@netlify/plugin-nextjs`).

**Önemli:** SQLite sunucusuz ortamda kalıcı değildir. Netlify / benzeri bir host’ta:

- `DATABASE_URL` için kalıcı bir Postgres (veya Turso/libSQL) kullanın, **veya**
- tek instance + kalıcı disk (Fly, Railway, VPS) üzerinde SQLite dosyasını tutun.

Netlify UI’da aynı env değişkenlerini tanımlayın. `XAI_API_KEY` yoksa Grok atlanır ve font yedeği kullanılır. `maxDuration` üretim rotasında 120s (4 × 2k edits + retry).

Yerel üretim derlemesi:

```bash
npm run build
npm start
```

## Font lisansları

`fonts/` altındaki script fontlar [SIL Open Font License](fonts/OFL.txt) ile gelir (Google Fonts: Great Vibes, Allura, Alex Brush, Sacramento, Parisienne, Tangerine, Italianno, Dancing Script).
