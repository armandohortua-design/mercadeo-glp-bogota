@echo off
title GLP CRM — Control de Servidores

:MENU
cls
echo.
echo  =========================================
echo   GLP CRM — Control de Servidores
echo  =========================================
echo.
echo  [1] Prender servidores
echo  [2] Apagar servidores
echo  [3] Estado de servidores
echo  [4] Salir
echo.
set /p opcion="  Elige una opcion (1/2/3/4): "

if "%opcion%"=="1" goto PRENDER
if "%opcion%"=="2" goto APAGAR
if "%opcion%"=="3" goto ESTADO
if "%opcion%"=="4" goto FIN
goto MENU

:PRENDER
echo.
echo  Iniciando Backend Node.js (puerto 3001)...
start "GLP Backend :3001" /min cmd /c "node "C:\Users\ahortua\OneDrive\Juan Jose\Mercadeo GLP en Bogota\glp-app\server\index.js" & pause"

timeout /t 2 /nobreak >nul

echo  Iniciando Frontend Vite (puerto 5173)...
start "GLP Frontend :5173" /min cmd /c "cd /d "C:\Users\ahortua\OneDrive\Juan Jose\Mercadeo GLP en Bogota\glp-app" && npm run dev & pause"

timeout /t 4 /nobreak >nul

echo.
echo  =========================================
echo   Servidores corriendo:
echo   Frontend : http://localhost:5173/crm.html
echo   Backend  : http://localhost:3001
echo  =========================================
echo.
pause
goto MENU

:APAGAR
echo.
echo  Apagando puerto 3001 (Backend)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  Apagando puerto 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":5173 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo  Servidores apagados.
echo.
pause
goto MENU

:ESTADO
echo.
echo  Verificando puertos...
echo.
netstat -aon 2>nul | findstr /R ":3001 " >nul && echo  [ON]  Backend  :3001 || echo  [OFF] Backend  :3001
netstat -aon 2>nul | findstr /R ":5173 " >nul && echo  [ON]  Frontend :5173 || echo  [OFF] Frontend :5173
echo.
pause
goto MENU

:FIN
exit
