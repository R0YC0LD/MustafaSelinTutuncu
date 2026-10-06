#!/usr/bin/env bash
# Flappy Mustafa APK'sını Gradle olmadan, doğrudan Android SDK araçlarıyla derler.
# Gerekenler: JDK 11+ (Java 8 bayt kodu üretilir), Android SDK (platforms;android-34 ve build-tools;35.0.0).
# Not: build-tools 34'teki d8, JDK 21 javac'ın ürettiği isimsiz MethodParameters kayıtlarında çöküyor; 35+ kullanın.
set -euo pipefail

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/opt/android-sdk}}"
BT="$SDK/build-tools/${BUILD_TOOLS:-35.0.0}"
JAR="$SDK/platforms/android-34/android.jar"
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/build"
APK="$ROOT/FlappyMustafa.apk"
KS="$ROOT/android/flappy-mustafa.keystore"
KS_PASS="${KS_PASS:-flappymustafa}"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"

rm -rf "$OUT"
mkdir -p "$OUT/assets" "$OUT/gen" "$OUT/classes"

echo "› varlıklar kopyalanıyor"
cp "$ROOT/web/index.html" "$ROOT/web/game.js" "$ROOT/web/head.png" "$OUT/assets/"

echo "› kaynaklar derleniyor (aapt2)"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$JAR" \
  --manifest "$ROOT/android/AndroidManifest.xml" \
  -A "$OUT/assets" --java "$OUT/gen" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$OUT/res.zip"

echo "› Java derleniyor"
javac -nowarn -Xlint:-options --release 8 -encoding UTF-8 -classpath "$JAR" -d "$OUT/classes" \
  $(find "$ROOT/android/src" "$OUT/gen" -name '*.java')

echo "› dex (d8)"
"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$OUT" $(find "$OUT/classes" -name '*.class')
(cd "$OUT" && zip -q -X base.apk classes.dex)

echo "› hizalama ve imza"
"$BT/zipalign" -p -f 4 "$OUT/base.apk" "$OUT/aligned.apk"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias flappy -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Flappy Mustafa, O=Flappy Mustafa, C=TR"
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias flappy --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$APK" "$OUT/aligned.apk"
"$BT/apksigner" verify "$APK"
rm -f "$APK.idsig"
echo "✓ $(du -h "$APK" | cut -f1)  $APK"
