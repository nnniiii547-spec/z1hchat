#!/bin/bash

echo ""
echo "  ============================"
echo "     Z1HCHAT - APK Builder"
echo "  ============================"
echo ""

ANDROID_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for Java
if ! command -v java &>/dev/null; then
    echo "  Installing Java..."
    if command -v brew &>/dev/null; then
        brew install openjdk@17
    else
        echo "  Please install Homebrew first:"
        echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        exit 1
    fi
fi

# Check for Android SDK / command line tools
ANDROID_HOME="$HOME/Library/Android/sdk"
if [ ! -d "$ANDROID_HOME" ]; then
    echo "  Installing Android SDK..."
    if command -v brew &>/dev/null; then
        brew install --cask android-commandlinetools
    fi
    mkdir -p "$ANDROID_HOME/cmdline-tools"
    if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
        echo "  Downloading Android SDK tools..."
        cd /tmp
        curl -sL "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip" -o cmdtools.zip
        unzip -qo cmdtools.zip -d "$ANDROID_HOME/cmdline-tools/"
        mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" 2>/dev/null
        rm -f cmdtools.zip
    fi
    export ANDROID_HOME
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
fi

# Accept licenses
yes | sdkmanager --licenses 2>/dev/null

# Install build tools and platform
sdkmanager "platforms;android-34" "build-tools;34.0.0" 2>/dev/null

# Build APK
echo ""
echo "  Building APK..."
cd "$ANDROID_DIR"
chmod +x gradlew 2>/dev/null
./gradlew assembleDebug 2>/dev/null || {
    # If gradlew doesn't exist, use gradle wrapper
    if command -v gradle &>/dev/null; then
        gradle wrapper
        ./gradlew assembleDebug
    else
        echo "  Building with sdkmanager..."
    fi
}

# Find and copy APK
APK=$(find . -name "*.apk" -type f 2>/dev/null | head -1)
if [ -n "$APK" ]; then
    cp "$APK" ~/Desktop/Z1HCHAT.apk 2>/dev/null || cp "$APK" "$ANDROID_DIR/Z1HCHAT.apk"
    echo ""
    echo "  ============================"
    echo "   APK Built Successfully!"
    echo "  ============================"
    echo ""
    echo "  APK location: $ANDROID_DIR/app/build/outputs/apk/debug/"
    echo "  Copy Z1HCHAT.apk to your Android phone"
    echo "  and tap to install."
    echo ""
else
    echo ""
    echo "  Build may have issues."
    echo "  Open this folder in Android Studio for easiest build:"
    echo "  $ANDROID_DIR"
    echo ""
fi
