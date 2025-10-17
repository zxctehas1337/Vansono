@echo off
chcp 1251
git add .
echo "Выберите название коммита"
set /p commit_message=
git commit -m "%commit_message%"
git push origin master