@echo off
title Simulateur de vol - serveur
echo Demarrage du simulateur...
echo Ouvrez votre navigateur sur : http://localhost:3000
start "" http://localhost:3000
node server.js
pause
