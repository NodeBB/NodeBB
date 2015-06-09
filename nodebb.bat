@echo off

rem %1 action
rem %2 subaction

setlocal enabledelayedexpansion
2>nul call :CASE_%1
if ERRORLEVEL 1 call :DEFAULT_CASE

exit /B

:CASE_start
    echo Starting NodeBB
    echo   "nodebb.bat stop" to stop the NodeBB server
    echo   "nodebb.bat log" to view server output

    rem Start the loader daemon
    node loader %*

    goto END_CASE

:CASE_stop
    call :pidexists
    if %_result%==0 (
        echo NodeBB is already stopped.
    ) else (
        echo Stopping NodeBB. Goodbye!

        rem Doing this forcefully is probably not the best method
        taskkill /PID !_pid! /f>nul
    )

    goto END_CASE

:CASE_restart
    echo Unsupported

    goto END_CASE

:CASE_reload
    echo Unsupported

    goto END_CASE

:CASE_status
    call :pidexists
    if %_result%==0 (
        echo NodeBB is not running
        echo   "nodebb.bat start" to launch the NodeBB server
    ) else (
        echo NodeBB Running ^(pid !_pid!^)
        echo   "nodebb.bat stop" to stop the NodeBB server
        echo   "nodebb.bat log" to view server output
        echo   "nodebb.bat restart" to restart NodeBB
    )

    goto END_CASE

:CASE_log
    cls
    type .\logs\output.log

    goto END_CASE

:CASE_upgrade
    call npm install
    call npm i nodebb-theme-vanilla nodebb-theme-lavender nodebb-widget-essentials
    node app --upgrade
    copy /b package.json +,,>nul

    goto END_CASE

:CASE_setup
    node app --setup %*

    goto END_CASE

:CASE_reset
    node app --reset --%2

    goto END_CASE

:CASE_dev
    echo Launching NodeBB in "development" mode.
    echo To run the production build of NodeBB, please use "forever".
    echo More Information: https://docs.nodebb.org/en/latest/running/index.html
    set NODE_ENV=development
    node loader --no-daemon %*

    goto END_CASE

:CASE_watch
    echo Not supported

    goto END_CASE

:DEFAULT_CASE
    echo Welcome to NodeBB
    echo Usage: nodebb.bat ^{start^|stop^|reload^|restart^|log^|setup^|reset^|upgrade^|dev^|watch^}

    goto END_CASE

:END_CASE
    endlocal
    VER > NUL
    goto :EOF

:pidexists
if exist %~dp0pidfile (
    set /p _pid=<pidfile

    for /f "usebackq" %%Z in (`tasklist /nh /fi "PID eq !_pid!"`) do (
        if %%Z==INFO: (
            del pidfile
            set _result=0
        ) else (
            set _result=1
        )
    )
) else (
    set _result=0
)