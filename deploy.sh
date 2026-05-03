#!/bin/bash
set -e

echo "🔄 מתחיל תהליך פריסה..."

VERSION=$(date +%Y-%m-%d_%H:%M:%S)

echo "🧹 ניקוי build ישן..."
rm -rf .next node_modules/.cache

echo "🔍 בדיקת TypeScript..."
npx tsc --noEmit --pretty false

echo "🏗️ Build..."
npm run build

echo "🏷️ הוספת גרסת פריסה..."
echo "// BUILD VERSION: $VERSION" >> src/components/admin-client-details.tsx

echo "📦 Git status..."
git status

echo "📤 Commit + Push..."
git add src/components/admin-client-details.tsx src/app/admin deploy.sh
git commit -m "auto deploy $VERSION" || echo "ℹ️ אין שינויים לקומיט"
git push origin master

echo "✅ נשלח ל-GitHub. Firebase App Hosting יתחיל rollout אוטומטית."
