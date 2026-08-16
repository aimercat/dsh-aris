@echo off
set "TEMPLATE_REPO=%DSH_PLUGIN_DEV_TEMPLATE_REPO%"
if not defined TEMPLATE_REPO set "TEMPLATE_REPO=G:\CodeRep\dsh-plugin-dev-template"
call "%TEMPLATE_REPO%\scripts\start-plugin-dev.cmd" -DevProfile "aris-dev" -DevPort 3081 -DevDshHome "%USERPROFILE%\.dsh-dev" %*
