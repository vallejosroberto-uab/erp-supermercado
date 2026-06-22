// =========================================================================
// MÓDULO DE INVENTARIO - ABUELITA SERAFINA SUPERMARKET
// Frontend SPA conectado al microservicio Flask de Inventario - Puerto 5002
// =========================================================================

const INVENTARIO_API_BASE = "http://127.0.0.1:5002";

let cacheProductos = [];
let cacheSucursales = [];
let cacheInventario = [];

// ---------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------

function escapeHTML(valor) {
    if (valor === null || valor === undefined) return "";
    return String(valor)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatearTipoMovimiento(tipo) {
    const tipos = {
        entrada_compra: "Entrada / Compra",
        entrada_inicial: "Entrada Inicial",
        baja_perdida: "Baja / Merma",
        transferencia_salida: "Transferencia Salida",
        transferencia_entrada: "Transferencia Entrada",
        venta: "Venta",
        ajuste: "Ajuste"
    };

    return tipos[tipo] || tipo || "Sin tipo";
}

function obtenerClaseMovimiento(tipo) {
    if (!tipo) return "secondary";

    if (tipo.includes("entrada")) return "success";
    if (tipo.includes("baja")) return "danger";
    if (tipo.includes("transferencia")) return "warning";
    if (tipo.includes("venta")) return "primary";

    return "secondary";
}

function renderizarEncabezadoInventario() {
    const tablaBody = document.getElementById("tabla-inventario-body");
    if (!tablaBody) return;

    const tabla = tablaBody.closest("table");
    if (!tabla) return;

    const thead = tabla.querySelector("thead");
    if (!thead) return;

    thead.innerHTML = `
        <tr>
            <th>ID</th>
            <th>Producto</th>
            <th>Código</th>
            <th>Sucursal</th>
            <th class="text-center">Stock</th>
            <th class="text-center">Reservado</th>
            <th>Estado</th>
        </tr>
    `;
}

function renderizarEncabezadoMovimientos() {
    const tablaBody = document.getElementById("tabla-inventario-body");
    if (!tablaBody) return;

    const tabla = tablaBody.closest("table");
    if (!tabla) return;

    const thead = tabla.querySelector("thead");
    if (!thead) return;

    thead.innerHTML = `
        <tr>
            <th>ID</th>
            <th>Fecha</th>
            <th>Producto</th>
            <th>Sucursal</th>
            <th>Movimiento</th>
            <th class="text-center">Cantidad</th>
            <th class="text-center">Stock</th>
        </tr>
    `;
}

function configurarBotonMovimientosComoVer() {
    const btnMovimientos = document.getElementById("btn-ver-movimientos");
    if (!btnMovimientos) return;

    btnMovimientos.innerText = "🕒 Ver Movimientos";
    btnMovimientos.className = "btn btn-info text-white ms-2";
    btnMovimientos.onclick = consultarMovimientosInventario;
}

function configurarBotonMovimientosComoVolver() {
    const btnMovimientos = document.getElementById("btn-ver-movimientos");
    if (!btnMovimientos) return;

    btnMovimientos.innerText = "📦 Volver a Inventario";
    btnMovimientos.className = "btn btn-secondary text-white ms-2";
    btnMovimientos.onclick = consultarBalanceInventario;
}

// ---------------------------------------------------------
// CONSULTAR BALANCE DE INVENTARIO
// ---------------------------------------------------------

async function consultarBalanceInventario() {
    try {
        renderizarEncabezadoInventario();
        configurarBotonMovimientosComoVer();

        const response = await fetch(`${INVENTARIO_API_BASE}/inventory/balance`);
        const result = await response.json();

        const tablaBody = document.getElementById("tabla-inventario-body");
        if (!tablaBody) return;

        tablaBody.innerHTML = "";

       if (result.status === "success" && result.data && result.data.length > 0) {
            cacheInventario = result.data;
             extraerElementosParaSelects(result.data);

             result.data.forEach(item => {
            const tr = document.createElement("tr");

            const alertaStock = item.stock_actual <= item.stock_minimo
                    ? `<span class="badge bg-danger">Reabastecer</span>`
                    : `<span class="badge bg-success">Óptimo</span>`;

                tr.innerHTML = `
                    <td>${escapeHTML(item.id)}</td>
                    <td><strong>${escapeHTML(item.producto_nombre)}</strong></td>
                    <td>${escapeHTML(item.producto_codigo)}</td>
                    <td>
                        <strong>${escapeHTML(item.sucursal_uid)}</strong>
                        <span class="text-muted small">(ID: ${escapeHTML(item.sucursal_id)})</span>
                    </td>
                    <td class="text-center fw-bold text-primary">${escapeHTML(item.stock_actual)} U.</td>
                    <td class="text-center text-muted">${escapeHTML(item.stock_reservado)}</td>
                    <td>
                        ${alertaStock}
                        <span class="text-muted small ms-1">(Mín: ${escapeHTML(item.stock_minimo)})</span>
                    </td>
                `;

                tablaBody.appendChild(tr);
            });

            actualizarFormulariosOpciones();

        } else {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4 text-muted">
                        Inventario vacío. Cargue el archivo inicial con el botón de Excel.
                    </td>
                </tr>
            `;
        }

    } catch (error) {
        console.error("Fallo de sincronización de datos en balance:", error);

        const tablaBody = document.getElementById("tabla-inventario-body");
        if (tablaBody) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4 text-danger">
                        No se pudo conectar con el microservicio de Inventario.
                    </td>
                </tr>
            `;
        }
    }
}

// ---------------------------------------------------------
// CONSULTAR HISTORIAL / KARDEX DE MOVIMIENTOS
// ---------------------------------------------------------

async function consultarMovimientosInventario() {
    try {
        renderizarEncabezadoMovimientos();
        configurarBotonMovimientosComoVolver();

        const response = await fetch(`${INVENTARIO_API_BASE}/inventory/movements`);
        const result = await response.json();

        const tablaBody = document.getElementById("tabla-inventario-body");
        if (!tablaBody) return;

        tablaBody.innerHTML = "";

        if (result.status === "success" && result.data && result.data.length > 0) {
            result.data.forEach(mov => {
                const tr = document.createElement("tr");

                const tipoFormateado = formatearTipoMovimiento(mov.tipo_movimiento);
                const claseMovimiento = obtenerClaseMovimiento(mov.tipo_movimiento);

                tr.innerHTML = `
                    <td>${escapeHTML(mov.id)}</td>
                    <td>${escapeHTML(mov.creado_en)}</td>
                    <td>
                        <strong>${escapeHTML(mov.producto_nombre)}</strong><br>
                        <span class="text-muted small">${escapeHTML(mov.producto_codigo)}</span>
                    </td>
                    <td>${escapeHTML(mov.sucursal_uid)}</td>
                    <td>
                        <span class="badge bg-${claseMovimiento}">
                            ${escapeHTML(tipoFormateado)}
                        </span>
                    </td>
                    <td class="text-center fw-bold">
                        ${escapeHTML(mov.cantidad)}
                    </td>
                    <td class="text-center">
                        <span class="text-muted">${escapeHTML(mov.stock_anterior)}</span>
                        →
                        <strong>${escapeHTML(mov.stock_nuevo)}</strong>
                    </td>
                `;

                tablaBody.appendChild(tr);
            });

        } else {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4 text-muted">
                        No existen movimientos registrados todavía.
                    </td>
                </tr>
            `;
        }

    } catch (error) {
        console.error("Error al consultar movimientos:", error);

        const tablaBody = document.getElementById("tabla-inventario-body");
        if (tablaBody) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4 text-danger">
                        No se pudo consultar el historial de movimientos.
                    </td>
                </tr>
            `;
        }
    }
}

// ---------------------------------------------------------
// CARGAR SELECTORES DE PRODUCTOS Y SUCURSALES
// ---------------------------------------------------------

function extraerElementosParaSelects(data) {
    const prodMap = new Map();
    const sucMap = new Map();

    data.forEach(item => {
        if (item.producto_id) {
            prodMap.set(item.producto_id, {
                id: parseInt(item.producto_id),
                nombre: item.producto_nombre,
                codigo: item.producto_codigo,
                uid: item.producto_uid
            });
        }

        if (item.sucursal_id) {
            sucMap.set(item.sucursal_id, {
                id: parseInt(item.sucursal_id),
                nombre: item.sucursal_uid
            });
        }
    });

    cacheProductos = Array.from(prodMap.values());
    cacheSucursales = Array.from(sucMap.values());
}

function actualizarFormulariosOpciones() {
    const selectoresProductosGenerales = [
        "select-ingreso-producto",
        "select-baja-producto"
    ];

    const selectoresSucursales = [
        "select-ingreso-sucursal",
        "select-baja-sucursal",
        "select-transfer-origen",
        "select-transfer-destino"
    ];

    // Productos generales para ingreso y baja
    selectoresProductosGenerales.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">-- Seleccionar Producto --</option>`;

        cacheProductos.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.setAttribute("data-uid", p.uid);
            opt.textContent = `${p.nombre} [${p.codigo}]`;
            select.appendChild(opt);
        });
    });

    // Sucursales para ingreso, baja y transferencia
    selectoresSucursales.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML = `<option value="">-- Seleccionar Sucursal --</option>`;

        cacheSucursales.forEach(s => {
            const opt = document.createElement("option");
            opt.value = s.id;
            opt.textContent = s.nombre;
            select.appendChild(opt);
        });
    });

    // El producto de transferencia se llena según la sucursal origen
    const selectOrigen = document.getElementById("select-transfer-origen");

    if (selectOrigen) {
        selectOrigen.onchange = actualizarProductosTransferenciaPorOrigen;
    }

    actualizarProductosTransferenciaPorOrigen();
}
function actualizarProductosTransferenciaPorOrigen() {
    const selectOrigen = document.getElementById("select-transfer-origen");
    const selectProducto = document.getElementById("select-transfer-producto");

    if (!selectOrigen || !selectProducto) return;

    const origenId = parseInt(selectOrigen.value);

    selectProducto.innerHTML = `<option value="">-- Seleccionar Producto --</option>`;

    if (!origenId) {
        selectProducto.innerHTML = `<option value="">Seleccione primero la sucursal origen</option>`;
        selectProducto.disabled = true;
        return;
    }

    const productosDisponiblesMap = new Map();

    cacheInventario.forEach(item => {
        const mismaSucursal = parseInt(item.sucursal_id) === origenId;
        const tieneStock = parseInt(item.stock_actual) > 0;

        if (mismaSucursal && tieneStock) {
            productosDisponiblesMap.set(item.producto_id, {
                id: parseInt(item.producto_id),
                nombre: item.producto_nombre,
                codigo: item.producto_codigo,
                uid: item.producto_uid,
                stock: item.stock_actual
            });
        }
    });

    const productosDisponibles = Array.from(productosDisponiblesMap.values());

    if (productosDisponibles.length === 0) {
        selectProducto.innerHTML = `<option value="">No hay productos con stock en esta sucursal</option>`;
        selectProducto.disabled = true;
        return;
    }

    selectProducto.disabled = false;

    productosDisponibles.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.setAttribute("data-uid", p.uid);
        opt.textContent = `${p.nombre} [${p.codigo}] - Stock: ${p.stock}`;
        selectProducto.appendChild(opt);
    });
}
// ---------------------------------------------------------
// INICIALIZAR VISTA DE INVENTARIO
// ---------------------------------------------------------

function inicializarVistaInventario() {
    const mainContent = document.getElementById("main-content");
    const plantilla = document.getElementById("plantilla-html-inventario");

    if (!mainContent || !plantilla) return;

    mainContent.innerHTML = plantilla.innerHTML;

    setTimeout(() => {
        consultarBalanceInventario();
    }, 100);

    // -----------------------------------------------------
    // INGRESO DE STOCK
    // -----------------------------------------------------
    document.getElementById("form-inventario-ingreso").addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectProd = document.getElementById("select-ingreso-producto");
        const selectSuc = document.getElementById("select-ingreso-sucursal");
        const cantidadInput = document.getElementById("input-cantidad");

        if (!selectProd.value || !selectSuc.value) {
            alert("Por favor seleccione un producto y una sucursal válidos.");
            return;
        }

        const cantidad = parseInt(cantidadInput.value);

        if (isNaN(cantidad) || cantidad <= 0) {
            alert("La cantidad debe ser un número mayor a cero.");
            return;
        }

        const optProdSelected = selectProd.options[selectProd.selectedIndex];
        const optSucSelected = selectSuc.options[selectSuc.selectedIndex];

        const payload = {
            producto_id: parseInt(selectProd.value),
            producto_uid: optProdSelected.getAttribute("data-uid") || "PROD-MOCK",
            sucursal_id: parseInt(selectSuc.value),
            sucursal_uid: optSucSelected.text,
            cantidad: cantidad
        };

        try {
            const res = await fetch(`${INVENTARIO_API_BASE}/inventory/input`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const dataRes = await res.json();

            if (res.ok && dataRes.status === "success") {
                alert("¡Ingreso de mercadería registrado con éxito!");
                e.target.reset();
                consultarBalanceInventario();
            } else {
                alert("Error del servidor: " + (dataRes.message || "No se pudo completar."));
            }

        } catch (err) {
            alert("Fallo de comunicación de red con el backend.");
        }
    });

    // -----------------------------------------------------
    // BAJA / MERMA DE STOCK
    // -----------------------------------------------------
    document.getElementById("form-inventario-baja").addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectProd = document.getElementById("select-baja-producto");
        const selectSuc = document.getElementById("select-baja-sucursal");
        const cantidadInput = document.getElementById("baja-cantidad");

        if (!selectProd.value || !selectSuc.value) {
            alert("Por favor seleccione un producto y una sucursal válidos.");
            return;
        }

        const cantidad = parseInt(cantidadInput.value);

        if (isNaN(cantidad) || cantidad <= 0) {
            alert("La cantidad debe ser un número mayor a cero.");
            return;
        }

        const payload = {
            producto_id: parseInt(selectProd.value),
            sucursal_id: parseInt(selectSuc.value),
            cantidad: cantidad
        };

        try {
            const res = await fetch(`${INVENTARIO_API_BASE}/inventory/output`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const dataRes = await res.json();

            if (res.ok && dataRes.status === "success") {
                alert("¡Baja procesada con éxito y descontada del balance!");
                e.target.reset();
                consultarBalanceInventario();
            } else {
                alert("Error al procesar baja: " + (dataRes.message || "Verifique el stock disponible."));
            }

        } catch (err) {
            alert("Fallo de comunicación de red con el backend.");
        }
    });

    // -----------------------------------------------------
    // TRANSFERENCIA ENTRE SUCURSALES
    // -----------------------------------------------------
    document.getElementById("form-inventario-transferencia").addEventListener("submit", async (e) => {
        e.preventDefault();

        const selectProd = document.getElementById("select-transfer-producto");
        const selectOrigen = document.getElementById("select-transfer-origen");
        const selectDestino = document.getElementById("select-transfer-destino");
        const cantidadInput = document.getElementById("transfer-cantidad");

        const origen = parseInt(selectOrigen.value);
        const destino = parseInt(selectDestino.value);

        if (!selectProd.value || !origen || !destino) {
            alert("Por favor complete todos los selectores del formulario de transferencia.");
            return;
        }

        if (origen === destino) {
            alert("Error: Las sucursales origen y destino deben ser distintas.");
            return;
        }

        const cantidad = parseInt(cantidadInput.value);

        if (isNaN(cantidad) || cantidad <= 0) {
            alert("La cantidad debe ser un número mayor a cero.");
            return;
        }

        const payload = {
            producto_id: parseInt(selectProd.value),
            sucursal_origen_id: origen,
            sucursal_destino_id: destino,
            cantidad: cantidad
        };

        try {
            const res = await fetch(`${INVENTARIO_API_BASE}/inventory/transfer`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const dataRes = await res.json();

            if (res.ok && dataRes.status === "success") {
                alert("¡Transferencia logística inter-sucursal completada con éxito!");
                e.target.reset();
                consultarBalanceInventario();
            } else {
                alert("Error en transferencia: " + (dataRes.message || "Verifique existencias disponibles."));
            }

        } catch (err) {
            alert("Fallo de comunicación de red con el backend.");
        }
    });

    // -----------------------------------------------------
    // BOTÓN VER MOVIMIENTOS
    // -----------------------------------------------------
    const btnMovimientos = document.getElementById("btn-ver-movimientos");

    if (btnMovimientos) {
        btnMovimientos.onclick = consultarMovimientosInventario;
    }

    // -----------------------------------------------------
    // IMPORTAR INVENTARIO DESDE EXCEL
    // -----------------------------------------------------
    const btnExcel = document.getElementById("btn-importar-excel");
    const inputFile = document.getElementById("input-file-excel");

    if (btnExcel && inputFile) {
        btnExcel.onclick = () => inputFile.click();

        inputFile.onchange = async () => {
            if (inputFile.files.length === 0) return;

            const file = inputFile.files[0];

            if (!file.name.toLowerCase().endsWith(".xlsx")) {
                alert("Formato no válido. Solo se permite archivo Excel .xlsx.");
                inputFile.value = "";
                return;
            }

            const formData = new FormData();
            formData.append("file", file);

            try {
                btnExcel.innerText = "Procesando archivo...";
                btnExcel.disabled = true;

                const res = await fetch(`${INVENTARIO_API_BASE}/inventory/loadExcel`, {
                    method: "POST",
                    body: formData
                });

                const dataRes = await res.json();

                if (res.ok && dataRes.status === "success") {
                    alert(
                        `¡Archivo Excel importado correctamente!\n\n` +
                        `Filas procesadas: ${dataRes.filas_procesadas}\n` +
                        `Filas omitidas: ${dataRes.filas_omitidas || 0}`
                    );

                    consultarBalanceInventario();

                } else {
                    let mensajeError = dataRes.message || "El microservicio rechazó el archivo.";

                    if (dataRes.errores && Array.isArray(dataRes.errores) && dataRes.errores.length > 0) {
                        mensajeError += "\n\nDetalle de errores:";

                        dataRes.errores.forEach(error => {
                            mensajeError += `\nFila ${error.fila} - ${error.campo}: ${error.message}`;
                        });
                    }

                    alert(mensajeError);
                }

            } catch (err) {
                console.error(err);
                alert("No se logró establecer conexión con el microservicio de Inventario en el puerto 5002.");

            } finally {
                btnExcel.innerText = "📊 Importar Inventario Excel";
                btnExcel.disabled = false;
                inputFile.value = "";
            }
        };
    }
}

// ---------------------------------------------------------
// OBSERVADOR SPA
// ---------------------------------------------------------

const observer = new MutationObserver(() => {
    const tituloModulo = document.getElementById("module-title");

    if (tituloModulo && tituloModulo.innerText.toLowerCase().includes("inventario")) {
        observer.disconnect();
        inicializarVistaInventario();
        conectarObserver();
    }
});

function conectarObserver() {
    const tituloModulo = document.getElementById("module-title");

    if (tituloModulo) {
        observer.observe(tituloModulo, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    conectarObserver();

    const tituloModulo = document.getElementById("module-title");

    if (tituloModulo && tituloModulo.innerText.toLowerCase().includes("inventario")) {
        inicializarVistaInventario();
    }
});