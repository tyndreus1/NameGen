# NameGen

Lazer kesim isim kolyesi / pendant tasarımları üreten bir web uygulaması. Müşteri bir isim yazar, stil seçer ve birbirine bağlı (tek parça) siyah-beyaz tasarımlar indirir: PNG ve SVG.

## Yaklaşım

**Asıl üretici Grok image-to-image’dir.** Font yolu yalnızca son çare yedektir (canlı 27-görsel testte font tasarımları referansların çok gerisinde kaldı).

1. **Grok edits (birincil)**  
   `XAI_API_KEY` varsa her slot `POST https://api.x.ai/v1/images/edits` ile **JSON body** gönderir (multipart / OpenAI SDK `images.edit()` bu endpoint’te çalışmaz):

   ```json
   {
     "model": "grok-imagine-image-2.0",
     "prompt": "...",
     "images": [
       { "url": "data:image/png;base64,...", "type": "image_url" },
       { "url": "data:image/png;base64,...", "type": "image_url" }
     ],
     "aspect_ratio": "5:2",
     "n": 1,
     "response_format": "b64_json",
     "resolution": "2k"
   }
   ```

   Tek referansta `image` (tekil) kullanılır. **2k** → 3200×1280 PNG (lazer kalitesi, ~$0.10). Varsayılan 1k JPEG’dir; kullanılmaz. Model `XAI_IMAGE_MODEL` ile değişir (varsayılan `grok-imagine-image-2.0`; canlı testte `-quality`’den daha iyi benzerlik).

   Stil için [owner referansları](assets/references/) gönderilir: istek başına **2** görsel, hedef isimle aynı referans asla yok; kelebek stili `sophia.png` içerir. Prompt şablonu ve süsleme cümleleri `src/lib/generate/prompt.ts` içinde; denenen her prompt `assets/references/prompts.md` dosyasında.

   Her görsel doğrulanır: saf S/B eşik, toz silme / yakın kopuk nokta-cedilla köprüleme (uzak ada → red), bağlı bileşen **1**, solda ve sağda **kapalı** halka + iç delik (spiral boşluk halka sayılmaz), yazım kontrolü Grok vision (`XAI_TEXT_MODEL`, varsayılan `grok-4.6`) ile. Başarısız slot **3 kez** denenir; 4 alternatif **paralel** üretilir. 2k B/W sonuç [potrace](https://potrace.sourceforge.net/) ile SVG’ye izlenir.

2. **Deterministik font yedeği (son çare)**  
   Slot’un 3 denemesi de başarısızsa (veya anahtar yoksa) OFL script font + prosedürel swash/halka/süsleme kullanılır ve sonuç **Yedek (font)** olarak işaretlenir.

Anahtar yoksa uygulama font yoluyla çalışır. Bu ortamda xAI anahtarı yok; birim testler istemciyi mock’lar. Canlı Grok testi owner tarafında çalıştırılmalı.

`/admin` her üretimin xAI `cost` toplamını listeler (müşteri başı API harcaması). Kredi ücreti değişmez: **4 tasarım = 3 kredi**; hiç çıktı yoksa iade.

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
# XAI_API_KEY, isteğe bağlı XAI_IMAGE_MODEL ve XAI_TEXT_MODEL

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
| `XAI_IMAGE_MODEL` | hayır | Image model; varsayılan `grok-imagine-image-2.0` |
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
