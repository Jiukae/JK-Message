#!/bin/bash
set -e

echo "=== Building JK Messenger APK ==="
BASE_DIR="/app/applet"
SRC_DIR="$BASE_DIR/android-src"
BIN_DIR="$SRC_DIR/bin"
CLASSES_DIR="$BIN_DIR/classes"
SDK_JAR="$BASE_DIR/android-sdk/platforms/android-35/android.jar"
R8_JAR="$BASE_DIR/android-sdk/r8.jar"
AAPT2="/usr/local/bin/aapt2"
OUT_DIR="$BASE_DIR/public/download"
OUT_APK="$OUT_DIR/JK-Messenger.apk"

mkdir -p "$BIN_DIR" "$CLASSES_DIR" "$OUT_DIR"

# 1. Compile resources
echo "1. Compiling resources with aapt2..."
"$AAPT2" compile --dir "$SRC_DIR/res" -o "$BIN_DIR/compiled_res.zip"

# 2. Link resources and generate R.java and base APK
echo "2. Linking resources and generating R.java..."
"$AAPT2" link \
  -I "$SDK_JAR" \
  "$BIN_DIR/compiled_res.zip" \
  --manifest "$SRC_DIR/AndroidManifest.xml" \
  --java "$SRC_DIR/src" \
  -o "$BIN_DIR/app.unsigned.apk"

# 3. Compile Java classes
echo "3. Compiling Java classes..."
rm -rf "$CLASSES_DIR"/*
javac -source 8 -target 8 -encoding UTF-8 \
  -bootclasspath "$SDK_JAR" \
  -cp "$SDK_JAR" \
  -d "$CLASSES_DIR" \
  "$SRC_DIR"/src/com/jk/messenger/*.java

# 4. Generate classes.dex with D8
echo "4. Converting classes to DEX with D8..."
java -cp "$R8_JAR" com.android.tools.r8.D8 \
  --min-api 24 \
  --lib "$SDK_JAR" \
  --output "$BIN_DIR" \
  "$CLASSES_DIR"/com/jk/messenger/*.class

# 5. Add classes.dex to APK using jar
echo "5. Adding classes.dex to APK..."
cd "$BIN_DIR"
jar -uf app.unsigned.apk classes.dex

# 6. Zipalign APK
echo "6. Aligning APK with zipalign..."
rm -f app.aligned.apk
zipalign -v -p 4 app.unsigned.apk app.aligned.apk

# 7. Release keystore
KEYSTORE="$SRC_DIR/release.keystore"
if [ ! -f "$KEYSTORE" ]; then
  echo "7. Generating release keystore..."
  keytool -genkeypair -v -keystore "$KEYSTORE" \
    -alias jkmessenger \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass jkmessenger123 -keypass jkmessenger123 \
    -dname "CN=JK Messenger, OU=Messenger, O=JK, L=Seoul, ST=Seoul, C=KR"
fi

# 8. Sign APK with apksigner (v2 & v3 schemes)
echo "8. Signing APK with apksigner..."
rm -f "$OUT_APK"
apksigner sign --ks "$KEYSTORE" \
  --ks-pass pass:jkmessenger123 \
  --ks-key-alias jkmessenger \
  --key-pass pass:jkmessenger123 \
  --out "$OUT_APK" \
  app.aligned.apk

# Also copy to root of public
cp "$OUT_APK" "$BASE_DIR/public/JK-Messenger.apk"
chmod 644 "$OUT_APK" "$BASE_DIR/public/JK-Messenger.apk"

# 9. Verify
echo "9. Verifying signed APK..."
apksigner verify -v "$OUT_APK"

echo "=== SUCCESS! APK created at $OUT_APK ==="
ls -lh "$OUT_APK" "$BASE_DIR/public/JK-Messenger.apk"
