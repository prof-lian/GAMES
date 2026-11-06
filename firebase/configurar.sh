#!/usr/bin/env bash
# Publica as regras e o índice do ranking no Firebase (projeto games-4efa7).
# Uso (Mac/Linux), dentro da pasta "firebase":   bash configurar.sh
set -e
cd "$(dirname "$0")"
PROJETO=games-4efa7

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js não encontrado. Instale em https://nodejs.org (versão LTS) e rode de novo."
  exit 1
fi

echo "▶ 1/3 Entrando na sua conta Google (vai abrir o navegador)…"
npx --yes firebase-tools@latest login

echo "▶ 2/3 Publicando regras de segurança e índice do ranking…"
npx --yes firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project "$PROJETO"

echo "▶ 3/3 Pronto! ✅"
echo "O índice pode levar alguns minutos para ficar 'Ativado' em:"
echo "https://console.firebase.google.com/project/$PROJETO/firestore/indexes"
