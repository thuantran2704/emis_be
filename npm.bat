@echo off
REM Full path to your portable Node.js folder (just the directory)
set "NODE_DIR=C:\Users\tqt\Downloads\node\node"

REM Add the directory to PATH temporarily so 'node' works during npm execution
set "PATH=%NODE_DIR%;%PATH%"

REM Use node.exe to run npm-cli.js with all arguments passed to this .bat
"%NODE_DIR%\node.exe" "%NODE_DIR%\node_modules\npm\bin\npm-cli.js" %*
