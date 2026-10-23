#!/bin/sh
# Builds haya-term in release mode and wraps it as dist/Haya.app.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cargo build --release -p haya-term

APP="dist/Haya.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp target/release/haya-term "$APP/Contents/MacOS/haya-term"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>Haya</string>
    <key>CFBundleDisplayName</key>
    <string>Haya</string>
    <key>CFBundleIdentifier</key>
    <string>dev.haya.terminal</string>
    <key>CFBundleExecutable</key>
    <string>haya-term</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

# Ad-hoc signature so macOS accepts the bundle locally without a developer ID.
codesign --force --sign - "$APP"
echo "built $APP"
