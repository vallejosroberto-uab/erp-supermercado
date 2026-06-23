@echo off
title Panel de Control - Abuelita Serafina ERP
echo ===================================================
echo   Iniciando Ecosistema de Microservicios Python
echo ===================================================
echo.

echo [1/6] Levantando Ventas Service en Puerto 5001...
start "Servicio: Ventas" cmd /k "cd ventas_service && python app.py"

echo [2/6] Levantando Inventario Service en Puerto 5002...
start "Servicio: Inventario" cmd /k "cd inventario_service && python app.py"

echo [3/6] Levantando Producto Service en Puerto 5003...
start "Servicio: Productos" cmd /k "cd producto_service && python app.py"

echo [4/6] Levantando Clientes Service en Puerto 5004...
start "Servicio: Clientes" cmd /k "cd clientes_service && python app.py"

echo [5/6] Levantando Notificaciones Service en Puerto 5005...
start "Servicio: Notificaciones" cmd /k "cd notificaciones_service && python app.py"

echo [6/6] Levantando Administracion Service en Puerto 5006...
start "Servicio: Administracion" cmd /k "cd administracion_service && python app.py"

echo.
echo ===================================================
echo   Todos los servicios han sido lanzados de forma aislada.
echo   Verifica las ventanas individuales para logs o errores.
echo ===================================================
pause