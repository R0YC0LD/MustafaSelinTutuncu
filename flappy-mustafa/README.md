# Flappy Adil Hoca

Kafası kesilip kuş yapılmış Adil Hoca, bira şişelerinin arasından uçuyor. Android için hazır APK:
**[FlappyAdilHoca.apk](FlappyAdilHoca.apk)** (≈320 KB, Android 5.0+).

Aynı oyun tarayıcıda da oynanır: `web/index.html`.

## Oynanış
Ekrana dokun, kanat çırp. Şişelere ve yere çarpma. Her geçilen şişe +1 puan.

| Nesne | Etkisi |
|---|---|
| 🚬 Sigara | 10 sn dokunulmazlık; şişeleri kırarak geçersin (her kırılan şişe +1). Ağızda sigara, dumanı ve parlayan bir hale. |
| 🧿 Nazar boncuğu | Bir çarpmayı affeder (aynı anda tek boncuk). |
| 🍵 Çay | 5 sn ağır çekim. |
| 🧲 Mıknatıs | 6 sn boyunca liraları çeker. |
| 🥛 Ayran | 5 sn küçülürsün (ayran bıyığı dahil). |
| 🍢 Şiş kebap | +3 puan. |
| ₺ Lira | +1 puan. |

Güçler seyrek çıkar (ilk sigara 7. şişede). Şişeye çok yakın geçersen **kıl payı** bonusu (+1). Oyun
hızlı başlar ve 45 şişede en zor hâline ulaşır: hız artar, aralık daralır, 8. şişeden sonra şişeler
inip kalkmaya başlar. Gökyüzü gündüz → gün batımı → gece → şafak arasında döner (İstanbul silüeti).

**Akademik kariyer** — skor arttıkça kafanın üstünde unvan yazar, Lisans Mezunu'ndan itibaren kep takılır:
20 Öğrenci → 50 Lisans Mezunu → 80 Yüksek Lisans Öğrencisi → 110 Yüksek Lisans Mezunu → 150 Doktora
Öğrencisi → 200 Dr. → 250 Dr. Öğr. Üyesi → 300 Doç. Dr. → 400 Prof. Dr. → 500 Ordinaryüs Prof. Dr.

Madalyalar: 10 bronz, 25 gümüş, 50 altın, 100 platin. Rekor cihazda saklanır.

## Sesler
Gerçek ses kayıtları [Kenney](https://www.kenney.nl) paketlerinden (CC0): kanat için kumaş hışırtısı,
geçilen şişede cam tıngırtısı, kırılan şişede cam kırılması, çakmakta zippo sesi, lira şıngırtısı vb.
Kırpılıp normalize edilerek `web/sounds.js` içine gömüldü. Alev, nefes çekme ve rüzgâr WebAudio ile üretilir.

## Derleme
`build-apk.sh` Gradle kullanmadan doğrudan SDK araçlarıyla (aapt2, javac, d8, zipalign, apksigner) derler:

```bash
ANDROID_HOME=/yol/android-sdk ./build-apk.sh   # platforms;android-34 + build-tools;35.0.0
```

APK, `android/flappy-mustafa.keystore` ile imzalanır (şifre `flappymustafa`, `KS_PASS` ile
değiştirilebilir). Aynı anahtarla imzalanan yeni sürümler eskisinin üzerine kurulur; Play Store'a
yüklenecekse kendi gizli anahtarınızı kullanın.

## Yapı
- `web/` — oyunun tamamı (`sounds.js` ses efektleri): tek bir canvas, sabit mantıksal yükseklik (640) ile her ekrana ölçeklenir,
  şişe/zemin/bulut gibi görseller açılışta bir kez önceden çizilir, sesler WebAudio ile sentezlenir
  (ses dosyası yok), fizik 120 Hz alt adımlarla çalışır.
- `android/` — oyunu tam ekran, donanım hızlandırmalı WebView'de açan tek bir Activity; titreşim ve
  rekor kaydı için küçük bir JavaScript köprüsü, geri tuşu oyunu duraklatır.
- `tools/make_icons.py` — başlatıcı simgelerini `web/head.png`'den üretir.
