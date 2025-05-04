#!/bin/bash

# Skrypt pomocniczy do budowania aplikacji na Vercel

echo "🚀 Rozpoczynam proces budowania..."

# Budowanie frontend
if [ -d "frontend" ]; then
  echo "📦 Instalowanie zależności frontendu..."
  cd frontend
  npm ci
  
  echo "🔨 Budowanie frontendu..."
  npm run build
  
  cd ..
fi

# Gotowe
echo "✅ Budowanie zakończone pomyślnie!"