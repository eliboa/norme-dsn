@echo off
set "chromePath=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "appPath=file:///%~dp0public/index.html"
set "userData=%TEMP%\edge_dev_session"
start "" "%chromePath%" --disable-web-security --user-data-dir="%userData%" --app="%appPath%"