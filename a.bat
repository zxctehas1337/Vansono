@echo off
color 2
git add .
echo "Please enter the commit message"
set /p commit_message=
git commit -m "%commit_message%"
echo "Pushing to origin master?"
set /p push_to_origin=
if "%push_to_origin%" == "y" (
    git push origin master
) else (
    echo "Pushing to origin master cancelled"
)
cmd /c cls