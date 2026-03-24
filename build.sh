#!/bin/bash
set -e

echo "=== Circuit Survivors Build ==="

# Clean dist
rm -rf dist
mkdir -p dist

# Copy web files
cp index.html dist/
cp style.css dist/
cp -r src dist/

# Copy assets if they exist
if [ -d "assets" ]; then
  cp -r assets dist/
fi

echo "Web files copied to dist/"

# Sync with Capacitor
if command -v npx &> /dev/null && [ -f "node_modules/.package-lock.json" ] 2>/dev/null; then
  echo "Syncing with Capacitor..."
  npx cap sync ios
  echo ""
  echo "Ready. Open ios/ in Xcode to build:"
  echo "  npx cap open ios"
else
  echo ""
  echo "Capacitor not installed. To set up native build:"
  echo "  npm install"
  echo "  npx cap init \"Circuit Survivors\" \"com.nickcoma.circuitsurvivors\" --web-dir dist"
  echo "  npx cap add ios"
  echo "  npm run build"
fi

echo ""
echo "=== Done ==="
