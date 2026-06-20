// ============================================================
// *** MÓDULO DE CLIENTES - SIN DECLARAR VARIABLES DUPLICADAS ***
// ============================================================

// ============================================================
// 1. FUNCIÓN PRINCIPAL - Cargar vista de Clientes
// ============================================================
function cargarVistaClientes() {
    const content = document.getElementById('main-content');
    
    content.innerHTML = `
        <div class="cl-module-container">
            <!-- Título y acciones -->
            <div class="cl-module-header">
                <h2>Gestión de Clientes</h2>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="cl-btn-new" onclick="mostrarFormularioCliente()">
                        ➕ Nuevo Cliente
                    </button>
                    <button class="cl-btn-export" onclick="exportarClientes()">
                        📥 Exportar CSV
                    </button>
                </div>
            </div>

            <!-- Barra de búsqueda -->
            <div class="cl-search-bar">
                <input type="text" id="searchInput" placeholder="🔍 Buscar por nombre, correo, teléfono o NIT/CI..." 
                       onkeyup="buscarClientes(event)">
            </div>

            <!-- Tabla de clientes -->
            <div class="cl-table-container">
                <table class="cl-data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Teléfono</th>
                            <th>Correo</th>
                            <th>NIT/CI</th>
                            <th>Puntos</th>
                            <th>Compras</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody">
                        <tr>
                            <td colspan="9" class="cl-loading-text">🔄 Cargando clientes...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Paginación -->
            <div class="cl-pagination">
                <button onclick="cambiarPagina(-1)" id="prevPage">◀ Anterior</button>
                <span id="pageInfo">Página 1</span>
                <button onclick="cambiarPagina(1)" id="nextPage">Siguiente ▶</button>
            </div>
        </div>

        <!-- Modal para crear/editar cliente -->
        <div id="clienteModal" class="cl-modal" style="display:none;">
            <div class="cl-modal-content">
                <span class="cl-modal-close" onclick="cerrarModal()">&times;</span>
                <h3 class="cl-modal-title" id="modalTitle">✏️ Nuevo Cliente</h3>
                <form id="clienteForm" onsubmit="guardarCliente(event)">
                    <input type="hidden" id="clienteId">
                    
                    <div class="cl-form-group">
                        <label>Nombre completo</label>
                        <input type="text" id="nombre" required placeholder="Ej: Juan Pérez">
                    </div>
                    
                    <div class="cl-form-group">
                        <label>Teléfono</label>
                        <input type="text" id="telefono" required placeholder="Ej: 76543210">
                    </div>
                    
                    <div class="cl-form-group">
                        <label>Correo electrónico</label>
                        <input type="email" id="correo" required placeholder="Ej: juan@email.com">
                    </div>
                    
                    <div class="cl-form-group">
                        <label>NIT/CI</label>
                        <input type="text" id="nitCi" required placeholder="Ej: 123456789">
                    </div>
                    
                    <div class="cl-form-actions">
                        <button type="button" class="cl-btn-secondary" onclick="cerrarModal()">Cancelar</button>
                        <button type="submit" class="cl-btn-primary">💾 Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Cargar clientes al iniciar
    cargarClientes();
}

// ============================================================
// 2. FUNCIONES CRUD
// ============================================================

// 2.1 Cargar lista de clientes
async function cargarClientes(page = 0, search = '') {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" class="loading-text">Cargando...</td></tr>';

    try {
        let url = `/api/clientes?limit=10&offset=${page * 10}`;
        if (search) {
            url = `/api/clientes/buscar?q=${encodeURIComponent(search)}`;
        }

        // USAR LA FUNCIÓN GLOBAL apiCall de app.js
        const data = await apiCall(API_PORTS.clientes, url);
        
        if (data.status === 'success' && data.data.length > 0) {
            renderizarClientes(data.data);
            actualizarPaginacion(page, data.total, data.limit);
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-text">No hay clientes registrados</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="9" class="error-text">❌ Error al cargar clientes</td></tr>';
        console.error('Error:', error);
    }
}

// 2.2 Renderizar clientes en tabla
function renderizarClientes(clientes) {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    clientes.forEach(cliente => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cliente.id}</td>
            <td><strong>${escapeHtml(cliente.nombre)}</strong></td>
            <td>${escapeHtml(cliente.telefono)}</td>
            <td>${escapeHtml(cliente.correo)}</td>
            <td>${escapeHtml(cliente.nit_ci)}</td>
            <td class="cl-puntos-cell">${cliente.puntos || 0}</td>
            <td>${cliente.contador_compras || 0}</td>
            <td>
                <span class="cl-badge ${cliente.estado === 1 ? 'cl-badge-active' : 'cl-badge-inactive'}">
                    ${cliente.estado === 1 ? 'Activo' : 'Inactivo'}
                </span>
            </td>
            <td class="cl-actions-cell">
                <button class="cl-btn-icon cl-btn-edit" onclick="editarCliente(${cliente.id})" title="Editar">✏️</button>
                <button class="cl-btn-icon cl-btn-history" onclick="verHistorial(${cliente.id})" title="Ver historial">📊</button>
                <button class="cl-btn-icon ${cliente.estado === 1 ? 'cl-btn-danger' : 'cl-btn-success'}" 
                        onclick="toggleEstadoCliente(${cliente.id}, ${cliente.estado})" 
                        title="${cliente.estado === 1 ? 'Desactivar' : 'Activar'}">
                    ${cliente.estado === 1 ? '🔴' : '🟢'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 2.3 Crear/Actualizar cliente
async function guardarCliente(event) {
    event.preventDefault();
    
    const id = document.getElementById('clienteId').value;
    const data = {
        nombre: document.getElementById('nombre').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        correo: document.getElementById('correo').value.trim(),
        nit_ci: document.getElementById('nitCi').value.trim()
    };

    // Validaciones básicas
    if (!data.nombre || !data.telefono || !data.correo || !data.nit_ci) {
        alert('❌ Todos los campos son obligatorios');
        return;
    }

    try {
        let url = '/api/clientes';
        let method = 'POST';
        
        if (id) {
            url = `/api/clientes/${id}`;
            method = 'PUT';
        }

        const result = await apiCall(API_PORTS.clientes, url, method, data);
        
        if (result.status === 'success') {
            alert(`✅ ${id ? 'Actualizado' : 'Creado'} exitosamente`);
            cerrarModal();
            cargarClientes();
        }
    } catch (error) {
        alert('❌ Error al guardar cliente');
        console.error(error);
    }
}

// 2.4 Editar cliente
async function editarCliente(id) {
    try {
        const data = await apiCall(API_PORTS.clientes, `/api/clientes/${id}`);
        
        if (data.status === 'success') {
            const cliente = data.data;
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('nombre').value = cliente.nombre;
            document.getElementById('telefono').value = cliente.telefono;
            document.getElementById('correo').value = cliente.correo;
            document.getElementById('nitCi').value = cliente.nit_ci;
            document.getElementById('modalTitle').textContent = '✏️ Editar Cliente';
            document.getElementById('clienteModal').style.display = 'block';
        }
    } catch (error) {
        alert('❌ Error al cargar cliente');
        console.error(error);
    }
}

// 2.5 Cambiar estado (Activar/Desactivar)
async function toggleEstadoCliente(id, estadoActual) {
    const nuevoEstado = estadoActual === 1 ? 0 : 1;
    const accion = nuevoEstado === 1 ? 'activar' : 'desactivar';
    
    if (!confirm(`¿Estás seguro de ${accion} este cliente?`)) return;
    
    try {
        const result = await apiCall(API_PORTS.clientes, `/api/clientes/${id}/estado`, 'PATCH', { estado: nuevoEstado });
        
        if (result.status === 'success') {
            alert(`✅ Cliente ${accion}do exitosamente`);
            cargarClientes();
        }
    } catch (error) {
        alert(`❌ Error al ${accion} cliente`);
        console.error(error);
    }
}

// ============================================================
// 3. FUNCIONES DE BÚSQUEDA Y FILTROS
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
// 4. FUNCIONES DE EXPORTACIÓN
// ============================================================

async function exportarClientes() {
    try {
        const result = await apiCall(API_PORTS.clientes, '/api/clientes/exportar?formato=csv');
        
        if (result.status === 'success') {
            const blob = new Blob([result.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            alert('✅ Exportación exitosa');
        }
    } catch (error) {
        alert('❌ Error al exportar');
        console.error(error);
    }
}

// ============================================================
// 5. FUNCIONES DE HISTORIAL Y ESTADÍSTICAS
// ============================================================

async function verHistorial(id) {
    try {
        const ventas = await apiCall(API_PORTS.clientes, `/api/clientes/${id}/historial/ventas`);
        const estadisticas = await apiCall(API_PORTS.clientes, `/api/clientes/${id}/estadisticas`);
        
        const stats = estadisticas.resumen;
        alert(`
📊 HISTORIAL DEL CLIENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 Total compras: ${stats.total_compras}
💰 Total gastado: Bs ${stats.total_gastado_bs}
📈 Promedio gasto: Bs ${stats.promedio_gasto_bs}
🏆 Compra máxima: Bs ${stats.compra_maxima_bs}
⭐ Puntos acumulados: ${estadisticas.cliente.puntos}

📋 Últimas compras:
${ventas.ventas.slice(0, 3).map(v => 
    `  • ${v.creado_en} - Bs ${v.total_bs}`
).join('\n')}
        `);
    } catch (error) {
        alert('❌ Error al cargar historial');
        console.error(error);
    }
}

// ============================================================
// 6. FUNCIONES DE MODAL Y UTILITARIOS
// ============================================================

function mostrarFormularioCliente() {
    document.getElementById('clienteId').value = '';
    document.getElementById('nombre').value = '';
    document.getElementById('telefono').value = '';
    document.getElementById('correo').value = '';
    document.getElementById('nitCi').value = '';
    document.getElementById('modalTitle').textContent = '➕ Nuevo Cliente';
    document.getElementById('clienteModal').style.display = 'block';
}

function cerrarModal() {
    document.getElementById('clienteModal').style.display = 'none';
}

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
    const modal = document.getElementById('clienteModal');
    if (event.target === modal) {
        cerrarModal();
    }
}

// ============================================================
// 7. FUNCIONES DE PAGINACIÓN
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
    document.getElementById('pageInfo').textContent = `Página ${page + 1} de ${totalPaginas || 1}`;
    document.getElementById('prevPage').disabled = page === 0;
    document.getElementById('nextPage').disabled = page >= totalPaginas - 1;
}

// ============================================================
// 8. FUNCIÓN DE SEGURIDAD - Escapar HTML
// ============================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// 9. REGISTRAR FUNCIONES GLOBALES PARA EL HTML
// ============================================================

window.cargarVistaClientes = cargarVistaClientes;
window.mostrarFormularioCliente = mostrarFormularioCliente;
window.guardarCliente = guardarCliente;
window.editarCliente = editarCliente;
window.toggleEstadoCliente = toggleEstadoCliente;
window.buscarClientes = buscarClientes;
window.exportarClientes = exportarClientes;
window.verHistorial = verHistorial;
window.cambiarPagina = cambiarPagina;
window.cerrarModal = cerrarModal;
window.cargarClientes = cargarClientes;