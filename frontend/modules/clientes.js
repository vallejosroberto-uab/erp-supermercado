// ============================================================
// *** MÓDULO DE CLIENTES - VERSIÓN PROFESIONAL ***
// ============================================================

// ============================================================
// 1. FUNCIÓN PRINCIPAL - Cargar vista de Clientes
// ============================================================
function cargarVistaClientes() {
    const content = document.getElementById('main-content');

    content.innerHTML = `
        <div class="cl-module-container">
            <!-- HEADER -->
            <div class="cl-module-header">
                <div class="cl-header-left">
                    <h2><i class="fas fa-users"></i> Gestión de Clientes</h2>
                    <span class="cl-total-badge" id="totalClientesBadge">0 clientes</span>
                </div>
                <div class="cl-header-actions">
                    <button class="cl-btn-primary" onclick="mostrarFormularioCliente()">
                        <i class="fas fa-plus-circle"></i> Nuevo Cliente
                    </button>
                    <button class="cl-btn-export" onclick="exportarClientes()">
                        <i class="fas fa-file-export"></i> Exportar
                    </button>
                    <button class="cl-btn-stats" onclick="mostrarEstadisticas()">
                        <i class="fas fa-chart-bar"></i> Estadísticas
                    </button>
                </div>
            </div>

            <!-- TABS -->
            <div class="cl-tabs">
                <button class="cl-tab active" onclick="switchTab('lista', this)">
                    <i class="fas fa-list"></i> Lista
                </button>
                <button class="cl-tab" onclick="switchTab('stats', this)">
                    <i class="fas fa-chart-pie"></i> Estadísticas
                </button>
                <button class="cl-tab" onclick="switchTab('top', this)">
                    <i class="fas fa-trophy"></i> Top Clientes
                </button>
                <button class="cl-tab" onclick="switchTab('compras', this)">
                    <i class="fas fa-shopping-cart"></i> Análisis de Compras
                </button>
            </div>

            <!-- TAB 1: LISTA DE CLIENTES -->
            <div id="tab-lista" class="cl-tab-content active">
                <div class="cl-search-bar">
                    <div class="cl-search-input-wrapper">
                        <i class="fas fa-search"></i>
                        <input type="text" id="searchInput" placeholder="Buscar por nombre, correo, teléfono o NIT/CI..." 
                               onkeyup="buscarClientes(event)">
                    </div>
                    <div class="cl-filter-group">
                        <select id="filterEstado" onchange="cargarClientes(0)">
                            <option value="">Todos los estados</option>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                        </select>
                    </div>
                    <button class="cl-btn-refresh" onclick="cargarClientes(0)" title="Actualizar">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>

                <div class="cl-table-container">
                    <table class="cl-data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th><i class="fas fa-user"></i> Nombre</th>
                                <th><i class="fas fa-phone"></i> Teléfono</th>
                                <th><i class="fas fa-envelope"></i> Correo</th>
                                <th><i class="fas fa-id-card"></i> NIT/CI</th>
                                <th><i class="fas fa-star"></i> Puntos</th>
                                <th><i class="fas fa-shopping-cart"></i> Compras</th>
                                <th><i class="fas fa-circle"></i> Estado</th>
                                <th><i class="fas fa-cog"></i> Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="clientesTableBody">
                            <tr>
                                <td colspan="9" class="cl-loading-text">
                                    <i class="fas fa-spinner fa-spin"></i> Cargando clientes...
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="cl-pagination">
                    <button onclick="cambiarPagina(-1)" id="prevPage">
                        <i class="fas fa-chevron-left"></i> Anterior
                    </button>
                    <span id="pageInfo"><i class="fas fa-page"></i> Página 1</span>
                    <button onclick="cambiarPagina(1)" id="nextPage">
                        Siguiente <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>

            <!-- TAB 2: ESTADÍSTICAS -->
            <div id="tab-stats" class="cl-tab-content" style="display:none;">
                <div class="cl-stats-grid">
                    <div class="cl-stat-card">
                        <div class="cl-stat-icon" style="background:#ebf8ff;color:#2b6cb0;">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="cl-stat-info">
                            <h4>Total Clientes</h4>
                            <span id="statTotalClientes">0</span>
                        </div>
                    </div>
                    <div class="cl-stat-card">
                        <div class="cl-stat-icon" style="background:#f0fff4;color:#276749;">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                        <div class="cl-stat-info">
                            <h4>Total Compras</h4>
                            <span id="statTotalCompras">0</span>
                        </div>
                    </div>
                    <div class="cl-stat-card">
                        <div class="cl-stat-icon" style="background:#faf5ff;color:#6b46c1;">
                            <i class="fas fa-calculator"></i>
                        </div>
                        <div class="cl-stat-info">
                            <h4>Promedio Compras</h4>
                            <span id="statPromedioCompras">0</span>
                        </div>
                    </div>
                    <div class="cl-stat-card">
                        <div class="cl-stat-icon" style="background:#fff5f5;color:#c53030;">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="cl-stat-info">
                            <h4>Total Puntos</h4>
                            <span id="statTotalPuntos">0</span>
                        </div>
                    </div>
                </div>

                <div class="cl-chart-row">
                    <div class="cl-chart-container">
                        <h4><i class="fas fa-chart-bar"></i> Top 10 Clientes por Puntos</h4>
                        <canvas id="clientesChart"></canvas>
                    </div>
                    <div class="cl-chart-container">
                        <h4><i class="fas fa-chart-pie"></i> Distribución por Estado</h4>
                        <canvas id="estadoChart"></canvas>
                    </div>
                </div>
            </div>

            <!-- TAB 3: TOP CLIENTES -->
            <div id="tab-top" class="cl-tab-content" style="display:none;">
                <div class="cl-top-grid">
                    <div class="cl-top-card">
                        <div class="cl-top-header" style="background:linear-gradient(135deg,#f6e05e,#d69e2e);padding:10px">
                            <i class="fas fa-trophy"></i>
                            <h3>Top por Puntos</h3>
                        </div>
                        <div id="topPuntos" class="cl-top-list"></div>
                    </div>
                    <div class="cl-top-card">
                        <div class="cl-top-header" style="background:linear-gradient(135deg,#63b3ed,#3182ce);padding:10px">
                            <i class="fas fa-shopping-cart"></i>
                            <h3>Top por Compras</h3>
                        </div>
                        <div id="topCompras" class="cl-top-list"></div>
                    </div>
                </div>
            </div>

            <!-- TAB 4: ANÁLISIS DE COMPRAS -->
            <div id="tab-compras" class="cl-tab-content" style="display:none;">
                <div class="cl-filters">
                    <div class="cl-filter-group">
                        <label><i class="fas fa-calendar-alt"></i> Desde</label>
                        <input type="date" id="fechaDesde">
                    </div>
                    <div class="cl-filter-group">
                        <label><i class="fas fa-calendar-alt"></i> Hasta</label>
                        <input type="date" id="fechaHasta">
                    </div>
                    <button class="cl-btn-primary" onclick="filtrarPorFechas()">
                        <i class="fas fa-filter"></i> Filtrar
                    </button>
                    <button class="cl-btn-secondary" onclick="limpiarFiltros()">
                        <i class="fas fa-undo"></i> Limpiar
                    </button>
                </div>
                <div id="analisisResultados" class="clx-analytics-bar">
                    <div class="clx-card clx-blue">
                        <div class="clx-icon">
                            <i class="fas fa-calendar-day"></i>
                        </div>
                        <div class="clx-content">
                            <span class="clx-label">Compras en el período</span>
                            <span class="clx-value" id="analisisTotalCompras">0</span>
                        </div>
                    </div>

                    <div class="clx-card clx-green">
                        <div class="clx-icon">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="clx-content">
                            <span class="clx-label">Total gastado</span>
                            <span class="clx-value" id="analisisTotalGastado">Bs 0.00</span>
                        </div>
                    </div>

                    <div class="clx-card clx-purple">
                        <div class="clx-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="clx-content">
                            <span class="clx-label">Puntos acumulados</span>
                            <span class="clx-value" id="analisisTotalPuntos">0</span>
                        </div>
                    </div>
                </div>
                <div class="cl-table-container">
                    <table class="cl-data-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Compras</th>
                                <th>Total gastado</th>
                                <th>Puntos</th>
                                <th>Promedio</th>
                            </tr>
                        </thead>
                        <tbody id="analisisTableBody">
                            <tr>
                                <td colspan="5" class="cl-loading-text">Selecciona un rango de fechas</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- MODAL: Crear/Editar Cliente -->
        <div id="clienteModal" class="cl-modal" style="display:none;">
            <div class="cl-modal-content">
                <div class="cl-modal-header">
                    <h3 id="modalTitle"><i class="fas fa-user-plus"></i> Nuevo Cliente</h3>
                    <button class="cl-modal-close" onclick="cerrarModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="clienteForm" onsubmit="guardarCliente(event)">
                    <input type="hidden" id="clienteId">
                    
                    <div class="cl-form-group">
                        <label><i class="fas fa-user"></i> Nombre completo <span class="cl-required">*</span></label>
                        <input type="text" id="nombre" required placeholder="Ej: Juan Pérez">
                    </div>
                    
                    <div class="cl-form-row">
                        <div class="cl-form-group">
                            <label><i class="fas fa-phone"></i> Teléfono <span class="cl-required">*</span></label>
                            <input type="text" id="telefono" required placeholder="Ej: 76543210">
                        </div>
                        <div class="cl-form-group">
                            <label><i class="fas fa-envelope"></i> Correo</label>
                            <input type="email" id="correo" placeholder="Ej: juan@email.com">
                        </div>
                    </div>
                    
                    <div class="cl-form-group">
                        <label><i class="fas fa-id-card"></i> NIT/CI <span class="cl-required">*</span></label>
                        <input type="text" id="nitCi" required placeholder="Ej: 123456789">
                    </div>
                    
                    <div class="cl-form-actions">
                        <button type="button" class="cl-btn-secondary" onclick="cerrarModal()">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="cl-btn-primary">
                            <i class="fas fa-save"></i> Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL: Ver Historial -->
        <div id="historialModal" class="cl-modal" style="display:none;">
            <div class="cl-modal-content cl-modal-lg">
                <div class="cl-modal-header">
                    <h3 id="historialTitle"><i class="fas fa-history"></i> Historial del Cliente</h3>
                    <button class="cl-modal-close" onclick="cerrarHistorialModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="historialContent"></div>
            </div>
        </div>

        <!-- MODAL: Gestionar Puntos -->
        <div id="puntosModal" class="cl-modal" style="display:none;">
            <div class="cl-modal-content">
                <div class="cl-modal-header">
                    <h3><i class="fas fa-star"></i> Gestionar Puntos</h3>
                    <button class="cl-modal-close" onclick="cerrarPuntosModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div id="puntosContent"></div>
            </div>
        </div>
    `;

    cargarClientes();
    cargarEstadisticasGlobales();
}

// ============================================================
// 2. FUNCIONES DE PESTAÑAS
// ============================================================
function switchTab(tab, btn) {
    document.querySelectorAll('.cl-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cl-tab-content').forEach(t => t.style.display = 'none');

    if (btn) btn.classList.add('active');
    document.getElementById(`tab-${tab}`).style.display = 'block';

    if (tab === 'stats') {
        setTimeout(() => cargarEstadisticas(), 100);
    }
    if (tab === 'top') {
        cargarTopClientes();
    }
}

// ============================================================
// 3. FUNCIONES CRUD
// ============================================================

async function cargarClientes(page = 0, search = '') {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="9" class="cl-loading-text">
        <i class="fas fa-spinner fa-spin"></i> Cargando...
    </td></tr>`;

    try {
        const estado = document.getElementById('filterEstado')?.value || '';
        let url = `/api/clientes?limit=10&offset=${page * 10}`;
        if (estado) url += `&estado=${estado}`;
        if (search) url = `/api/clientes/buscar?q=${encodeURIComponent(search)}`;

        const data = await apiCall(API_PORTS.clientes, url);

        if (data.status === 'success' && data.data.length > 0) {
            renderizarClientes(data.data);
            actualizarPaginacion(page, data.total, data.limit);
            document.getElementById('totalClientesBadge').textContent = `${data.total} clientes`;
        } else {
            tbody.innerHTML = `<tr><td colspan="9" class="cl-empty-text">
                <i class="fas fa-inbox"></i> No hay clientes registrados
            </td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="cl-error-text">
            <i class="fas fa-exclamation-triangle"></i> Error al cargar clientes
        </td></tr>`;
        console.error(error);
    }
}

function renderizarClientes(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    clientes.forEach((cliente, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.id}</td>
            <td><strong>${escapeHtml(cliente.nombre)}</strong></td>
            <td>${escapeHtml(cliente.telefono)}</td>
            <td>${escapeHtml(cliente.correo)}</td>
            <td>${escapeHtml(cliente.nit_ci)}</td>
            <td class="cl-puntos-cell">
                <i class="fas fa-star" style="color:#d69e2e;"></i> ${cliente.puntos || 0}
            </td>
            <td>
                <span class="cl-compras-badge">
                    <i class="fas fa-shopping-cart"></i> ${cliente.contador_compras || 0}
                </span>
            </td>
            <td>
                <span class="cl-badge ${cliente.estado === 'activo' ? 'cl-badge-active' : 'cl-badge-inactive'}">
                    ${cliente.estado === 'activo' ? '<i class="fas fa-check-circle"></i> Activo' : '<i class="fas fa-times-circle"></i> Inactivo'}
                </span>
            </td>
            <td class="cl-actions-cell">
                <button class="cl-btn-icon cl-btn-edit" onclick="editarCliente(${cliente.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="cl-btn-icon cl-btn-history" onclick="verHistorial(${cliente.id})" title="Ver historial">
                    <i class="fas fa-history"></i>
                </button>
                <button class="cl-btn-icon cl-btn-puntos" onclick="gestionarPuntos(${cliente.id})" title="Gestionar puntos">
                    <i class="fas fa-star"></i>
                </button>
                <button class="cl-btn-icon ${cliente.estado === 'activo' ? 'cl-btn-danger' : 'cl-btn-success'}" 
                        onclick="toggleEstadoCliente(${cliente.id}, '${cliente.estado}')" 
                        title="${cliente.estado === 1 ? 'Desactivar' : 'Activar'}">
                    ${cliente.estado === 'activo' ? '<i class="fas fa-user-slash"></i>' : '<i class="fas fa-user-check"></i>'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function guardarCliente(event) {
    event.preventDefault();
    if (!validarFormularioCliente()) return;

    const id = document.getElementById('clienteId').value;
    const data = {
        nombre: document.getElementById('nombre').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        correo: document.getElementById('correo').value.trim(),
        nit_ci: document.getElementById('nitCi').value.trim()
    };

    if (!data.nombre || !data.telefono || !data.nit_ci) {
        Swal.fire({
            icon: 'warning',
            title: 'Campos incompletos',
            text: 'Todos los campos son obligatorios',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
        return;
    }

    try {
        let url = '/api/clientes';
        let method = 'POST';
        if (id) { url = `/api/clientes/${id}`; method = 'PUT'; }

        const result = await apiCall(API_PORTS.clientes, url, method, data);

        if (result.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: id ? '¡Actualizado!' : '¡Creado!',
                text: `Cliente ${id ? 'actualizado' : 'creado'} exitosamente`,
                timer: 2000,
                showConfirmButton: false,
                customClass: {
                    container: 'cl-sw-container'
                }
            });
            cerrarModal();
            cargarClientes();
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Error al guardar cliente',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}

async function editarCliente(id) {
    try {
        const data = await apiCall(API_PORTS.clientes, `/api/clientes/${id}`);
        if (data.status === 'success') {
            const c = data.data;
            document.getElementById('clienteId').value = c.id;
            document.getElementById('nombre').value = c.nombre;
            document.getElementById('telefono').value = c.telefono;
            document.getElementById('correo').value = c.correo;
            document.getElementById('nitCi').value = c.nit_ci;
            document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Editar Cliente';
            document.getElementById('clienteModal').style.display = 'block';
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el cliente',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}
async function toggleEstadoCliente(id, estadoActual) {
    const nuevoEstado = estadoActual === 'activo'
        ? 'inactivo'
        : 'activo';

    const accion = nuevoEstado === 'activo'
        ? 'activar'
        : 'desactivar';

    const result = await Swal.fire({
        title: `¿${accion} este cliente?`,
        text: `El cliente quedará ${nuevoEstado}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: nuevoEstado === 'activo'
            ? '#48bb78'
            : '#fc8181',
        cancelButtonColor: '#a0aec0',
        confirmButtonText: `Sí, ${accion}`,
        cancelButtonText: 'Cancelar',
        customClass: {
            container: 'cl-sw-container'
        }
    });

    if (!result.isConfirmed) return;

    try {
        await apiCall(
            API_PORTS.clientes,
            `/api/clientes/${id}/estado`,
            'PATCH',
            {
                estado: nuevoEstado
            }
        );

        await Swal.fire({
            icon: 'success',
            title: '¡Completado!',
            text: `Cliente ${accion}do exitosamente`,
            timer: 1500,
            showConfirmButton: false,
            customClass: {
                container: 'cl-sw-container'
            }
        });

        cargarClientes();

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: `No se pudo ${accion} el cliente`,
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}

// ============================================================
// 4. FUNCIONES DE BÚSQUEDA
// ============================================================

let busquedaTimeout;

function buscarClientes(event) {
    clearTimeout(busquedaTimeout);
    busquedaTimeout = setTimeout(() => {
        const searchTerm = document.getElementById('searchInput').value.trim();
        if (searchTerm.length > 2 || searchTerm.length === 0) {
            cargarClientes(0, searchTerm);
        }
    }, 500);
}

// ============================================================
// 5. EXPORTACIÓN
// ============================================================

async function exportarClientes() {
    try {
        Swal.fire({
            title: 'Exportando...',
            text: 'Generando archivo CSV',
            allowOutsideClick: false,
            customClass: {
                container: 'cl-sw-container'
            },
            didOpen: () => Swal.showLoading()
        });

        const result = await apiCall(API_PORTS.clientes, '/api/clientes/exportar?formato=csv');

        if (result.status === 'success') {
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);

            Swal.fire({
                icon: 'success',
                title: '¡Exportado!',
                text: 'Archivo CSV descargado exitosamente',
                timer: 2000,
                showConfirmButton: false,
                customClass: {
                    container: 'cl-sw-container'
                }
            });
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo exportar',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}

// ============================================================
// 6. GESTIÓN DE PUNTOS CON MODAL
// ============================================================
async function gestionarPuntos(id) {
    try {
        const data = await apiCall(API_PORTS.clientes, `/api/clientes/${id}/puntos`);
        
        // 🔴 SI EL CLIENTE NO EXISTE O HAY ERROR
        if (!data || data.error) {
            Swal.fire({
                icon: 'info',
                title: 'Cliente no encontrado',
                text: data?.error || 'El cliente no existe o fue eliminado',
                confirmButtonColor: '#48bb78'
            });
            return;
        }
        
        const modal = document.getElementById('puntosModal');
        const content = document.getElementById('puntosContent');

        content.innerHTML = `
            <div class="cl-puntos-info">
                <div class="cl-puntos-user">
                    <i class="fas fa-user-circle" style="font-size:48px;color:#48bb78;"></i>
                    <div>
                        <h4>${escapeHtml(data.nombre || 'Sin nombre')}</h4>
                        <p><i class="fas fa-envelope"></i> ${escapeHtml(data.correo || 'Sin correo')}</p>
                    </div>
                </div>
                <div class="cl-puntos-total">
                    <span class="cl-puntos-number">${data.puntos || 0}</span>
                    <span class="cl-puntos-label">Puntos acumulados</span>
                </div>
            </div>
            <div class="cl-puntos-actions">
                <button class="cl-btn-primary" onclick="sumarPuntos(${id})">
                    <i class="fas fa-plus-circle"></i> Sumar Puntos
                </button>
                <button class="cl-btn-warning" onclick="restarPuntos(${id})">
                    <i class="fas fa-minus-circle"></i> Restar Puntos
                </button>
                <button class="cl-btn-secondary" onclick="verHistorialPuntos(${id})">
                    <i class="fas fa-history"></i> Ver Historial
                </button>
            </div>
        `;

        modal.style.display = 'block';
        
    } catch (error) {
        console.error('Error en gestionarPuntos:', error);
        
        // 🔴 MANEJO MEJORADO DEL ERROR 404
        if (error.message?.includes('404') || error.message?.includes('NOT FOUND')) {
            Swal.fire({
                icon: 'info',
                title: 'Cliente no encontrado',
                text: 'El cliente que buscas no existe. Puede haber sido eliminado.',
                confirmButtonColor: '#48bb78'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo cargar la información. Verifica que el servicio esté corriendo.',
                confirmButtonColor: '#48bb78'
            });
        }
    }
}

async function sumarPuntos(id) {
    const { value: cantidad } = await Swal.fire({
        title: 'Sumar Puntos',
        text: '¿Cuántos puntos deseas sumar?',
        input: 'number',
        inputAttributes: { min: 1, step: 1 },
        inputPlaceholder: 'Ej: 10',
        confirmButtonColor: '#48bb78',
        showCancelButton: true,
        cancelButtonColor: '#a0aec0',
        customClass: {
            container: 'cl-sw-container'
        }
    });

    if (cantidad && parseInt(cantidad) > 0) {
        try {
            await apiCall(API_PORTS.clientes, `/api/clientes/${id}/puntos/sumar`, 'POST', {
                puntos: parseInt(cantidad),
                descripcion: 'Ajuste manual de puntos'
            });
            Swal.fire({
                icon: 'success',
                title: '¡Puntos sumados!',
                text: `Se sumaron ${cantidad} puntos`,
                timer: 1500,
                showConfirmButton: false,
                customClass: {
                    container: 'cl-sw-container'
                }
            });
            gestionarPuntos(id);
            cargarClientes();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron sumar los puntos',
                confirmButtonColor: '#48bb78',
                customClass: {
                    container: 'cl-sw-container'
                }
            });
        }
    }
}

async function restarPuntos(id) {
    const { value: cantidad } = await Swal.fire({
        title: 'Restar Puntos',
        text: '¿Cuántos puntos deseas restar?',
        input: 'number',
        inputAttributes: { min: 1, step: 1 },
        inputPlaceholder: 'Ej: 5',
        confirmButtonColor: '#fc8181',
        showCancelButton: true,
        cancelButtonColor: '#a0aec0',
        customClass: {
            container: 'cl-sw-container'
        }
    });

    if (cantidad && parseInt(cantidad) > 0) {
        try {
            await apiCall(API_PORTS.clientes, `/api/clientes/${id}/puntos/restar`, 'POST', {
                puntos: parseInt(cantidad),
                descripcion: 'Ajuste manual de puntos'
            });
            Swal.fire({
                icon: 'success',
                title: '¡Puntos restados!',
                text: `Se restaron ${cantidad} puntos`,
                timer: 1500,
                showConfirmButton: false,
                customClass: {
                    container: 'cl-sw-container'
                }
            });
            gestionarPuntos(id);
            cargarClientes();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudieron restar los puntos',
                confirmButtonColor: '#48bb78',
                customClass: {
                    container: 'cl-sw-container'
                }
            });
        }
    }
}

async function verHistorialPuntos(id) {
    try {
        const ventas = await apiCall(API_PORTS.clientes, `/api/clientes/${id}/historial/ventas`);

        // 🔴 SI VIENE ERROR DEL BACKEND (404 o cliente no existe)
        if (!ventas || ventas.error) {
            Swal.fire({
                icon: 'info',
                title: 'Sin historial',
                text: ventas?.error || 'No hay historial disponible',
                confirmButtonColor: '#48bb78',
                customClass: {
                    container: 'cl-sw-container'
                }
            });
            return;
        }

        const lista = ventas.ventas || [];

        let mensaje = '<div class="cl-historial-list">';

        if (lista.length > 0) {
            lista.slice(0, 10).forEach(v => {
                mensaje += `
                    <div class="cl-historial-item">
                        <span class="cl-historial-date">${v.creado_en || 'N/A'}</span>
                        <span class="cl-historial-amount">Bs ${v.total_bs || '0.00'}</span>
                        <span class="cl-historial-points">+${Math.floor((v.total_centavos || 0) / 1000)} pts</span>
                    </div>
                `;
            });
        } else {
            mensaje += '<p class="cl-empty-text">No hay historial de puntos</p>';
        }

        mensaje += '</div>';

        Swal.fire({
            title: 'Historial de Puntos',
            html: mensaje,
            confirmButtonColor: '#48bb78',
            width: 600,
            customClass: {
                container: 'cl-sw-container'
            }
        });

    } catch (error) {
        console.error(error);

        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo cargar el historial',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}

function cerrarPuntosModal() {
    document.getElementById('puntosModal').style.display = 'none';
}

// ============================================================
// 7. HISTORIAL COMPLETO CON MODAL
// ============================================================

async function verHistorial(id) {
    try {
        const [ventas, estadisticas, facturas] = await Promise.all([
            apiCall(API_PORTS.clientes, `/api/clientes/${id}/historial/ventas`),
            apiCall(API_PORTS.clientes, `/api/clientes/${id}/estadisticas`),
            apiCall(API_PORTS.clientes, `/api/clientes/${id}/historial/facturas`)
        ]);

        // 🔒 PROTEGER DATOS
        const stats = estadisticas?.resumen || {};
        const cliente = estadisticas?.cliente || {};
        const ultimas = ventas?.ventas?.slice(0, 5) || [];
        const totalFacturas = facturas?.total || 0;

        const modal = document.getElementById('historialModal');
        const content = document.getElementById('historialContent');

        document.getElementById('historialTitle').innerHTML = `
            <i class="fas fa-history"></i> Historial de ${cliente.nombre || 'Cliente'}
        `;

        let html = `
            <div class="cl-historial-stats">

                <div class="cl-historial-stat">
                    <span class="cl-historial-stat-value">${stats.total_compras || 0}</span>
                    <span class="cl-historial-stat-label"><i class="fas fa-shopping-cart"></i> Compras</span>
                </div>

                <div class="cl-historial-stat">
                    <span class="cl-historial-stat-value">Bs ${stats.total_gastado_bs || '0.00'}</span>
                    <span class="cl-historial-stat-label"><i class="fas fa-money-bill-wave"></i> Gastado</span>
                </div>

                <div class="cl-historial-stat">
                    <span class="cl-historial-stat-value">Bs ${stats.promedio_gasto_bs || '0.00'}</span>
                    <span class="cl-historial-stat-label"><i class="fas fa-calculator"></i> Promedio</span>
                </div>

                <div class="cl-historial-stat">
                    <span class="cl-historial-stat-value">${cliente.puntos || 0}</span>
                    <span class="cl-historial-stat-label"><i class="fas fa-star"></i> Puntos</span>
                </div>

            </div>

            <div class="cl-historial-tabla">
                <h4><i class="fas fa-list"></i> Últimas compras</h4>

                <table class="cl-data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Total</th>
                            <th>Factura</th>
                            <th>Productos</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (ultimas.length > 0) {
            ultimas.forEach(v => {
                html += `
                    <tr>
                        <td>${v.creado_en || 'N/A'}</td>
                        <td><strong>Bs ${v.total_bs || '0.00'}</strong></td>
                        <td>${v.numero_factura || 'N/A'}</td>
                        <td>${v.total_productos || 0}</td>
                    </tr>
                `;
            });
        } else {
            html += `
                <tr>
                    <td colspan="4" class="cl-empty-text">Sin compras registradas</td>
                </tr>
            `;
        }

        html += `
                    </tbody>
                </table>

                <div style="margin-top:15px;text-align:center;">
                    <span class="cl-badge">Total facturas: ${totalFacturas}</span>
                </div>
            </div>
        `;

        content.innerHTML = html;
        modal.style.display = 'block';

    } catch (error) {
        console.error(error);

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar el historial',
            confirmButtonColor: '#48bb78',
            customClass: {
                container: 'cl-sw-container'
            }
        });
    }
}
// customClass: {
//     container: 'cl-sw-container'
// }

function cerrarHistorialModal() {
    document.getElementById('historialModal').style.display = 'none';
}

// ============================================================
// 8. ESTADÍSTICAS CON CHART.JS
// ============================================================

let chartInstance1 = null;
let chartInstance2 = null;

async function cargarEstadisticas() {
    try {
        const [topPuntos, total, puntos, allClients] = await Promise.all([
            apiCall(API_PORTS.clientes, '/api/clientes/top-puntos?limit=10'),
            apiCall(API_PORTS.clientes, '/api/clientes/contador-compras/total'),
            apiCall(API_PORTS.clientes, '/api/clientes/contador-compras/promedio'),
            apiCall(API_PORTS.clientes, '/api/clientes?limit=100')
        ]);

        document.getElementById('statTotalClientes').textContent = puntos.total_clientes || 0;
        document.getElementById('statTotalCompras').textContent = total.total_compras || 0;
        document.getElementById('statPromedioCompras').textContent = puntos.promedio_compras || 0;
        document.getElementById('statTotalPuntos').textContent = topPuntos.data?.reduce((sum, c) => sum + c.puntos, 0) || 0;

        const ctx1 = document.getElementById('clientesChart')?.getContext('2d');
        if (ctx1) {
            if (chartInstance1) chartInstance1.destroy();
            chartInstance1 = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: topPuntos.data?.map(c => c.nombre) || [],
                    datasets: [{
                        label: 'Puntos',
                        data: topPuntos.data?.map(c => c.puntos) || [],
                        backgroundColor: 'rgba(72, 187, 120, 0.7)',
                        borderColor: '#48bb78',
                        borderWidth: 2,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        title: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Gráfico de estado
        const ctx2 = document.getElementById('estadoChart')?.getContext('2d');
        if (ctx2 && allClients.data) {
            const activos = allClients.data.filter(c => c.estado === 'activo').length;
            const inactivos = allClients.data.filter(c => c.estado === 'inactivo').length;

            if (chartInstance2) chartInstance2.destroy();
            chartInstance2 = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Activos', 'Inactivos'],
                    datasets: [{
                        data: [activos, inactivos],
                        backgroundColor: ['#48bb78', '#fc8181'],
                        borderWidth: 2,
                        borderColor: 'white'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error en estadísticas:', error);
    }
}

async function cargarEstadisticasGlobales() {
    try {
        const data = await apiCall(API_PORTS.clientes, '/api/clientes/contador-compras/promedio');
        document.getElementById('totalClientesBadge').textContent = `${data.total_clientes || 0} clientes`;
    } catch (error) {
        console.error('Error:', error);
    }
}

function mostrarEstadisticas() {
    switchTab('stats', document.querySelector('.cl-tab:nth-child(2)'));
}

// ============================================================
// 9. TOP CLIENTES
// ============================================================

async function cargarTopClientes() {
    try {
        const [topPuntos, topCompras] = await Promise.all([
            apiCall(API_PORTS.clientes, '/api/clientes/top-puntos?limit=5'),
            apiCall(API_PORTS.clientes, '/api/clientes/top-compras?limit=5')
        ]);

        // Top por puntos
        let htmlPuntos = '';
        if (topPuntos.data && topPuntos.data.length > 0) {
            topPuntos.data.forEach((c, i) => {
                const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                htmlPuntos += `
                    <div class="cl-top-item">
                        <span class="cl-top-pos">${medalla}</span>
                        <span class="cl-top-name">${escapeHtml(c.nombre)}</span>
                        <span class="cl-top-value"><i class="fas fa-star" style="color:#d69e2e;"></i> ${c.puntos}</span>
                    </div>
                `;
            });
        } else {
            htmlPuntos = '<p class="cl-empty-text">No hay datos</p>';
        }
        document.getElementById('topPuntos').innerHTML = htmlPuntos;

        // Top por compras
        let htmlCompras = '';
        if (topCompras.data && topCompras.data.length > 0) {
            topCompras.data.forEach((c, i) => {
                const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                htmlCompras += `
                    <div class="cl-top-item">
                        <span class="cl-top-pos">${medalla}</span>
                        <span class="cl-top-name">${escapeHtml(c.nombre)}</span>
                        <span class="cl-top-value"><i class="fas fa-shopping-cart"></i> ${c.contador_compras}</span>
                    </div>
                `;
            });
        } else {
            htmlCompras = '<p class="cl-empty-text">No hay datos</p>';
        }
        document.getElementById('topCompras').innerHTML = htmlCompras;
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================================
// 10. ANÁLISIS POR FECHAS
// ============================================================
async function filtrarPorFechas() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;

    if (!desde || !hasta) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas requeridas',
            text: 'Selecciona ambas fechas',
            confirmButtonColor: '#48bb78'
        });
        return;
    }

    try {
        const tbody = document.getElementById('analisisTableBody');
        tbody.innerHTML = '<tr><td colspan="5" class="cl-loading-text"><i class="fas fa-spinner fa-spin"></i> Analizando...</td></tr>';

        // 🔥 NUEVO ENDPOINT: /api/clientes/analisis/compras
        const data = await apiCall(API_PORTS.clientes, `/api/clientes/analisis/compras?desde=${desde}&hasta=${hasta}`);

        if (data.status === 'success' && data.data.length > 0) {
            let html = '';
            
            data.data.forEach(c => {
                html += `
                    <tr>
                        <td><strong>${escapeHtml(c.cliente_nombre)}</strong></td>
                        <td>${c.total_compras}</td>
                        <td>Bs ${c.total_gastado_bs}</td>
                        <td>${c.puntos_generados}</td>
                        <td>Bs ${c.promedio_gasto_bs}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            
            // Actualizar resumen
            document.getElementById('analisisTotalCompras').textContent = data.resumen.total_compras;
            document.getElementById('analisisTotalGastado').textContent = `Bs ${data.resumen.total_gastado_bs}`;
            document.getElementById('analisisTotalPuntos').textContent = data.resumen.total_puntos_generados;
            
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="cl-empty-text">
                <i class="fas fa-inbox"></i> No hay compras en el período seleccionado
            </td></tr>`;
            document.getElementById('analisisTotalCompras').textContent = '0';
            document.getElementById('analisisTotalGastado').textContent = 'Bs 0.00';
            document.getElementById('analisisTotalPuntos').textContent = '0';
        }
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo realizar el análisis. Verifica que el servicio esté corriendo.',
            confirmButtonColor: '#48bb78'
        });
    }
}

function limpiarFiltros() {
    document.getElementById('fechaDesde').value = '';
    document.getElementById('fechaHasta').value = '';
    document.getElementById('analisisTotalCompras').textContent = '0';
    document.getElementById('analisisTotalGastado').textContent = 'Bs 0.00';
    document.getElementById('analisisTotalPuntos').textContent = '0';
    document.getElementById('analisisTableBody').innerHTML = `
        <tr><td colspan="5" class="cl-empty-text">Selecciona un rango de fechas</td></tr>
    `;
}
// ============================================================
// 11.0 VALIDACIONES CLIENTE NUEVO
// ============================================================
function esEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function soloLetras(texto) {
    return /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,100}$/.test(texto);
}

function soloNumeros(texto) {
    return /^[0-9]{7,15}$/.test(texto);
}

function soloNitCi(texto) {
    return /^[0-9]+(-[0-9]+)?$/.test(texto);
}
function validarFormularioCliente() {

    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const nitCi = document.getElementById('nitCi').value.trim();

    // 🔴 NOMBRE
    if (!nombre || !soloLetras(nombre)) {
        Swal.fire({
            icon: 'warning',
            title: 'Nombre inválido',
            text: 'Ingrese un nombre válido (solo letras)',
            customClass: {
                container: 'cl-sw-container'
            }
        });
        return false;
    }

    // 🔴 TELÉFONO
    if (!telefono || !soloNumeros(telefono)) {
        Swal.fire({
            icon: 'warning',
            title: 'Teléfono inválido',
            text: 'Debe contener solo números (7-15 dígitos)',
            customClass: {
                container: 'cl-sw-container'
            }
        });
        return false;
    }

    // 🔵 CORREO OPCIONAL
    if (correo !== '' && !esEmailValido(correo)) {
        Swal.fire({
            icon: 'warning',
            title: 'Correo inválido',
            text: 'Ingrese un correo válido o déjelo vacío',
            customClass: {
                container: 'cl-sw-container'
            }
        });
        return false;
    }

    // 🔴 NIT / CI
    if (!nitCi || !soloNitCi(nitCi) || nitCi.length < 5) {
        Swal.fire({
            icon: 'warning',
            title: 'NIT/CI inválido',
            text: 'Debe ser solo números y opcional un guion (ej: 1234567 o 1234567-2)',
            customClass: {
                container: 'cl-sw-container'
            }
        });
        return false;
    }

    return true;
}



// ============================================================
// 11. FUNCIONES DE MODAL Y UTILITARIOS
// ============================================================

function mostrarFormularioCliente() {
    document.getElementById('clienteId').value = '';
    document.getElementById('nombre').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('correo').value = '';
    document.getElementById('nitCi').value = '';
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Nuevo Cliente';
    document.getElementById('clienteModal').style.display = 'block';
}

function cerrarModal() {
    document.getElementById('clienteModal').style.display = 'none';
}

window.onclick = function (event) {
    const modals = ['clienteModal', 'historialModal', 'puntosModal'];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// ============================================================
// 12. FUNCIONES DE PAGINACIÓN
// ============================================================

let paginaActual = 0;

function cambiarPagina(direccion) {
    const nuevaPagina = paginaActual + direccion;
    if (nuevaPagina < 0) return;
    paginaActual = nuevaPagina;
    cargarClientes(paginaActual);
}

function actualizarPaginacion(page, total, limit) {
    const totalPaginas = Math.ceil((total || 0) / (limit || 10));
    document.getElementById('pageInfo').innerHTML = `
        <i class="fas fa-page"></i> Página ${page + 1} de ${totalPaginas || 1}
    `;
    document.getElementById('prevPage').disabled = page === 0;
    document.getElementById('nextPage').disabled = page >= totalPaginas - 1;
}

// ============================================================
// 13. FUNCIÓN DE SEGURIDAD
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 14. REGISTRAR FUNCIONES GLOBALES
// ============================================================

window.cargarVistaClientes = cargarVistaClientes;
window.mostrarFormularioCliente = mostrarFormularioCliente;
window.guardarCliente = guardarCliente;
window.editarCliente = editarCliente;
window.toggleEstadoCliente = toggleEstadoCliente;
window.buscarClientes = buscarClientes;
window.exportarClientes = exportarClientes;
window.verHistorial = verHistorial;
window.gestionarPuntos = gestionarPuntos;
window.sumarPuntos = sumarPuntos;
window.restarPuntos = restarPuntos;
window.verHistorialPuntos = verHistorialPuntos;
window.cambiarPagina = cambiarPagina;
window.cerrarModal = cerrarModal;
window.cerrarHistorialModal = cerrarHistorialModal;
window.cerrarPuntosModal = cerrarPuntosModal;
window.cargarClientes = cargarClientes;
window.switchTab = switchTab;
window.mostrarEstadisticas = mostrarEstadisticas;
window.cargarEstadisticas = cargarEstadisticas;
window.cargarTopClientes = cargarTopClientes;
window.filtrarPorFechas = filtrarPorFechas;
window.limpiarFiltros = limpiarFiltros;