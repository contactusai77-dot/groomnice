@echo off
cd /d %~dp0
echo Seeding database...
py -3.11 seed.py
echo.
echo Starting server...
py -3.11 -m uvicorn main:app --port 8002
