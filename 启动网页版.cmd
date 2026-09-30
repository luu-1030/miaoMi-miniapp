@echo off
chcp 65001 >nul
pushd "%~dp0"

if not exist "node_modules\.bin\vite.cmd" (
  echo 正在安装首次运行需要的依赖，请稍候...
  call npm install
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

start "miaoMi 本地服务" cmd /k "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173/"
popd
