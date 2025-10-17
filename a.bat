@echo off
color 2
git add .
echo "Please enter the commit message"
set /p commit_message=
git commit -m "%commit_message%"
git push origin master