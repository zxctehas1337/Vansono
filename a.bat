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
echo Добавление файлов...
git add .

echo Коммит с сообщением: "%commit_message%"
git commit -m "%commit_message%"

if "%auto_push%"=="true" (
    echo Пуш на origin master...
    git push origin master
)

cmd /c cls
chcp 65001 >nul
endlocal
