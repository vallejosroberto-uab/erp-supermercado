const ventasState = {
    clientes: [],
    productos: [],
    ventas: [],
    sucursales: [],
    empleados: [],
    catalogoProductos: [],
    stockPorProducto: {},
    stockSucursalCargado: false,
    clientesPorUid: {},
    sucursalesPorUid: {},
    ventasFiltro: '',
    reporte: null
};
const VENTAS_EXTERNAL_ROUTES = {
    sucursales: '/api/sucursales',
    empleados: '/api/empleados',
    productos: '/api/productos',
    stockSucursal: '/inventory/balance'
};
const VENTA_EXITOSA_STORAGE_KEY = 'ventas_ultima_venta_exitosa';
let clienteSearchTimeout = null;

async function ventasApiCall(servicePort, route, method = 'GET', bodyData = null) {
    const url = `${BASE_URL}:${servicePort}${route}`;
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (bodyData && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(bodyData);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || data.error || `Error HTTP: ${response.status}`);
    }
    return data;
}

function renderVentasModule() {
    const contentArea = document.getElementById('main-content');
    contentArea.innerHTML = `
        <section class="ventas-page">
            <div class="ventas-toolbar">
                <div>
                    <h4><span class="section-icon">&#128722;</span> Gestion de ventas</h4>
                    <p class="muted">Registra ventas, pagos y comprobantes desde el modulo de Ventas.</p>
                </div>
                <div class="ventas-actions">
                    <button type="button" class="action-btn create-action" onclick="abrirModalNuevaVenta()">Nueva venta</button>
                </div>
            </div>

            <div class="ventas-tabs">
                <button type="button" class="ventas-tab active" data-ventas-tab="listado" onclick="mostrarVistaVentas('listado')">Ventas</button>
                <button type="button" class="ventas-tab" data-ventas-tab="reportes" onclick="mostrarVistaVentas('reportes')">Reportes</button>
            </div>

            <div id="ventas-listado-panel" class="ventas-panel">
                <div class="ventas-section-header">
                    <h4><span class="section-icon">&#128203;</span> Ventas registradas</h4>
                    <button type="button" class="action-btn ghost-action" onclick="cargarVentas()">Actualizar</button>
                </div>
                <div class="ventas-search">
                    <input id="ventas-buscador" type="search" placeholder="Buscar por factura, cliente, sucursal, estado o total" oninput="filtrarVentasTabla(this.value)">
                </div>
                <div id="ventas-listado" class="ventas-table-wrap"></div>
            </div>

            <div id="ventas-reportes-panel" class="ventas-panel" hidden>
                ${renderReportesPanel()}
            </div>
        </section>

        <div id="ventas-modal" class="modal-backdrop" hidden>
            <div class="modal-card">
                <div class="modal-header">
                    <h4 id="ventas-modal-title">Nueva venta</h4>
                    <button type="button" class="icon-btn" onclick="cerrarModalVenta()" aria-label="Cerrar">x</button>
                </div>
                <div id="ventas-modal-body"></div>
            </div>
        </div>
    `;

    cargarVentas();
    cargarClientesVentas();
    setTimeout(mostrarVentaExitosaPendiente, 600);
}

function mostrarVistaVentas(vista) {
    const listadoPanel = document.getElementById('ventas-listado-panel');
    const reportesPanel = document.getElementById('ventas-reportes-panel');
    document.querySelectorAll('.ventas-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.ventasTab === vista);
    });

    if (listadoPanel) listadoPanel.hidden = vista !== 'listado';
    if (reportesPanel) reportesPanel.hidden = vista !== 'reportes';

    if (vista === 'reportes' && !ventasState.reporte) {
        cargarReporteVentas();
    }
}

function renderReportesPanel() {
    const today = getTodayInputValue();
    const month = today.slice(0, 7);
    return `
        <div class="ventas-section-header">
            <h4><span class="section-icon">&#128202;</span> Reportes de ventas</h4>
            <div class="ventas-actions">
                <button type="button" class="action-btn query-action" onclick="cargarReporteVentas()">Consultar</button>
                <button type="button" class="action-btn excel-action" onclick="exportarReporteExcel()">Excel</button>
                <button type="button" class="action-btn pdf-action" onclick="exportarReportePdf()">PDF</button>
            </div>
        </div>
        <div class="report-filter">
            <label>
                Tipo
                <select id="reporte-tipo" onchange="toggleReportePeriodo()">
                    <option value="dia">Reporte del dia</option>
                    <option value="mes">Reporte por mes</option>
                    <option value="rango">Reporte por rango</option>
                </select>
            </label>
            <label id="reporte-fecha-field">
                Fecha
                <input id="reporte-fecha" type="date" value="${today}">
            </label>
            <label id="reporte-mes-field" hidden>
                Mes
                <input id="reporte-mes" type="month" value="${month}">
            </label>
            <label id="reporte-inicio-field" hidden>
                Desde
                <input id="reporte-fecha-inicio" type="date" value="${today}">
            </label>
            <label id="reporte-fin-field" hidden>
                Hasta
                <input id="reporte-fecha-fin" type="date" value="${today}">
            </label>
        </div>
        <div id="ventas-reporte-contenido" class="report-content">
            <p class="muted">Selecciona un periodo y consulta el reporte.</p>
        </div>
    `;
}

function toggleReportePeriodo() {
    const tipo = document.getElementById('reporte-tipo')?.value || 'dia';
    const fechaField = document.getElementById('reporte-fecha-field');
    const mesField = document.getElementById('reporte-mes-field');
    const inicioField = document.getElementById('reporte-inicio-field');
    const finField = document.getElementById('reporte-fin-field');
    if (fechaField) fechaField.hidden = tipo !== 'dia';
    if (mesField) mesField.hidden = tipo !== 'mes';
    if (inicioField) inicioField.hidden = tipo !== 'rango';
    if (finField) finField.hidden = tipo !== 'rango';
}

async function cargarReporteVentas() {
    const contenido = document.getElementById('ventas-reporte-contenido');
    if (!contenido) return;

    const tipo = document.getElementById('reporte-tipo')?.value || 'dia';
    const fecha = document.getElementById('reporte-fecha')?.value || getTodayInputValue();
    const mes = document.getElementById('reporte-mes')?.value || getTodayInputValue().slice(0, 7);
    const fechaInicio = document.getElementById('reporte-fecha-inicio')?.value || fecha;
    const fechaFin = document.getElementById('reporte-fecha-fin')?.value || fechaInicio;
    let query = `tipo=dia&fecha=${encodeURIComponent(fecha)}`;
    if (tipo === 'mes') {
        query = `tipo=mes&mes=${encodeURIComponent(mes)}`;
    }
    if (tipo === 'rango') {
        query = `tipo=rango&fecha_inicio=${encodeURIComponent(fechaInicio)}&fecha_fin=${encodeURIComponent(fechaFin)}`;
    }

    contenido.innerHTML = '<p class="muted">Cargando reporte...</p>';
    try {
        const response = await apiCall(API_PORTS.ventas, `/api/ventas/reportes?${query}`);
        ventasState.reporte = response.data || null;
        if (!ventasState.catalogoProductos.length) {
            await cargarProductosVentas();
        }
        renderReporteVentas();
    } catch (error) {
        contenido.innerHTML = '<p class="error-text">No se pudo cargar el reporte de ventas.</p>';
    }
}

function renderReporteVentas() {
    const contenido = document.getElementById('ventas-reporte-contenido');
    const reporte = ventasState.reporte;
    if (!contenido || !reporte) return;

    const tituloPeriodo = reporte.tipo === 'mes' ? `Mes ${reporte.periodo}` : reporte.periodo;
    const metodos = reporte.metodos_pago || [];
    contenido.innerHTML = `
        <div class="report-summary">
            <span>Ingresos: ${escapeHtml(tituloPeriodo)}</span>
            <strong>Bs ${centavosToMoney(reporte.total_centavos)}</strong>
        </div>
        <p class="muted">Ventas confirmadas: ${Number(reporte.cantidad_ventas || 0)}</p>
        ${metodos.length ? metodos.map(renderReporteMetodo).join('') : '<p class="muted">No hay ventas confirmadas en este periodo.</p>'}
    `;
}

function renderReporteMetodo(metodo) {
    const productos = metodo.productos || [];
    return `
        <div class="report-method">
            <div class="report-method-header">
                <h5>Ventas ${escapeHtml(formatMetodoPago(metodo.metodo_pago))}</h5>
                <strong>Bs ${centavosToMoney(metodo.total_centavos)}</strong>
            </div>
            ${productos.length ? `
                <table class="ventas-table report-table">
                    <thead>
                        <tr>
                            <th><span class="th-icon">&#128230;</span> Producto</th>
                            <th><span class="th-icon">&#35;</span> Cantidad</th>
                            <th><span class="th-icon">&#128184;</span> Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productos.map(producto => `
                            <tr>
                                <td>${escapeHtml(getNombreProductoReporte(producto))}</td>
                                <td>${Number(producto.cantidad || 0)} x Bs ${centavosToMoney(producto.precio_unitario_centavos)}</td>
                                <td>Bs ${centavosToMoney(producto.subtotal_centavos)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p class="muted">Sin detalle de productos.</p>'}
        </div>
    `;
}

function exportarReporteExcel() {
    const reporte = ventasState.reporte;
    if (!reporte) {
        alert('Primero consulta un reporte.');
        return;
    }

    const rows = getReporteExportRows(reporte);
    const html = `
        <html>
            <head><meta charset="utf-8"></head>
            <body>
                <table border="1">
                    <tr><th colspan="5">Reporte de ventas - ${escapeHtml(reporte.periodo)}</th></tr>
                    <tr><td colspan="4">Ingresos</td><td>${centavosToMoney(reporte.total_centavos)}</td></tr>
                    <tr><td colspan="4">Ventas confirmadas</td><td>${Number(reporte.cantidad_ventas || 0)}</td></tr>
                    <tr>
                        <th>Metodo</th>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio unitario Bs</th>
                        <th>Subtotal Bs</th>
                    </tr>
                    ${rows.map(row => `
                        <tr>
                            <td>${escapeHtml(row.metodo)}</td>
                            <td>${escapeHtml(row.producto)}</td>
                            <td>${row.cantidad}</td>
                            <td>${row.precio}</td>
                            <td>${row.subtotal}</td>
                        </tr>
                    `).join('')}
                </table>
            </body>
        </html>
    `;
    descargarArchivo(
        `reporte-ventas-${reporte.periodo}.xls`,
        'application/vnd.ms-excel;charset=utf-8',
        html
    );
}

function exportarReportePdf() {
    const reporte = ventasState.reporte;
    if (!reporte) {
        alert('Primero consulta un reporte.');
        return;
    }

    const rows = getReporteExportRows(reporte);
    const ventana = window.open('', '_blank');
    if (!ventana) {
        alert('No se pudo abrir la ventana de impresion.');
        return;
    }

    ventana.document.write(`
        <html>
            <head>
                <title>Reporte de ventas ${escapeHtml(reporte.periodo)}</title>
                <style>
                    body { font-family: Arial, sans-serif; color: #1f2a24; margin: 28px; }
                    h1 { font-size: 20px; margin-bottom: 4px; }
                    .summary { margin: 18px 0; padding: 12px; border: 1px solid #d8e1dc; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    th, td { border-bottom: 1px solid #d8e1dc; padding: 8px; text-align: left; }
                    th { background: #f0f7f3; }
                    td:last-child, th:last-child { text-align: right; }
                </style>
            </head>
            <body>
                <h1>Reporte de ventas</h1>
                <p>Periodo: ${escapeHtml(reporte.periodo)}</p>
                <div class="summary">
                    <strong>Ingresos: Bs ${centavosToMoney(reporte.total_centavos)}</strong><br>
                    Ventas confirmadas: ${Number(reporte.cantidad_ventas || 0)}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Metodo</th>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio unitario</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => `
                            <tr>
                                <td>${escapeHtml(row.metodo)}</td>
                                <td>${escapeHtml(row.producto)}</td>
                                <td>${row.cantidad}</td>
                                <td>Bs ${row.precio}</td>
                                <td>Bs ${row.subtotal}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
        </html>
    `);
    ventana.document.close();
    ventana.focus();
    ventana.print();
}

function getReporteExportRows(reporte) {
    const rows = [];
    (reporte.metodos_pago || []).forEach(metodo => {
        const productos = metodo.productos || [];
        if (!productos.length) {
            rows.push({
                metodo: formatMetodoPago(metodo.metodo_pago),
                producto: 'Sin detalle',
                cantidad: '',
                precio: '',
                subtotal: centavosToMoney(metodo.total_centavos)
            });
            return;
        }

        productos.forEach(producto => {
            rows.push({
                metodo: formatMetodoPago(metodo.metodo_pago),
                producto: getNombreProductoReporte(producto),
                cantidad: Number(producto.cantidad || 0),
                precio: centavosToMoney(producto.precio_unitario_centavos),
                subtotal: centavosToMoney(producto.subtotal_centavos)
            });
        });
    });
    return rows;
}

function abrirModalNuevaVenta() {
    ventasState.productos = [];
    document.getElementById('ventas-modal-title').textContent = 'Nueva venta';
    document.getElementById('ventas-modal-body').innerHTML = renderVentaForm();
    document.getElementById('ventas-modal').hidden = false;
    cargarSucursalesVentas();
    cargarEmpleadosVentas();
    cargarProductosVentas();
    cargarClientesVentas();
    seleccionarSucursalVenta();
    seleccionarEmpleadoVenta();
    seleccionarProductoVenta();
    renderProductosVenta();
    actualizarPagoCreditoVenta();
}

function cerrarModalVenta() {
    const modal = document.getElementById('ventas-modal');
    if (modal) modal.hidden = true;
}

function renderVentaForm() {
    return `
        <div id="venta-form">
            <div class="ventas-subsection compact-subsection">
                <h5>Cliente</h5>
                <div class="form-grid">
                    <div class="form-field client-field">
                        <span>Buscar cliente</span>
                        <input id="venta-cliente-buscar" type="text" placeholder="Nombre o CI/NIT" oninput="buscarClientesVenta()">
                        <select id="venta-cliente" onchange="actualizarFidelizacionVenta()">
                            <option value="">Consumidor final</option>
                        </select>
                        <button type="button" class="mini-btn" onclick="toggleNuevoClienteVenta()">Registrar nuevo cliente</button>

                        <div id="nuevo-cliente-box" class="nested-form" hidden>
                            <div class="ventas-section-header compact-header">
                                <h4>Nuevo cliente</h4>
                                <button type="button" class="link-btn" onclick="toggleNuevoClienteVenta(false)">Usar consumidor final</button>
                            </div>
                            <div class="form-grid">
                                <label>
                                    Nombre *
                                    <input id="nuevo-cliente-nombre" type="text" placeholder="Nombre completo">
                                </label>
                                <label>
                                    CI/NIT *
                                    <input id="nuevo-cliente-nit" type="text" placeholder="Documento">
                                </label>
                                <label>
                                    Telefono
                                    <input id="nuevo-cliente-telefono" type="text" placeholder="Opcional">
                                </label>
                                <label>
                                    Correo
                                    <input id="nuevo-cliente-correo" type="email" placeholder="Si esta vacio se usara correo estandar">
                                </label>
                            </div>
                        </div>

                        <div id="fidelizacion-box" class="loyalty-box" hidden>
                            <strong>Descuento por puntos</strong>
                            <span id="cliente-puntos-info">Puntos actuales: 0</span>
                            <label class="inline-check">
                                <input id="usar-descuento-puntos" type="checkbox" onchange="actualizarTotalVenta()">
                                Aplicar descuento de fidelizacion
                            </label>
                            <label>
                                Porcentaje permitido
                                <select id="descuento-puntos-porcentaje" onchange="actualizarTotalVenta()">
                                    <option value="0">Sin descuento por puntos</option>
                                </select>
                            </label>
                            <small class="field-help">Solo se habilita cuando el cliente tiene puntos suficientes.</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="ventas-subsection">
                <h5>Datos de venta</h5>
                <div class="form-grid">
                <label>
                    Sucursal *
                    <select id="venta-sucursal-select" onchange="seleccionarSucursalVenta()" required>
                        ${renderSucursalOptions()}
                    </select>
                </label>
                <input id="venta-sucursal-id" type="hidden">
                <input id="venta-sucursal-uid" type="hidden">
                <label>
                    Empleado
                    <select id="venta-empleado-select" onchange="seleccionarEmpleadoVenta()">
                        ${renderEmpleadoOptions()}
                    </select>
                </label>
                <input id="venta-empleado-uid" type="hidden">
                <label>
                    Tipo de venta *
                    <select id="venta-tipo" onchange="cambiarTipoVenta()" required>
                        <option value="contado">Contado</option>
                        <option value="credito">Credito</option>
                    </select>
                </label>
                </div>
            </div>

            <div class="ventas-subsection">
                <h5>Productos</h5>
                <div class="product-picker">
                    <input id="producto-id" type="hidden">
                    <input id="producto-uid" type="hidden">
                    <label class="product-picker-name">
                        Producto
                        <select id="producto-select" onchange="seleccionarProductoVenta()">
                            ${renderProductoOptions()}
                        </select>
                    </label>
                    <label>
                        Cantidad
                        <input id="producto-cantidad" type="number" min="1" step="1" value="1" aria-label="Cantidad">
                    </label>
                    <label>
                        Precio Bs
                        <input id="producto-precio" type="number" min="0.01" step="0.01" placeholder="Precio unitario" readonly>
                    </label>
                    <button type="button" class="add-product-btn" onclick="agregarProductoVenta()">Agregar</button>
                    <div id="producto-stock-info" class="product-stock-info">Selecciona una sucursal y un producto para ver stock.</div>
                </div>
                <div id="venta-productos"></div>
            </div>

            <div class="ventas-subsection">
                <h5>Pago inicial</h5>
                <div class="form-grid">
                    <label>
                        Metodo de pago *
                        <select id="venta-metodo-pago" required>
                            <option value="sin_pago">Sin pago inicial</option>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="qr">QR</option>
                            <option value="transferencia">Transferencia</option>
                        </select>
                    </label>
                    <label>
                        Referencia
                        <input id="venta-referencia" type="text" placeholder="Opcional">
                    </label>
                    <label id="credito-monto-field" hidden>
                        Monto inicial pagado Bs
                        <input id="venta-monto-inicial" type="number" min="0" step="0.01" value="0" oninput="actualizarPagoCreditoVenta()">
                        <small class="field-help">En credito puede ser 0 o menor al total.</small>
                    </label>
                </div>
                <p id="credito-saldo-info" class="muted" hidden>Saldo pendiente: Bs 0.00</p>
            </div>

            <div class="venta-total">
                <span>Total</span>
                <strong id="venta-total">Bs 0.00</strong>
            </div>

            <div id="venta-mensaje" class="ventas-message" hidden></div>
            <div class="modal-footer">
                <button type="button" class="action-btn ghost-action" onclick="cerrarModalVenta()">Cancelar</button>
                <button type="button" class="action-btn create-action" onclick="registrarVenta(event)">Registrar venta</button>
            </div>
        </div>
    `;
}

function renderSucursalOptions(emptyLabel = 'Cargando sucursales...') {
    const options = ventasState.sucursales.map(sucursal => {
        return `<option value="${escapeHtml(sucursal.uid)}">${escapeHtml(sucursal.nombre)}</option>`;
    }).join('');

    return `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function renderEmpleadoOptions(emptyLabel = 'Cargando empleados...') {
    const empleados = getEmpleadosDisponiblesVenta();
    const options = empleados.map(empleado => {
        return `<option value="${escapeHtml(empleado.uid)}">${escapeHtml(empleado.nombre)}</option>`;
    }).join('');

    const label = getEmpleadoEmptyLabel(emptyLabel, empleados.length);
    return `<option value="">${escapeHtml(label)}</option>${options}`;
}

function renderProductoOptions(emptyLabel = 'Cargando productos...') {
    const productos = getProductosDisponiblesVenta();
    const options = productos.map(producto => {
        return `<option value="${escapeHtml(producto.uid)}">${escapeHtml(producto.nombre)} - Bs ${Number(producto.precio).toFixed(2)}</option>`;
    }).join('');

    return `
        <option value="">${escapeHtml(getProductoEmptyLabel(emptyLabel, productos.length))}</option>
        ${options}
    `;
}

async function cargarSucursalesVentas() {
    llenarComboSucursales('Cargando sucursales...');
    try {
        const response = await apiCall(API_PORTS.administracion, VENTAS_EXTERNAL_ROUTES.sucursales);
        ventasState.sucursales = getResponseList(response, ['sucursales'])
            .map(normalizarSucursal)
            .filter(item => item.uid);
        llenarComboSucursales(ventasState.sucursales.length ? 'Selecciona sucursal' : 'Sucursales no disponibles');
    } catch (error) {
        ventasState.sucursales = [];
        llenarComboSucursales('Sucursales no disponibles');
    }
}

async function cargarEmpleadosVentas() {
    llenarComboEmpleados('Cargando empleados...');
    try {
        const response = await apiCall(API_PORTS.administracion, VENTAS_EXTERNAL_ROUTES.empleados);
        ventasState.empleados = getResponseList(response, ['empleados'])
            .map(normalizarEmpleado)
            .filter(item => item.uid);
        llenarComboEmpleados(ventasState.empleados.length ? 'Selecciona empleado' : 'Empleados no disponibles');
    } catch (error) {
        ventasState.empleados = [];
        llenarComboEmpleados('Empleados no disponibles');
    }
}

async function cargarProductosVentas() {
    llenarComboProductos('Cargando productos...');
    try {
        const response = await apiCall(API_PORTS.productos, VENTAS_EXTERNAL_ROUTES.productos);
        ventasState.catalogoProductos = getResponseList(response, ['productos'])
            .map(normalizarProducto)
            .filter(item => item.uid);
        llenarComboProductos(ventasState.catalogoProductos.length ? 'Selecciona producto' : 'Productos no disponibles');
    } catch (error) {
        ventasState.catalogoProductos = [];
        llenarComboProductos('Productos no disponibles');
    }
}

async function cargarStockSucursalVenta() {
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    const sucursalId = document.getElementById('venta-sucursal-id')?.value;
    ventasState.stockPorProducto = {};
    ventasState.stockSucursalCargado = false;

    if (!sucursalUid && !sucursalId) {
        actualizarStockProductoVenta('Selecciona una sucursal para consultar stock.');
        llenarComboProductos('Selecciona producto');
        return;
    }

    actualizarStockProductoVenta('Consultando stock de la sucursal...');
    try {
        const response = await apiCall(API_PORTS.inventario, VENTAS_EXTERNAL_ROUTES.stockSucursal);
        const stockItems = getResponseList(response, ['data', 'stock', 'inventario', 'items', 'productos'])
            .map(normalizarStockProducto)
            .filter(item => {
                const mismaSucursal = item.sucursal_uid === sucursalUid
                    || (sucursalId && String(item.sucursal_id) === String(sucursalId));
                return mismaSucursal && (item.producto_uid || item.producto_id);
            });

        stockItems.forEach(item => {
            if (item.producto_uid) ventasState.stockPorProducto[item.producto_uid] = item.stock;
            if (item.producto_id) ventasState.stockPorProducto[`id:${item.producto_id}`] = item.stock;
        });
        ventasState.stockSucursalCargado = true;
        llenarComboProductos(stockItems.length ? 'Selecciona producto' : 'Sin stock en esta sucursal');
        actualizarStockProductoVenta();
    } catch (error) {
        ventasState.stockPorProducto = {};
        ventasState.stockSucursalCargado = false;
        llenarComboProductos('Selecciona producto');
        actualizarStockProductoVenta('Stock no disponible. No responde el balance de inventario.');
    }
}

function llenarComboSucursales(emptyLabel = 'Selecciona sucursal') {
    const select = document.getElementById('venta-sucursal-select');
    if (!select) return;
    select.innerHTML = renderSucursalOptions(emptyLabel);
    seleccionarSucursalVenta();
}

function llenarComboEmpleados(emptyLabel = 'Selecciona empleado') {
    const select = document.getElementById('venta-empleado-select');
    if (!select) return;
    select.innerHTML = renderEmpleadoOptions(emptyLabel);
    seleccionarEmpleadoVenta();
}

function llenarComboProductos(emptyLabel = 'Selecciona producto') {
    const select = document.getElementById('producto-select');
    if (!select) return;
    select.innerHTML = renderProductoOptions(emptyLabel);
    seleccionarProductoVenta();
}

function getProductosDisponiblesVenta() {
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    if (!sucursalUid || !ventasState.stockSucursalCargado) {
        return ventasState.catalogoProductos;
    }

    return ventasState.catalogoProductos.filter(producto => {
        const stock = getStockProducto(producto.uid);
        return stock !== null && stock > 0;
    });
}

function getProductoEmptyLabel(defaultLabel, productosCount) {
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    if (!sucursalUid) return defaultLabel;
    if (!ventasState.stockSucursalCargado) return defaultLabel;
    if (!productosCount) return 'No hay productos con stock en esta sucursal';
    return defaultLabel;
}

function getEmpleadosDisponiblesVenta() {
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    const sucursalId = document.getElementById('venta-sucursal-id')?.value;
    if (!sucursalUid && !sucursalId) return [];

    return ventasState.empleados.filter(empleado => {
        const activo = !empleado.estado || empleado.estado === 'activo';
        const mismaSucursal = empleado.sucursal_uid === sucursalUid
            || (sucursalId && String(empleado.sucursal_id) === String(sucursalId));
        return activo && mismaSucursal;
    });
}

function getEmpleadoEmptyLabel(defaultLabel, empleadosCount) {
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    if (!sucursalUid) return 'Selecciona una sucursal primero';
    if (!ventasState.empleados.length && /cargando|no disponibles/i.test(defaultLabel)) return defaultLabel;
    if (!empleadosCount) return 'No hay empleados activos en esta sucursal';
    return defaultLabel;
}

function seleccionarSucursalVenta() {
    const select = document.getElementById('venta-sucursal-select');
    if (!select) return;

    const sucursal = ventasState.sucursales.find(item => item.uid === select.value);
    document.getElementById('venta-sucursal-id').value = sucursal ? sucursal.id : '';
    document.getElementById('venta-sucursal-uid').value = sucursal ? sucursal.uid : '';
    llenarComboEmpleados();
    cargarStockSucursalVenta();
}

function seleccionarEmpleadoVenta() {
    const select = document.getElementById('venta-empleado-select');
    const uidInput = document.getElementById('venta-empleado-uid');
    if (!select || !uidInput) return;

    const empleado = ventasState.empleados.find(item => item.uid === select.value);
    uidInput.value = empleado ? empleado.uid : '';
}

function seleccionarProductoVenta() {
    const select = document.getElementById('producto-select');
    const idInput = document.getElementById('producto-id');
    const uidInput = document.getElementById('producto-uid');
    const precioInput = document.getElementById('producto-precio');
    if (!select || !idInput || !uidInput || !precioInput) return;

    const producto = ventasState.catalogoProductos.find(item => item.uid === select.value);
    idInput.value = producto ? producto.id : '';
    uidInput.value = producto ? producto.uid : '';
    precioInput.value = producto ? Number(producto.precio).toFixed(2) : '';
    precioInput.readOnly = true;
    actualizarLimitesCantidadProductoVenta();
    actualizarStockProductoVenta();
}

function actualizarStockProductoVenta(message = null) {
    const info = document.getElementById('producto-stock-info');
    if (!info) return;

    info.className = 'product-stock-info';
    if (message) {
        info.textContent = message;
        if (/no disponible|falta|no responde/i.test(message)) {
            info.classList.add('stock-warning');
        }
        return;
    }

    const productoUid = document.getElementById('producto-uid')?.value.trim();
    const sucursalUid = document.getElementById('venta-sucursal-uid')?.value.trim();
    if (!sucursalUid) {
        info.textContent = 'Selecciona una sucursal para consultar stock.';
        return;
    }
    if (!productoUid) {
        info.textContent = 'Selecciona un producto para ver stock.';
        return;
    }

    const stock = getStockProducto(productoUid);
    if (stock === null) {
        info.textContent = 'Stock no disponible para este producto.';
        info.classList.add('stock-warning');
        return;
    }

    const cantidadEnVenta = getCantidadProductoEnVenta(productoUid);
    const restante = Math.max(stock - cantidadEnVenta, 0);
    const cantidadActual = Number(document.getElementById('producto-cantidad')?.value || 0);
    info.textContent = `Stock disponible: ${stock}. Ya agregado: ${cantidadEnVenta}. Restante: ${restante}.`;
    if (cantidadActual > restante) {
        info.textContent = `No hay stock suficiente. Disponible para agregar: ${restante}. Cantidad solicitada: ${cantidadActual}.`;
        info.classList.add('stock-warning');
        return;
    }
    if (restante <= 0) {
        info.classList.add('stock-warning');
    }
}

function toggleNuevoClienteVenta(forceValue = null) {
    const box = document.getElementById('nuevo-cliente-box');
    const select = document.getElementById('venta-cliente');
    if (!box) return;

    const shouldShow = forceValue === null ? box.hidden : forceValue;
    box.hidden = !shouldShow;
    if (shouldShow && select) {
        select.value = '';
    }
    actualizarFidelizacionVenta();
}

async function cargarClientesVentas() {
    try {
        const response = await apiCall(API_PORTS.clientes, '/api/clientes?limit=20');
        ventasState.clientes = response.data || [];
        llenarComboClientes();
    } catch (error) {
        ventasState.clientes = [];
        llenarComboClientes('Clientes no disponibles');
    }
}

function buscarClientesVenta() {
    clearTimeout(clienteSearchTimeout);
    const input = document.getElementById('venta-cliente-buscar');
    const texto = input ? input.value.trim() : '';
    llenarComboClientes(texto ? 'Buscando clientes...' : 'Consumidor final');
    clienteSearchTimeout = setTimeout(cargarClientesPorBusqueda, 300);
}

async function cargarClientesPorBusqueda() {
    const input = document.getElementById('venta-cliente-buscar');
    const texto = input ? input.value.trim() : '';
    const ruta = texto
        ? `/api/clientes/buscar?q=${encodeURIComponent(texto)}`
        : '/api/clientes?limit=20';

    try {
        const response = await apiCall(API_PORTS.clientes, ruta);
        ventasState.clientes = response.data || [];
        llenarComboClientes(getClienteSearchLabel(texto), getClienteAutoSelectUid(texto));
    } catch (error) {
        if (!texto) {
            ventasState.clientes = [];
            llenarComboClientes('Clientes no disponibles');
            return;
        }

        try {
            const fallback = await apiCall(API_PORTS.clientes, `/api/clientes?buscar=${encodeURIComponent(texto)}&limit=20`);
            ventasState.clientes = fallback.data || [];
            llenarComboClientes(getClienteSearchLabel(texto), getClienteAutoSelectUid(texto));
        } catch (fallbackError) {
            ventasState.clientes = [];
            llenarComboClientes('Clientes no disponibles');
        }
    }
}

function getClienteSearchLabel(texto) {
    if (!texto) return 'Consumidor final';
    const total = ventasState.clientes.filter(cliente => cliente.estado !== 'inactivo').length;
    if (!total) return 'No se encontraron clientes';
    return `Selecciona cliente (${total} encontrado${total === 1 ? '' : 's'})`;
}

function getClienteAutoSelectUid(texto) {
    const query = normalizeSpaces(texto || '').toLowerCase();
    if (!query) return '';

    const exacto = ventasState.clientes.find(cliente => {
        const nombre = normalizeSpaces(cliente.nombre || '').toLowerCase();
        const documento = normalizeSpaces(cliente.nit_ci || '').toLowerCase();
        return documento === query || nombre === query;
    });

    return exacto ? exacto.uid : '';
}

function llenarComboClientes(emptyLabel = 'Consumidor final', selectedUid = '') {
    const select = document.getElementById('venta-cliente');
    if (!select) return;

    select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
    ventasState.clientes
        .filter(cliente => cliente.estado !== 'inactivo')
        .forEach(cliente => {
            const option = document.createElement('option');
            option.value = cliente.uid;
            option.textContent = formatClienteOption(cliente);
            select.appendChild(option);
        });

    if (selectedUid) {
        select.value = selectedUid;
    }
    actualizarFidelizacionVenta();
}

function formatClienteOption(cliente) {
    const nombre = cliente.nombre || 'Cliente sin nombre';
    const documento = cliente.nit_ci || 'S/N';
    const puntos = Number(cliente.puntos || 0);
    return `${nombre} - CI/NIT ${documento} - ${puntos} pts`;
}

function actualizarFidelizacionVenta() {
    const select = document.getElementById('venta-cliente');
    const box = document.getElementById('fidelizacion-box');
    const info = document.getElementById('cliente-puntos-info');
    const useCheckbox = document.getElementById('usar-descuento-puntos');
    const percentSelect = document.getElementById('descuento-puntos-porcentaje');
    if (!select || !box || !info || !useCheckbox || !percentSelect) return;

    const cliente = ventasState.clientes.find(item => item.uid === select.value);
    if (!cliente) {
        box.hidden = true;
        useCheckbox.checked = false;
        percentSelect.innerHTML = '<option value="0">Sin descuento por puntos</option>';
        actualizarTotalVenta();
        return;
    }

    const puntos = Number(cliente.puntos || 0);
    const maxPercent = getMaxDiscountPercentFromPoints(puntos);
    box.hidden = false;
    info.textContent = `Puntos actuales: ${puntos}. Descuento permitido: ${maxPercent}%`;

    const options = ['<option value="0">Sin descuento por puntos</option>'];
    for (let percent = 10; percent <= maxPercent; percent += 10) {
        options.push(`<option value="${percent}">${percent}% de descuento</option>`);
    }
    percentSelect.innerHTML = options.join('');
    useCheckbox.disabled = maxPercent < 10;
    if (maxPercent < 10) {
        useCheckbox.checked = false;
    }
    actualizarTotalVenta();
}

async function cargarVentas() {
    const listado = document.getElementById('ventas-listado');
    listado.innerHTML = '<p class="muted">Cargando ventas...</p>';
    try {
        const response = await apiCall(API_PORTS.ventas, '/api/ventas');
        ventasState.ventas = response.data || [];
        await cargarReferenciasVentasListado();
        renderTablaVentas();
    } catch (error) {
        listado.innerHTML = '<p class="error-text">No se pudieron cargar las ventas.</p>';
    }
}

async function cargarReferenciasVentasListado() {
    await Promise.all([
        cargarClientesListadoPorUid(),
        cargarSucursalesListado()
    ]);
}

async function cargarClientesListadoPorUid() {
    const clienteUids = [...new Set(ventasState.ventas.map(venta => venta.cliente_uid).filter(Boolean))];
    await Promise.all(clienteUids.map(async uid => {
        if (ventasState.clientesPorUid[uid]) return;
        try {
            const response = await apiCall(API_PORTS.clientes, `/api/clientes/uid/${encodeURIComponent(uid)}`);
            const cliente = response.data || null;
            ventasState.clientesPorUid[uid] = cliente && cliente.nombre ? cliente.nombre : uid;
        } catch (error) {
            ventasState.clientesPorUid[uid] = uid;
        }
    }));
}

async function cargarSucursalesListado() {
    try {
        const response = await apiCall(API_PORTS.administracion, VENTAS_EXTERNAL_ROUTES.sucursales);
        const sucursales = getResponseList(response, ['sucursales'])
            .map(normalizarSucursal)
            .filter(item => item.uid);

        sucursales.forEach(sucursal => {
            ventasState.sucursalesPorUid[sucursal.uid] = sucursal.nombre || sucursal.uid;
        });
    } catch (error) {
        ventasState.ventas
            .map(venta => venta.sucursal_uid)
            .filter(Boolean)
            .forEach(uid => {
                if (!ventasState.sucursalesPorUid[uid]) ventasState.sucursalesPorUid[uid] = uid;
            });
    }
}

function filtrarVentasTabla(value) {
    ventasState.ventasFiltro = normalizeSpaces(value).toLowerCase();
    renderTablaVentas();
}

function renderTablaVentas() {
    const listado = document.getElementById('ventas-listado');
    if (!ventasState.ventas.length) {
        listado.innerHTML = '<p class="muted">Todavia no hay ventas registradas.</p>';
        return;
    }

    const ventasFiltradas = getVentasFiltradas();
    if (!ventasFiltradas.length) {
        listado.innerHTML = '<p class="muted">No hay ventas que coincidan con la busqueda.</p>';
        return;
    }

    listado.innerHTML = `
        <table class="ventas-table">
            <thead>
                    <tr>
                        <th><span class="th-icon">&#128196;</span> Factura</th>
                        <th><span class="th-icon">&#128197;</span> Fecha</th>
                        <th><span class="th-icon">&#128100;</span> Cliente</th>
                        <th><span class="th-icon">&#127970;</span> Sucursal</th>
                        <th><span class="th-icon">&#128181;</span> Total</th>
                        <th><span class="th-icon">&#9679;</span> Estado</th>
                        <th><span class="th-icon">&#9881;</span> Acciones</th>
                    </tr>
            </thead>
            <tbody>
                ${ventasFiltradas.map(venta => `
                    <tr>
                        <td>${escapeHtml(venta.numero_factura || 'Sin factura')}</td>
                        <td>${escapeHtml(formatDate(venta.creado_en))}</td>
                        <td>${escapeHtml(getNombreClienteVenta(venta))}</td>
                        <td>${escapeHtml(getNombreSucursalVenta(venta))}</td>
                        <td>Bs ${centavosToMoney(venta.total_centavos)}</td>
                        <td>${renderEstadoVentaTabla(venta)}</td>
                        <td class="table-actions">
                            <button type="button" class="table-action view-action" onclick="verDetalleVenta(${venta.id})">Ver</button>
                            <button type="button" class="table-action pdf-table-action" onclick="descargarComprobante(${venta.id})">PDF</button>
                            ${venta.estado !== 'anulada' ? `<button type="button" class="table-action cancel-action" onclick="anularVenta(${venta.id})">Anular</button>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getVentasFiltradas() {
    const filtro = ventasState.ventasFiltro;
    if (!filtro) return ventasState.ventas;

    return ventasState.ventas.filter(venta => {
        const values = [
            venta.numero_factura,
            formatDate(venta.creado_en),
            getNombreClienteVenta(venta),
            venta.cliente_uid,
            getNombreSucursalVenta(venta),
            venta.sucursal_uid,
            centavosToMoney(venta.total_centavos),
            venta.estado,
            venta.tipo_venta,
            centavosToMoney(venta.saldo_pendiente_centavos)
        ];
        return values.some(value => String(value || '').toLowerCase().includes(filtro));
    });
}

function renderEstadoVentaTabla(venta) {
    const estadoClass = venta.estado === 'anulada' ? 'status-pill cancelled' : 'status-pill';
    const saldo = Number(venta.saldo_pendiente_centavos || 0);
    const notaCredito = venta.estado !== 'anulada' && venta.tipo_venta === 'credito'
        ? `<small class="credit-note">${saldo > 0 ? `Credito: saldo Bs ${centavosToMoney(saldo)}` : 'Credito sin saldo'}</small>`
        : '';

    return `
        <div class="sale-status-cell">
            <span class="${estadoClass}">${escapeHtml(venta.estado)}</span>
            ${notaCredito}
        </div>
    `;
}

function getNombreClienteVenta(venta) {
    if (venta.cliente_nombre) return venta.cliente_nombre;
    if (venta.factura && venta.factura.cliente_nombre) return venta.factura.cliente_nombre;
    if (!venta.cliente_uid) return 'Consumidor final';
    return ventasState.clientesPorUid[venta.cliente_uid] || venta.cliente_uid;
}

function guardarNombreClienteDesdeVenta(venta) {
    if (!venta || !venta.cliente_uid) return;
    const nombre = venta.cliente_nombre || venta.factura?.cliente_nombre;
    if (nombre) {
        ventasState.clientesPorUid[venta.cliente_uid] = nombre;
    }
}

function getNombreSucursalVenta(venta) {
    if (!venta.sucursal_uid) return 'S/N';
    return ventasState.sucursalesPorUid[venta.sucursal_uid] || venta.sucursal_uid;
}

async function verDetalleVenta(ventaId) {
    try {
        const response = await apiCall(API_PORTS.ventas, `/api/ventas/${ventaId}`);
        const venta = response.data;
        if (!ventasState.catalogoProductos.length) {
            await cargarProductosVentas();
        }
        document.getElementById('ventas-modal-title').textContent = `Detalle ${venta.uid}`;
        document.getElementById('ventas-modal-body').innerHTML = renderDetalleVenta(venta);
        document.getElementById('ventas-modal').hidden = false;
    } catch (error) {
        alert('No se pudo cargar el detalle de la venta.');
    }
}

function renderDetalleVenta(venta) {
    return `
        <div class="detalle-grid">
            <p><strong>Venta:</strong> ${escapeHtml(venta.uid)}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(venta.cliente_uid || 'Consumidor final')}</p>
            <p><strong>Tipo de venta:</strong> ${escapeHtml(venta.tipo_venta || 'contado')}</p>
            <p><strong>Total:</strong> Bs ${centavosToMoney(venta.total_centavos)}</p>
            <p><strong>Pagado:</strong> Bs ${centavosToMoney(venta.monto_pagado_centavos)}</p>
            <p><strong>Saldo pendiente:</strong> Bs ${centavosToMoney(venta.saldo_pendiente_centavos)}</p>
            <p><strong>Estado:</strong> ${escapeHtml(venta.estado)}</p>
        </div>
        <h5>Productos</h5>
        <table class="ventas-table">
            <thead>
                <tr>
                    <th><span class="th-icon">&#128230;</span> Producto</th>
                    <th><span class="th-icon">&#35;</span> Cantidad</th>
                    <th><span class="th-icon">&#128181;</span> Precio</th>
                    <th><span class="th-icon">&#128184;</span> Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${(venta.detalle || []).map(item => `
                    <tr>
                        <td>${escapeHtml(getNombreProductoReporte(item))}</td>
                        <td>${item.cantidad}</td>
                        <td>Bs ${centavosToMoney(item.precio_unitario_centavos)}</td>
                        <td>Bs ${centavosToMoney(item.subtotal_centavos)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <h5>Pagos</h5>
        <table class="ventas-table">
            <thead>
                <tr>
                    <th><span class="th-icon">&#128179;</span> Metodo</th>
                    <th><span class="th-icon">&#128181;</span> Monto</th>
                    <th><span class="th-icon">&#128279;</span> Referencia</th>
                </tr>
            </thead>
            <tbody>
                ${(venta.pagos || []).length ? (venta.pagos || []).map(pago => `
                    <tr>
                        <td>${escapeHtml(pago.metodo_pago)}</td>
                        <td>Bs ${centavosToMoney(pago.monto_centavos)}</td>
                        <td>${escapeHtml(pago.referencia || '-')}</td>
                    </tr>
                `).join('') : '<tr><td colspan="3">Sin pagos registrados todavia.</td></tr>'}
            </tbody>
        </table>
        <div class="modal-footer">
            <button type="button" class="action-btn ghost-action" onclick="cerrarModalVenta()">Cerrar</button>
            <button type="button" class="action-btn pdf-action" onclick="descargarComprobante(${venta.id})">Descargar PDF</button>
            ${venta.estado !== 'anulada' ? `<button type="button" class="action-btn danger-action" onclick="anularVenta(${venta.id})">Anular venta</button>` : ''}
        </div>
    `;
}

async function anularVenta(ventaId) {
    const confirmed = await confirmarAccionVentas({
        title: 'Anular venta',
        message: 'La venta se marcara como anulada.',
        detail: 'Se devolvera el stock y se revertira la fidelizacion si corresponde.',
        confirmText: 'Si, anular',
        cancelText: 'Cancelar',
        type: 'danger'
    });
    if (!confirmed) return;

    try {
        const response = await apiCall(API_PORTS.ventas, `/api/ventas/${ventaId}`, 'DELETE');
        await cargarVentas();
        const modal = document.getElementById('ventas-modal');
        if (modal && !modal.hidden) {
            const venta = response.data;
            document.getElementById('ventas-modal-title').textContent = `Detalle ${venta.uid}`;
            document.getElementById('ventas-modal-body').innerHTML = renderDetalleVenta(venta);
        }
        const warnings = response.advertencias && response.advertencias.length
            ? ` Advertencias: ${response.advertencias.join(' ')}`
            : '';
        mostrarNotificacionVentas(
            `${response.message || 'Venta anulada correctamente.'}${warnings}`,
            response.status === 'warning' ? 'warning' : 'success'
        );
    } catch (error) {
        mostrarNotificacionVentas('Error: no se pudo anular la venta. Revise los datos e intente nuevamente.', 'error');
    }
}

function agregarProductoVenta() {
    const productoId = document.getElementById('producto-id').value;
    const productoUid = document.getElementById('producto-uid').value.trim();
    const cantidad = Number(document.getElementById('producto-cantidad').value);
    const precio = Number(document.getElementById('producto-precio').value);
    const productoSeleccionado = ventasState.catalogoProductos.find(item => item.uid === productoUid);
    const stock = getStockProducto(productoUid);
    const cantidadYaAgregada = getCantidadProductoEnVenta(productoUid);
    const errors = [];

    if (!isPositiveInteger(productoId) || !isSafeRequiredText(productoUid)) {
        errors.push('Selecciona un producto de la lista.');
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) errors.push('La cantidad debe ser un entero positivo.');
    if (!Number.isFinite(precio) || precio <= 0) errors.push('El precio debe ser mayor a cero.');
    if (stock !== null && cantidad + cantidadYaAgregada > stock) {
        const disponibleParaAgregar = Math.max(stock - cantidadYaAgregada, 0);
        errors.push(`No hay stock suficiente para este producto. Disponible para agregar: ${disponibleParaAgregar}. Cantidad solicitada: ${cantidad}.`);
    }

    if (errors.length) {
        mostrarMensajeVenta(errors.join(' '), 'error');
        return;
    }

    ventasState.productos.push({
        producto_id: Number(productoId),
        producto_uid: productoUid,
        producto_nombre: productoSeleccionado ? productoSeleccionado.nombre : productoUid,
        cantidad,
        precio_unitario: precio.toFixed(2)
    });

    document.getElementById('producto-id').value = '';
    document.getElementById('producto-uid').value = '';
    document.getElementById('producto-cantidad').value = 1;
    document.getElementById('producto-precio').value = '';
    document.getElementById('producto-select').value = '';
    seleccionarProductoVenta();
    mostrarMensajeVenta('Producto agregado.', false);
    renderProductosVenta();
    actualizarStockProductoVenta();
}

function quitarProductoVenta(index) {
    ventasState.productos.splice(index, 1);
    renderProductosVenta();
    actualizarLimitesCantidadProductoVenta();
    actualizarStockProductoVenta();
}

function renderProductosVenta() {
    const container = document.getElementById('venta-productos');
    if (!container) return;

    if (!ventasState.productos.length) {
        container.innerHTML = '<p class="muted">Agrega productos para registrar la venta.</p>';
    } else {
        container.innerHTML = `
            <table class="ventas-table">
                <thead>
                    <tr>
                        <th><span class="th-icon">&#128230;</span> Producto</th>
                        <th><span class="th-icon">&#35;</span> Cant.</th>
                        <th><span class="th-icon">&#128181;</span> Precio</th>
                        <th><span class="th-icon">&#128184;</span> Subtotal</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${ventasState.productos.map((producto, index) => `
                        <tr>
                            <td>${escapeHtml(producto.producto_nombre || producto.producto_uid)}</td>
                            <td>${producto.cantidad}</td>
                            <td>Bs ${Number(producto.precio_unitario).toFixed(2)}</td>
                            <td>Bs ${(producto.cantidad * Number(producto.precio_unitario)).toFixed(2)}</td>
                            <td><button type="button" class="link-btn" onclick="quitarProductoVenta(${index})">Quitar</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    actualizarTotalVenta();
}

function validarVentaAntesDeEnviar() {
    const errors = [];
    const sucursalId = document.getElementById('venta-sucursal-id').value;
    const sucursalUid = document.getElementById('venta-sucursal-uid').value.trim();
    const empleadoUid = document.getElementById('venta-empleado-uid').value.trim();
    const clienteUid = document.getElementById('venta-cliente').value;
    const nuevoClienteBox = document.getElementById('nuevo-cliente-box');
    const creandoCliente = nuevoClienteBox && !nuevoClienteBox.hidden;
    const nuevoClienteNombre = normalizeSpaces(document.getElementById('nuevo-cliente-nombre')?.value || '');
    const nuevoClienteNit = normalizeSpaces(document.getElementById('nuevo-cliente-nit')?.value || '');
    const nuevoClienteTelefono = normalizeSpaces(document.getElementById('nuevo-cliente-telefono')?.value || '');
    const nuevoClienteCorreo = normalizeSpaces(document.getElementById('nuevo-cliente-correo')?.value || '').toLowerCase();
    const referencia = document.getElementById('venta-referencia').value.trim();
    const usarDescuentoPuntos = document.getElementById('usar-descuento-puntos')?.checked || false;
    const porcentajePuntos = Number(document.getElementById('descuento-puntos-porcentaje')?.value || 0);
    const tipoVenta = document.getElementById('venta-tipo')?.value || 'contado';
    const montoPago = getMontoPagoVenta();
    const metodoPago = document.getElementById('venta-metodo-pago')?.value || '';
    const total = calcularTotalVenta();
    const subtotal = calcularSubtotalVenta();

    if (!isPositiveInteger(sucursalId) || !isSafeRequiredText(sucursalUid)) {
        errors.push('Selecciona una sucursal.');
    }
    if (!empleadoUid) {
        errors.push('Selecciona un empleado.');
    } else if (!ventasState.empleados.some(empleado => empleado.uid === empleadoUid)) {
        errors.push('El empleado seleccionado no es valido.');
    }
    if (clienteUid && !ventasState.clientes.some(cliente => cliente.uid === clienteUid)) {
        errors.push('El cliente seleccionado no es valido.');
    }
    if (usarDescuentoPuntos) {
        const cliente = ventasState.clientes.find(item => item.uid === clienteUid);
        const maxPercent = getMaxDiscountPercentFromPoints(cliente ? cliente.puntos : 0);
        if (!cliente) errors.push('Debes seleccionar un cliente registrado para usar puntos.');
        if (![10, 20, 30].includes(porcentajePuntos)) errors.push('Selecciona un porcentaje valido para usar puntos.');
        if (porcentajePuntos > maxPercent) errors.push(`El cliente solo puede usar hasta ${maxPercent}% con sus puntos actuales.`);
        if (maxPercent < 10) errors.push('El cliente necesita al menos 100 puntos para usar descuento.');
    }
    if (creandoCliente) {
        syncNuevoClienteInputs();
        if (!isValidPersonName(nuevoClienteNombre)) errors.push('El nombre del nuevo cliente debe contener solo letras y espacios simples.');
        if (!isValidNitCi(nuevoClienteNit)) errors.push('El CI/NIT debe contener solo letras, numeros o guiones.');
        if (nuevoClienteTelefono && !isSafeText(nuevoClienteTelefono)) errors.push('El telefono del nuevo cliente no puede contener HTML.');
        if (nuevoClienteTelefono && !isValidPhone(nuevoClienteTelefono)) errors.push('El telefono debe contener solo numeros, espacios, + o guiones.');
        if (nuevoClienteCorreo && !isSafeText(nuevoClienteCorreo)) errors.push('El correo del nuevo cliente no puede contener HTML.');
        if (nuevoClienteCorreo && !isValidEmail(nuevoClienteCorreo)) errors.push('El correo del nuevo cliente no tiene formato valido.');
    }
    if (empleadoUid && !isSafeText(empleadoUid)) errors.push('El empleado seleccionado no es valido.');
    if (referencia && !isSafeText(referencia)) errors.push('La referencia de pago no puede contener HTML.');
    if (!ventasState.productos.length) errors.push('Agrega al menos un producto.');
    if (total <= 0) errors.push('El total de la venta debe ser mayor a cero.');
    if (tipoVenta === 'credito') {
        if (!Number.isFinite(montoPago) || montoPago < 0) errors.push('El monto inicial no puede ser negativo.');
        if (montoPago > total) errors.push('El monto inicial no puede superar el total de la venta.');
    }
    if (tipoVenta === 'contado' && montoPago !== total) {
        errors.push('En ventas al contado el monto pagado debe ser igual al total.');
    }
    if (metodoPago === 'sin_pago' && (tipoVenta !== 'credito' || montoPago > 0)) {
        errors.push('Sin pago inicial solo se permite en ventas a credito con monto inicial 0.');
    }

    ventasState.productos.forEach((producto, index) => {
        if (!isPositiveInteger(producto.producto_id) || !isSafeRequiredText(producto.producto_uid)) {
            errors.push(`El producto ${index + 1} no es valido. Vuelve a seleccionarlo.`);
        }
    });
    const productosRevisados = new Set();
    ventasState.productos.forEach(producto => {
        if (productosRevisados.has(producto.producto_uid)) return;
        productosRevisados.add(producto.producto_uid);

        const stock = getStockProducto(producto.producto_uid);
        const cantidad = getCantidadProductoEnVenta(producto.producto_uid);
        if (stock !== null && cantidad > stock) {
            errors.push(`Stock insuficiente para ${producto.producto_nombre || producto.producto_uid}. Disponible: ${stock}. Solicitado: ${cantidad}.`);
        }
    });

    return errors;
}

async function obtenerClienteParaVenta() {
    const nuevoClienteBox = document.getElementById('nuevo-cliente-box');
    const creandoCliente = nuevoClienteBox && !nuevoClienteBox.hidden;

    if (!creandoCliente) {
        const clienteUid = document.getElementById('venta-cliente').value;
        return ventasState.clientes.find(item => item.uid === clienteUid) || null;
    }

    syncNuevoClienteInputs();

    const nitCi = normalizeSpaces(document.getElementById('nuevo-cliente-nit').value);
    const clientePayload = {
        nombre: normalizeSpaces(document.getElementById('nuevo-cliente-nombre').value),
        nit_ci: nitCi,
        telefono: normalizeSpaces(document.getElementById('nuevo-cliente-telefono').value) || '00000000',
        correo: normalizeSpaces(document.getElementById('nuevo-cliente-correo').value).toLowerCase() || 'sin-correo@abuelitaserafina.bo',
        estado: 'activo'
    };

    return {
        ...clientePayload,
        crear_nuevo: true
    };
}

async function registrarVenta(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const submitButton = event?.target?.closest('button');
    if (submitButton?.disabled) return false;
    if (submitButton) submitButton.disabled = true;
    actualizarTotalVenta();

    const errors = validarVentaAntesDeEnviar();
    if (errors.length) {
        if (submitButton) submitButton.disabled = false;
        mostrarMensajeVenta(errors.join(' '), 'error');
        return false;
    }

    let cliente = null;
    const total = calcularTotalVenta();
    const montoPago = getMontoPagoVenta();

    try {
        cliente = await obtenerClienteParaVenta();
    } catch (error) {
        if (submitButton) submitButton.disabled = false;
        mostrarMensajeVenta(error.message, 'error');
        return false;
    }

    const empleadoUid = document.getElementById('venta-empleado-uid').value.trim();
    const empleado = ventasState.empleados.find(item => item.uid === empleadoUid) || null;
    const clientePayloadVenta = cliente ? { ...cliente } : null;
    const metodoPago = document.getElementById('venta-metodo-pago').value;
    const referenciaPago = document.getElementById('venta-referencia').value.trim();

    const payload = {
        sucursal_id: Number(document.getElementById('venta-sucursal-id').value),
        sucursal_uid: document.getElementById('venta-sucursal-uid').value.trim(),
        cliente_id: cliente ? cliente.id : null,
        cliente_uid: cliente ? cliente.uid : null,
        cliente: clientePayloadVenta,
        empleado_id: empleado ? empleado.id : null,
        empleado_uid: empleadoUid || null,
        tipo_venta: document.getElementById('venta-tipo').value,
        descuento: '0.00',
        fidelizacion: {
            usar_descuento: document.getElementById('usar-descuento-puntos')?.checked || false,
            porcentaje_descuento: Number(document.getElementById('descuento-puntos-porcentaje')?.value || 0)
        },
        productos: ventasState.productos,
        pago: {
            metodo_pago: metodoPago,
            monto: montoPago.toFixed(2),
            referencia: referenciaPago || (metodoPago === 'sin_pago' ? 'Credito sin pago inicial' : null)
        }
    };

    try {
        const response = await ventasApiCall(API_PORTS.ventas, '/api/ventas', 'POST', payload);
        const warnings = response.advertencias && response.advertencias.length
            ? ` Advertencias: ${response.advertencias.join(' ')}`
            : '';
        const puntos = response.fidelizacion && response.fidelizacion.puntos_ganados
            ? ` Puntos ganados: ${response.fidelizacion.puntos_ganados}.`
            : '';
        guardarNombreClienteDesdeVenta(response.data);
        mostrarMensajeVenta(
            `Venta registrada con exito.${puntos}${warnings}`,
            response.status === 'warning' ? 'warning' : 'success'
        );
        const venta = response.data || {};
        const ventaId = venta.id || venta.venta_id;
        const comprobanteUrl = ventaId ? getComprobanteUrl(ventaId) : '';
        const ventaExitosaPayload = {
            title: 'Venta exitosa',
            message: 'La venta se registro correctamente.',
            detail: venta.factura?.numero_factura
                ? `Comprobante generado: ${venta.factura.numero_factura}`
                : 'El comprobante PDF fue generado.',
            buttonText: 'Aceptar',
            type: response.status === 'warning' ? 'warning' : 'success',
            actionUrl: comprobanteUrl
        };
        guardarVentaExitosaPendiente(ventaExitosaPayload);
        cerrarModalVenta();
        ventasState.productos = [];
        await cargarVentas();
    } catch (error) {
        mostrarMensajeVenta(`Error: no se pudo registrar la venta. Revise los datos. ${error.message || ''}`.trim(), 'error');
        mostrarNotificacionVentas('Error: revise los datos antes de registrar la venta.', 'error');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
    return false;
}

function actualizarTotalVenta() {
    const totalLabel = document.getElementById('venta-total');
    if (!totalLabel) return;
    totalLabel.textContent = `Bs ${calcularTotalVenta().toFixed(2)}`;
    actualizarPagoCreditoVenta();
}

function actualizarPagoCreditoVenta() {
    const tipo = document.getElementById('venta-tipo')?.value || 'contado';
    const montoField = document.getElementById('credito-monto-field');
    const montoInput = document.getElementById('venta-monto-inicial');
    const saldoInfo = document.getElementById('credito-saldo-info');
    const metodoSelect = document.getElementById('venta-metodo-pago');
    const total = calcularTotalVenta();
    const esCredito = tipo === 'credito';

    if (montoField) montoField.hidden = !esCredito;
    if (saldoInfo) saldoInfo.hidden = !esCredito;

    if (!esCredito) {
        if (montoInput) montoInput.value = total.toFixed(2);
        if (metodoSelect) {
            metodoSelect.disabled = false;
            if (metodoSelect.value === 'sin_pago') metodoSelect.value = 'efectivo';
        }
        return;
    }

    const montoInicial = Math.min(Number(montoInput?.value || 0), total);
    const saldo = Math.max(total - montoInicial, 0);
    if (metodoSelect) {
        if (montoInicial <= 0) {
            metodoSelect.value = 'sin_pago';
            metodoSelect.disabled = true;
        } else {
            metodoSelect.disabled = false;
            if (metodoSelect.value === 'sin_pago') metodoSelect.value = 'efectivo';
        }
    }
    if (saldoInfo) {
        saldoInfo.textContent = `Saldo pendiente: Bs ${saldo.toFixed(2)}`;
    }
}

function cambiarTipoVenta() {
    const tipo = document.getElementById('venta-tipo')?.value || 'contado';
    const montoInput = document.getElementById('venta-monto-inicial');
    if (montoInput) {
        montoInput.value = tipo === 'credito' ? '0.00' : calcularTotalVenta().toFixed(2);
    }
    actualizarPagoCreditoVenta();
}

function getMontoPagoVenta() {
    const tipo = document.getElementById('venta-tipo')?.value || 'contado';
    const total = calcularTotalVenta();
    if (tipo === 'contado') return total;
    return Math.min(Number(document.getElementById('venta-monto-inicial')?.value || 0), total);
}

function calcularSubtotalVenta() {
    return ventasState.productos.reduce((sum, item) => {
        return sum + (item.cantidad * Number(item.precio_unitario));
    }, 0);
}

function calcularTotalVenta() {
    return Math.max(calcularSubtotalVenta() - calcularDescuentoPuntosVenta(), 0);
}

function calcularDescuentoPuntosVenta() {
    const usarDescuento = document.getElementById('usar-descuento-puntos')?.checked || false;
    const porcentaje = Number(document.getElementById('descuento-puntos-porcentaje')?.value || 0);
    if (!usarDescuento || porcentaje <= 0) return 0;
    return (calcularSubtotalVenta() * porcentaje) / 100;
}

function mostrarMensajeVenta(message, type = 'success') {
    const box = document.getElementById('venta-mensaje');
    if (!box) return;
    const messageType = typeof type === 'boolean' ? (type ? 'warning' : 'success') : type;
    box.hidden = false;
    box.textContent = message;
    box.className = `ventas-message ${messageType}`;
}

function mostrarNotificacionVentas(message, type = 'success') {
    const previous = document.querySelector('.ventas-toast');
    if (previous) previous.remove();

    const toast = document.createElement('div');
    toast.className = `ventas-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('is-hiding');
        setTimeout(() => toast.remove(), 250);
    }, 4200);
}

async function mostrarVentaExitosaSweetAlert({
    title = 'Venta exitosa',
    message = 'La venta se registro correctamente.',
    detail = '',
    buttonText = 'Aceptar',
    type = 'success',
    actionUrl = ''
} = {}) {
    if (!window.Swal) {
        return mostrarAlertaVentas({ title, message, detail, buttonText, type, actionUrl });
    }

    const icon = type === 'warning' ? 'warning' : 'success';
    const comprobanteLink = actionUrl
        ? `<a href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:14px;padding:10px 14px;border-radius:6px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:700;">Abrir comprobante</a>`
        : '';
    const html = `
        <p style="margin:0 0 8px;">${escapeHtml(message)}</p>
        ${detail ? `<p style="margin:0;color:#6b7280;">${escapeHtml(detail)}</p>` : ''}
        ${comprobanteLink}
    `;

    await Swal.fire({
        icon,
        title,
        html,
        confirmButtonText: buttonText,
        confirmButtonColor: '#1f7a3f',
        allowOutsideClick: false,
        allowEscapeKey: true
    });
}

function guardarVentaExitosaPendiente(payload) {
    try {
        sessionStorage.setItem(VENTA_EXITOSA_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('No se pudo guardar la alerta de venta exitosa.', error);
    }
}

function limpiarVentaExitosaPendiente() {
    try {
        sessionStorage.removeItem(VENTA_EXITOSA_STORAGE_KEY);
    } catch (error) {
        console.warn('No se pudo limpiar la alerta de venta exitosa.', error);
    }
}

async function mostrarVentaExitosaPendiente() {
    let payload = null;
    try {
        const raw = sessionStorage.getItem(VENTA_EXITOSA_STORAGE_KEY);
        payload = raw ? JSON.parse(raw) : null;
    } catch (error) {
        limpiarVentaExitosaPendiente();
        return;
    }

    if (!payload) return;
    await mostrarVentaExitosaSweetAlert(payload);
    limpiarVentaExitosaPendiente();
}

function mostrarAlertaVentas({
    title = 'Operacion realizada',
    message = '',
    detail = '',
    buttonText = 'Aceptar',
    type = 'success',
    actionUrl = ''
} = {}) {
    return new Promise(resolve => {
        const previous = document.querySelector('.ventas-confirm-backdrop');
        if (previous) previous.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ventas-confirm-backdrop';
        backdrop.innerHTML = `
            <div class="ventas-confirm-card ${type}" role="dialog" aria-modal="true" aria-labelledby="ventas-alert-title">
                <div class="ventas-confirm-icon" aria-hidden="true">${type === 'success' ? 'OK' : '!'}</div>
                <h4 id="ventas-alert-title">${escapeHtml(title)}</h4>
                ${message ? `<p>${escapeHtml(message)}</p>` : ''}
                ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
                <div class="ventas-confirm-actions">
                    ${actionUrl
                        ? `<a class="action-btn create-action ventas-confirm-link" href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener" data-alert-action="close">${escapeHtml(buttonText)}</a>`
                        : `<button type="button" class="action-btn create-action" data-alert-action="close">${escapeHtml(buttonText)}</button>`}
                </div>
            </div>
        `;

        const close = () => {
            backdrop.classList.add('is-hiding');
            setTimeout(() => {
                backdrop.remove();
                resolve();
            }, 160);
        };

        backdrop.addEventListener('click', event => {
            if (event.target.dataset.alertAction === 'close') close();
        });

        document.body.appendChild(backdrop);
        backdrop.querySelector('[data-alert-action="close"]')?.focus();
    });
}

function confirmarAccionVentas({
    title = 'Confirmar accion',
    message = 'Deseas continuar?',
    detail = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'warning'
} = {}) {
    return new Promise(resolve => {
        const previous = document.querySelector('.ventas-confirm-backdrop');
        if (previous) previous.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ventas-confirm-backdrop';
        backdrop.innerHTML = `
            <div class="ventas-confirm-card ${type}" role="dialog" aria-modal="true" aria-labelledby="ventas-confirm-title">
                <div class="ventas-confirm-icon" aria-hidden="true">!</div>
                <h4 id="ventas-confirm-title">${escapeHtml(title)}</h4>
                <p>${escapeHtml(message)}</p>
                ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
                <div class="ventas-confirm-actions">
                    <button type="button" class="action-btn ghost-action" data-confirm-action="cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="action-btn danger-action" data-confirm-action="confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        const close = value => {
            backdrop.classList.add('is-hiding');
            setTimeout(() => {
                backdrop.remove();
                resolve(value);
            }, 160);
        };

        backdrop.addEventListener('click', event => {
            const action = event.target.dataset.confirmAction;
            if (action === 'confirm') close(true);
            if (action === 'cancel' || event.target === backdrop) close(false);
        });

        document.addEventListener('keydown', function onKeydown(event) {
            if (!document.body.contains(backdrop)) {
                document.removeEventListener('keydown', onKeydown);
                return;
            }
            if (event.key === 'Escape') {
                document.removeEventListener('keydown', onKeydown);
                close(false);
            }
        });

        document.body.appendChild(backdrop);
        backdrop.querySelector('[data-confirm-action="confirm"]')?.focus();
    });
}

function getComprobanteUrl(ventaId) {
    return `${BASE_URL}:${API_PORTS.ventas}/api/ventas/${ventaId}/comprobante`;
}

function abrirComprobanteRegistrado(ventaId) {
    window.open(getComprobanteUrl(ventaId), '_blank');
}

function descargarComprobante(ventaId) {
    abrirComprobanteRegistrado(ventaId);
}

function descargarArchivo(filename, mimeType, content) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getResponseList(response, keys = []) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;

    for (const key of keys) {
        if (Array.isArray(response?.[key])) return response[key];
        if (Array.isArray(response?.data?.[key])) return response.data[key];
    }

    return [];
}

function normalizarSucursal(item) {
    const id = item.id ?? item.sucursal_id ?? item.id_sucursal ?? '';
    const uid = item.uid || item.sucursal_uid || item.codigo || item.codigo_sucursal || (id ? `SUC-${id}` : '');
    const nombre = item.nombre || item.nombre_sucursal || item.descripcion || item.direccion || uid;

    return { id, uid, nombre };
}

function normalizarEmpleado(item) {
    const id = item.id ?? item.empleado_id ?? item.id_empleado ?? '';
    const uid = item.uid || item.empleado_uid || item.codigo || item.codigo_empleado || (id ? `EMP-${id}` : '');
    const sucursal_id = item.sucursal_id ?? item.id_sucursal ?? '';
    const sucursal_uid = item.sucursal_uid || item.uid_sucursal || '';
    const estado = String(item.estado || '').trim().toLowerCase();
    const nombreCompleto = normalizeSpaces([
        item.nombre || item.nombres || '',
        item.apellido || item.apellidos || ''
    ].join(' '));
    const nombre = nombreCompleto || item.cargo || item.usuario || uid;

    return { id, uid, nombre, sucursal_id, sucursal_uid, estado };
}

function normalizarProducto(item) {
    const id = item.id ?? item.producto_id ?? item.id_producto ?? '';
    // Productos deberia devolver uid; mientras tanto usamos codigo como respaldo para no romper el combo.
    const uid = item.uid || item.producto_uid || item.codigo || item.codigo_producto || (id ? `PROD-${id}` : '');
    const nombre = item.nombre || item.nombre_producto || item.descripcion || uid;
    const precio = normalizarPrecioProducto(item);

    return { id, uid, nombre, precio };
}

function normalizarStockProducto(item) {
    const producto = item.producto || {};
    const productoId = item.producto_id || item.id_producto || producto.id || producto.producto_id || '';
    const productoUid = item.producto_uid
        || item.uid_producto
        || item.uid
        || item.codigo_producto
        || producto.uid
        || producto.producto_uid
        || '';
    const stockValue = item.stock
        ?? item.stock_actual
        ?? item.cantidad_disponible
        ?? item.disponible
        ?? item.existencias
        ?? item.cantidad
        ?? 0;

    return {
        producto_id: productoId ? String(productoId).trim() : '',
        producto_uid: String(productoUid).trim(),
        sucursal_id: item.sucursal_id ?? item.id_sucursal ?? '',
        sucursal_uid: item.sucursal_uid || item.uid_sucursal || '',
        stock: Math.max(Number(stockValue) || 0, 0)
    };
}

function normalizarPrecioProducto(item) {
    const centavos = item.precio_centavos ?? item.precio_unitario_centavos ?? item.precio_venta_centavos;
    if (centavos !== undefined && centavos !== null && centavos !== '') {
        const number = Number(String(centavos).replace(',', '.')) || 0;
        return number > 1000 ? number / 100 : number;
    }

    const precio = item.precio ?? item.precio_venta ?? item.precio_unitario ?? item.costo ?? 0;
    return Number(String(precio).replace(',', '.')) || 0;
}

function getStockProducto(productoUid) {
    if (!productoUid) return null;
    if (Object.prototype.hasOwnProperty.call(ventasState.stockPorProducto, productoUid)) {
        return Number(ventasState.stockPorProducto[productoUid]);
    }

    const producto = ventasState.catalogoProductos.find(item => item.uid === productoUid);
    const productoIdKey = producto && producto.id ? `id:${producto.id}` : null;
    if (productoIdKey && Object.prototype.hasOwnProperty.call(ventasState.stockPorProducto, productoIdKey)) {
        return Number(ventasState.stockPorProducto[productoIdKey]);
    }

    return null;
}

function getCantidadProductoEnVenta(productoUid) {
    return ventasState.productos
        .filter(producto => producto.producto_uid === productoUid)
        .reduce((total, producto) => total + Number(producto.cantidad || 0), 0);
}

function normalizarCantidadProductoVenta() {
    const input = document.getElementById('producto-cantidad');
    if (!input || input.value === '') return;

    let cantidad = Number(input.value);
    if (!Number.isFinite(cantidad) || cantidad < 1) {
        input.value = '1';
        return;
    }
    if (!Number.isInteger(cantidad)) {
        input.value = String(Math.floor(cantidad));
    }
}

function actualizarLimitesCantidadProductoVenta() {
    const input = document.getElementById('producto-cantidad');
    const productoUid = document.getElementById('producto-uid')?.value.trim();
    if (!input) return;

    input.min = '1';
    input.step = '1';
    input.removeAttribute('max');

    if (!productoUid) return;
    const stock = getStockProducto(productoUid);
    if (stock === null) return;

    const cantidadYaAgregada = getCantidadProductoEnVenta(productoUid);
    input.max = String(Math.max(stock - cantidadYaAgregada, 0));
}

function getNombreProductoReporte(productoReporte) {
    if (productoReporte.producto_nombre) return productoReporte.producto_nombre;

    const producto = ventasState.catalogoProductos.find(item => {
        return item.uid === productoReporte.producto_uid || String(item.id) === String(productoReporte.producto_id);
    });
    return producto ? producto.nombre : productoReporte.producto_uid;
}

function formatMetodoPago(value) {
    const text = String(value || 'sin metodo').replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getTodayInputValue() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isPositiveInteger(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0;
}

function isSafeRequiredText(value) {
    return typeof value === 'string' && value.trim() !== '' && isSafeText(value);
}

function isSafeText(value) {
    return !/[<>]|script|javascript:/i.test(String(value));
}

function normalizeSpaces(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

function syncNuevoClienteInputs() {
    const fields = [
        'nuevo-cliente-nombre',
        'nuevo-cliente-nit',
        'nuevo-cliente-telefono',
        'nuevo-cliente-correo'
    ];
    fields.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = normalizeSpaces(input.value);
    });
}

function isValidPersonName(value) {
    const normalized = normalizeSpaces(value);
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/.test(normalized);
}

function isValidNitCi(value) {
    return /^[A-Za-z0-9-]+$/.test(normalizeSpaces(value));
}

function isValidPhone(value) {
    return /^[0-9+\-\s]+$/.test(normalizeSpaces(value));
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
}

function getMaxDiscountPercentFromPoints(puntos) {
    return Math.min(Math.floor(Number(puntos || 0) / 100) * 10, 30);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function centavosToMoney(value) {
    return (Number(value || 0) / 100).toFixed(2);
}

function formatDate(value) {
    if (!value) return '-';
    return String(value).replace('T', ' ').slice(0, 19);
}

document.addEventListener('input', event => {
    if (event.target && event.target.id === 'producto-cantidad') {
        normalizarCantidadProductoVenta();
        actualizarLimitesCantidadProductoVenta();
        actualizarStockProductoVenta();
    }
});
