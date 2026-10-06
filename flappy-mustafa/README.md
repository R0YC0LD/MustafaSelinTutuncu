# Flappy Mustafa

Kafası kesilip kuş yapılmış Mustafa, bira şişelerinin arasından uçuyor. Android için hazır APK:
**[FlappyMustafa.apk](FlappyMustafa.apk)** (≈250 KB, Android 5.0+).

Aynı oyun tarayıcıda da oynanır: `web/index.html`.

## Oynanış
Ekrana dokun, kanat çırp. Şişelere ve yere çarpma. Her geçilen şişe +1 puan.

| Nesne | Etkisi |
|---|---|
| 🚬 Sigara | 10 sn dokunulmazlık; şişeleri kırarak geçersin (her kırılan şişe +1). Ağızda sigara, dumanı ve parlayan bir hale. |
| 🧿 Nazar boncuğu | Bir çarpmayı affeder (en fazla 2 tane birikir). |
| 🍵 Çay | 6 sn ağır çekim. |
| 🧲 Mıknatıs | 8 sn boyunca liraları çeker. |
| 🥛 Ayran | 7 sn küçülürsün (ayran bıyığı dahil). |
| 🍢 Şiş kebap | +5 puan. |
| ₺ Lira | +1 puan. |

Şişeye çok yakın geçersen **kıl payı** bonusu (+1). Skor ilerledikçe hız artar, aralık daralır, şişeler
inip kalkmaya başlar; gökyüzü gündüz → gün batımı → gece → şafak arasında döner (İstanbul silüeti).
Madalyalar: 10 bronz, 25 gümüş, 50 altın, 100 platin. Rekor cihazda saklanır.

## Derleme
`build-apk.sh` Gradle kullanmadan doğrudan SDK araçlarıyla (aapt2, javac, d8, zipalign, apksigner) derler:

```bash
ANDROID_HOME=/yol/android-sdk ./build-apk.sh   # platforms;android-34 + build-tools;35.0.0
```

APK, `android/flappy-mustafa.keystore` ile imzalanır (şifre `flappymustafa`, `KS_PASS` ile
değiştirilebilir). Aynı anahtarla imzalanan yeni sürümler eskisinin üzerine kurulur; Play Store'a
yüklenecekse kendi gizli anahtarınızı kullanın.

## Yapı
- `web/` — oyunun tamamı: tek bir canvas, sabit mantıksal yükseklik (640) ile her ekrana ölçeklenir,
  şişe/zemin/bulut gibi görseller açılışta bir kez önceden çizilir, sesler WebAudio ile sentezlenir
  (ses dosyası yok), fizik 120 Hz alt adımlarla çalışır.
- `android/` — oyunu tam ekran, donanım hızlandırmalı WebView'de açan tek bir Activity; titreşim ve
  rekor kaydı için küçük bir JavaScript köprüsü, geri tuşu oyunu duraklatır.
- `tools/make_icons.py` — başlatıcı simgelerini `web/head.png`'den üretir.
