@echo off
setlocal enabledelayedexpansion
color 2
chcp 1251 >nul

:: Инициализация переменных
set commit_message=Автоматический коммит
set auto_push=false

:: Обработка аргументов
:parse_args
if "%~1"=="" goto execute

if "%~1"=="-y" (
    set auto_push=true
) else if "%~1"=="-m" (
    shift
    set commit_message=%~1
)

shift
goto parse_args

:execute
echo Adding files...
git add .
git push origin master
echo Commit with message: "%commit_message%"
git commit -m "%commit_message%"
git push origin master
cmd /c cls
chcp 65001 >nul
endlocal
