# NameGen

Lazer kesim isim kolyesi / pendant tasarımları üreten bir web uygulaması. Müşteri bir isim yazar, stil seçer ve birbirine bağlı (tek parça) siyah-beyaz tasarımlar indirir: PNG ve SVG.

## Yaklaşım

İki yollu **hibrit** üretim:

1. **Deterministik vektör üretici (her zaman çalışır)**  
   Paketlenmiş OFL script fontlarıyla (Türkçe glif desteği: ç, ğ, ı, İ, ö, ş, ü) isim path’e çevrilir. Swash, iki uç halkası ve süslemeler (kalp, yıldız, kelebek) prosedürel çizilir, yüksek çözünürlükte rasterize edilir, saf siyah-beyaza çekilir, kopuk adalar köprülenir veya silinir, bağlı bileşen sayısı **1** olana kadar doğrulanır, ardından [potrace](https://potrace.sourceforge.net/) ile temiz SVG’ye izlenir.

2. **Grok (xAI) görsel üretimi (isteğe bağlı)**  
   `XAI_API_KEY` varsa `https://api.x.ai/v1/images/generations` üzerinden `grok-imagine-image-2.0` modeli çağrılır. Aynı siyah-beyaz / tek-parça / halka kuralları post-process ile zorlanır. Grok yazımı bozabilir veya ada bırakabilir; doğrulamayı geçmeyen görseller **teslim edilmez**, yerlerine deterministik varyasyon konur.

API anahtarı yoksa uygulama tamamen deterministik yolla çalışır (bu ortamda da böyle test edildi).

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
# XAI_API_KEY isteğe bağlı

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

Kapsam: kod imzalama/doğrulama, tek kullanımlık (eşzamanlı çift kullanım dahil), kredi düşümü, tek-parça bağlılık, örnek isim üretimi (Merve, Şükrü).

Örnek tasarımları diske yazmak:

```bash
npx tsx scripts/preview-designs.ts Merve Zeynep Şükrü
```

## Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | evet | Prisma SQLite, örn. `file:./dev.db` |
| `CODE_SECRET` | evet | Kod HMAC sırrı |
| `SESSION_SECRET` | evet | Oturum JWT sırrı |
| `ADMIN_PASSWORD` | evet | `/admin` şifresi |
| `XAI_API_KEY` | hayır | xAI / Grok image API |

Sırlar asla commit edilmez. `.env` gitignore’dadır.

## Deploy

Next.js App Router. [Netlify](https://www.netlify.com/) için `netlify.toml` hazır (`@netlify/plugin-nextjs`).

**Önemli:** SQLite sunucusuz ortamda kalıcı değildir. Netlify / benzeri bir host’ta:

- `DATABASE_URL` için kalıcı bir Postgres (veya Turso/libSQL) kullanın, **veya**
- tek instance + kalıcı disk (Fly, Railway, VPS) üzerinde SQLite dosyasını tutun.

Netlify UI’da aynı env değişkenlerini tanımlayın. `XAI_API_KEY` yoksa Grok atlanır.

Yerel üretim derlemesi:

```bash
npm run build
npm start
```

## Font lisansları

`fonts/` altındaki script fontlar [SIL Open Font License](fonts/OFL.txt) ile gelir (Google Fonts: Great Vibes, Allura, Alex Brush, Sacramento, Parisienne, Tangerine, Italianno, Dancing Script).
