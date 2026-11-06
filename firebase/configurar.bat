@echo off
chcp 65001 >nul
REM Publica as regras e o indice do ranking no Firebase (projeto games-4efa7).
REM Uso (Windows): de dois cliques neste arquivo, dentro da pasta "firebase".
cd /d "%~dp0"
set PROJETO=games-4efa7

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org ^(versao LTS^) e rode de novo.
  pause
  exit /b 1
)

echo.
echo 1/3 Entrando na sua conta Google ^(vai abrir o navegador^)...
call npx --yes firebase-tools@latest login
if errorlevel 1 goto erro

echo.
echo 2/3 Publicando regras de seguranca e indice do ranking...
call npx --yes firebase-tools@latest deploy --only firestore:rules,firestore:indexes --project %PROJETO%
if errorlevel 1 goto erro

echo.
echo 3/3 Pronto! O indice pode levar alguns minutos para ficar "Ativado" em:
echo https://console.firebase.google.com/project/%PROJETO%/firestore/indexes
pause
exit /b 0

:erro
echo.
echo Algo deu errado. Leia a mensagem acima.
pause
exit /b 1
