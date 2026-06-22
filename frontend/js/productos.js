// CARGAR MÓDULO PRODUCTOS
// =========================
function loadProductosModule() {

    document.getElementById("main-content").innerHTML = `
        <div class="producto-container">

            <h2>🏷️ Productos</h2>

            <div class="acciones-productos">
                <button class="btn-crear" onclick="abrirModalProducto()">
                    ➕ Crear nuevo producto
                </button>
            </div>

            <div class="tabla-responsive">
                <table class="tabla-productos">

                    <thead>
                        <tr>
                            <th>Codigo</th>
                            <th>Producto</th>
                            <th>Categoría</th>
                            <th>Costo</th>
                            <th>Costo Promedio</th>
                            <th>Precio Compra</th>
                            <th>Precio Venta</th>
                            <th>Descripcion</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>

                    <tbody id="tabla-productos-body">
                        <!-- datos dinámicos -->
                    </tbody>

                </table>
            </div>
        </div>

        <!-- Modal Crear Producto -->
        <div id="modal-producto" class="modal">
            <div class="modal-content">
                <h3>Crear Producto</h3>

                <input id="codigo" class="input-modal" placeholder="Código">
                <input id="nombre" class="input-modal" placeholder="Nombre">

                <select id="categoriaSelect" class="input-modal">
                    <option value="">Seleccione una categoría</option>
                    <option value="Abarrotes">Abarrotes</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Lácteos">Lácteos</option>
                    <option value="Carnes">Carnes</option>
                    <option value="Verduras">Verduras</option>
                    <option value="Frutas">Frutas</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Higiene Personal">Higiene Personal</option>
                    <option value="Mascotas">Mascotas</option>
                    <option value="Otra">Nueva categoría</option>
                </select>

                <input
                    id="categoriaNueva"
                    placeholder="Escriba la nueva categoría"
                    style="display:none;">

                <input id="descripcion" class="input-modal" placeholder="Descripción">

                <label style="display:flex; align-items:center; gap:10px; margin-top:5px;">
                    Estado:
                    <input type="checkbox" id="estado">
                    <span id="estado-texto">INACTIVO</span>
                </label>

                <div class="modal-actions">
                    <button class="btn-crear" onclick="crearProducto()">Guardar</button>
                    <button class="btn-cancelar" onclick="cerrarModalProducto()">Cancelar</button>
                </div>
            </div>
        </div>

        <div id="modal-costos" class="modal">
            <div class="modal-content">

                <h3>Gestión de Costos</h3>

                <!-- DATOS PRODUCTO -->
                <div class="info-producto">
                    <p><b>Código:</b> <span id="mp-codigo"></span></p>
                    <p><b>Nombre:</b> <span id="mp-nombre"></span></p>
                    <p><b>Categoría:</b> <span id="mp-categoria"></span></p>
                    <p><b>Descripción:</b> <span id="mp-descripcion"></span></p>
                </div>

                <hr>

                <!-- COSTOS ACTUALES -->
                <div class="info-costos">
                    <p><b>Último costo:</b> <span id="mp-ultimo-costo">0</span></p>
                    <p><b>Costo promedio:</b> <span id="mp-promedio">0</span></p>
                </div>

                <hr>

                <!-- INPUTS -->
                <input id="precio_compra" placeholder="Precio compra">
                <input id="precio_venta" placeholder="Precio venta">

                <div class="modal-actions">
                    <button onclick="guardarCostos()">Guardar</button>
                    <button onclick="cerrarModalCostos()">Cancelar</button>
                </div>

            </div>
        </div>

    <!-- Modal Editar Producto -->
<div id="modal-editar" class="modal">
    <div class="modal-content">

        <h3>Editar Producto</h3>

        <input type="hidden" id="edit-id">

        <input id="edit-codigo" class="input-modal" placeholder="Código">
        <input id="edit-nombre" class="input-modal" placeholder="Nombre">
        
        <!-- Categoría: mismo sistema que en Crear -->
        <select id="edit-categoriaSelect" class="input-modal">
            <option value="">Seleccione una categoría</option>
            <option value="Abarrotes">Abarrotes</option>
            <option value="Bebidas">Bebidas</option>
            <option value="Lácteos">Lácteos</option>
            <option value="Carnes">Carnes</option>
            <option value="Verduras">Verduras</option>
            <option value="Frutas">Frutas</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Higiene Personal">Higiene Personal</option>
            <option value="Mascotas">Mascotas</option>
            <option value="Otra">Nueva categoría</option>
        </select>

        <input
            id="edit-categoriaNueva"
            class="input-modal"
            placeholder="Nueva categoría"
            style="display:none;">
        
        <input id="edit-descripcion" class="input-modal" placeholder="Descripción">

        <label style="display:flex; align-items:center; gap:10px; margin-top:5px;">
            Estado:
            <input type="checkbox" id="edit-estado">
            <span id="edit-estado-texto">INACTIVO</span>
        </label>

        <div class="modal-actions">
            <button class="btn-crear" onclick="actualizarProducto()">
                Guardar cambios
            </button>

            <button class="btn-cancelar" onclick="cerrarModalEditar()">
                Cancelar
            </button>
        </div>

    </div>
</div>

<div id="modal-historial" class="modal">
    <div class="modal-content" style="width: 900px; max-width: 95%;">

        <h3> Historial de Precios</h3>

        <div id="historial-resumen" class="input-modal"></div>

        <div id="historial-tabla"></div>

        <div class="modal-actions">
            <button
                class="btn-cancelar"
                onclick="cerrarModalHistorial()">
                Cerrar
            </button>
        </div>

    </div>
</div>
    `;

    const select = document.getElementById("categoriaSelect");
    const nueva = document.getElementById("categoriaNueva");

    select.addEventListener("change", () => {
        nueva.style.display =
            select.value === "Otra" ? "block" : "none";
    });

    document.getElementById("edit-categoriaSelect")
        .addEventListener("change", function () {

            const nueva = document.getElementById("edit-categoriaNueva");

            if (this.value === "Otra") {
                nueva.style.display = "block";
                nueva.focus();
            } else {
                nueva.style.display = "none";
                nueva.value = "";
            }
        });

    const estado = document.getElementById("estado");

    estado.addEventListener("change", () => {
        document.getElementById("estado-texto").textContent =
            estado.checked ? "ACTIVO" : "INACTIVO";
    });
    // Dentro de loadProductosModule(), al final:
    const editEstado = document.getElementById("edit-estado");
    if (editEstado) {
        editEstado.addEventListener("change", () => {
            document.getElementById("edit-estado-texto").textContent =
                editEstado.checked ? "ACTIVO" : "INACTIVO";
        });
    }
    listarProductos();

}

// =========================
// MODAL
// =========================

function abrirModalProducto() {
    document.getElementById("modal-producto").style.display = "flex";
}

function cerrarModalProducto() {
    document.getElementById("modal-producto").style.display = "none";
}

function obtenerCategoria() {

    const select = document.getElementById("categoriaSelect");
    const nueva = document.getElementById("categoriaNueva");

    if (select.value === "Otra") {
        return nueva.value.trim();
    }

    return select.value;
}
// =========================
// LISTAR PRODUCTOS
// =========================

async function listarProductos() {

    try {

        const response = await apiCall(
            API_PORTS.productos,
            "/api/productos"
            
        );

        const tbody = document.getElementById("tabla-productos-body");

        tbody.innerHTML = "";

        if (!response.data || response.data.length === 0) {

            tbody.innerHTML = `
                <tr>
                    <td colspan="5">No existen productos registrados</td>
                </tr>
            `;

            return;
        }

        response.data.forEach(p => {

            tbody.innerHTML += `
                <tr>
                    <td>${p.codigo}</td>
                    <td>${p.nombre}</td>
                    <td>${p.categoria || "Sin categoría"}</td>
                    <td>${p.ultimo_costo_centavos || 0}</td>
                    <td>${p.costo_promedio_centavos || 0}</td>
                    <td>${p.precio_compra_centavos || 0}</td>
                    <td>${p.precio_venta_centavos || 0}</td>
                    <td>${p.descripcion || "Sin descripción"}</td>

                    <td>
                        <button class="btn-accion btn-editar"
                            onclick="editarProducto(${p.id})">
                            EDITAR
                        </button>

                        <button class="btn-accion btn-eliminar"
                            onclick="eliminarProducto(${p.id})">
                            ELIMINAR
                        </button>

                        <button class="btn-accion btn-costo"
                            onclick="agregarCosto(${p.id})">
                            AGREGAR COSTO
                        </button>

                        <button class="btn-accion btn-historial"
                            onclick="verHistorial(${p.id})">
                            HISTORIAL
                        </button>

                    </td>

                </tr>
            `;
        });

    } catch (error) {
        console.error(error);
        alert("Error al cargar productos");
    }
}


// =========================
// CREAR PRODUCTO
// =========================
async function crearProducto() {

    let categoria;

    const categoriaSelect = document.getElementById("categoriaSelect");
    const categoriaNueva = document.getElementById("categoriaNueva");

    if (categoriaSelect.value === "Otra") {
        categoria = categoriaNueva.value.trim();
    } else {
        categoria = categoriaSelect.value;
    }

    const data = {

        codigo: document.getElementById("codigo").value.trim(),
        nombre: document.getElementById("nombre").value.trim(),
        categoria: categoria,
        descripcion: document.getElementById("descripcion").value.trim(),
        estado: document.getElementById("estado").checked
            ? "activo"
            : "inactivo"
    };

    if (!data.codigo || !data.nombre) {

        alert("Código y nombre son obligatorios");
        return;
    }

    if (!data.categoria) {

        alert("Seleccione o escriba una categoría");
        return;
    }

    try {

        const res = await apiCall(
            API_PORTS.productos,
            "/api/productos",
            "POST",
            data
        );

        console.log("Producto creado:", res);

        alert("Producto creado correctamente ✅");

        document.getElementById("codigo").value = "";
        document.getElementById("nombre").value = "";
        document.getElementById("descripcion").value = "";

        categoriaSelect.selectedIndex = 0;
        categoriaNueva.value = "";
        categoriaNueva.style.display = "none";

        document.getElementById("estado").checked = false;
        document.getElementById("estado-texto").textContent = "INACTIVO";

        cerrarModalProducto();
        listarProductos();

    } catch (error) {

        console.error(error);
        alert("Error al crear producto");
    }
}

let productoSeleccionado = null;

async function agregarCosto(id) {

    productoSeleccionado = id;

    try {

        const res = await apiCall(
            API_PORTS.productos,
            `/api/productos/${id}`
        );

        const p = res.data;

        // ======================
        // DATOS PRODUCTO
        // ======================
        document.getElementById("mp-codigo").innerText = p.codigo;
        document.getElementById("mp-nombre").innerText = p.nombre;
        document.getElementById("mp-categoria").innerText = p.categoria || "";
        document.getElementById("mp-descripcion").innerText = p.descripcion || "";

        // ======================
        // COSTOS (IMPORTANTE)
        // ======================
        const ultimo = p.ultimo_costo_centavos || 0;
        const promedio = p.costo_promedio_centavos || 0;

        document.getElementById("mp-ultimo-costo").innerText = ultimo;
        document.getElementById("mp-promedio").innerText = promedio;

        // ======================
        // INPUTS
        // ======================
        document.getElementById("precio_compra").value = "";
        document.getElementById("precio_venta").value = "";

        document.getElementById("modal-costos").style.display = "flex";

    } catch (error) {
        console.error(error);
        console.log("PRODUCTO COMPLETO:", p);
        alert("Error al cargar producto");
    }
}

async function guardarCostos() {

    const data = {
        precio_compra: parseFloat(document.getElementById("precio_compra").value),
        precio_venta: parseFloat(document.getElementById("precio_venta").value)
    };

    try {

        await apiCall(
            API_PORTS.productos,
            `/api/productos/${productoSeleccionado}/costos`,
            "POST",
            data
        );

        alert("Costo agregado ✅");

        cerrarModalCostos();

        listarProductos(); // opcional refrescar

    } catch (error) {
        console.error(error);
        alert("Error al guardar costos");
    }
}

function cerrarModalCostos() {
    document.getElementById("modal-costos").style.display = "none";
    limpiarModalCostos();
}
function limpiarModalCostos() {
    document.getElementById("mp-codigo").innerText = "";
    document.getElementById("mp-nombre").innerText = "";
    document.getElementById("mp-categoria").innerText = "";
    document.getElementById("mp-descripcion").innerText = "";

    document.getElementById("mp-ultimo-costo").innerText = "0";
    document.getElementById("mp-promedio").innerText = "0";
}


let productoEditando = null;

async function editarProducto(id) {

    try {

        const res = await apiCall(
            API_PORTS.productos,
            `/api/productos/${id}`
        );

        const p = res.data;

        productoEditando = id;

        document.getElementById("edit-id").value = p.id;
        document.getElementById("edit-codigo").value = p.codigo;
        document.getElementById("edit-nombre").value = p.nombre;

        const categoriaSelect =
            document.getElementById("edit-categoriaSelect");

        const categoriaNueva =
            document.getElementById("edit-categoriaNueva");

        let existeCategoria = false;

        for (let option of categoriaSelect.options) {

            if (option.value === p.categoria) {
                existeCategoria = true;
                break;
            }
        }

        if (existeCategoria) {

            categoriaSelect.value = p.categoria;

            categoriaNueva.style.display = "none";
            categoriaNueva.value = "";

        } else {

            categoriaSelect.value = "Otra";

            categoriaNueva.style.display = "block";
            categoriaNueva.value = p.categoria;
        }

        document.getElementById("edit-descripcion").value =
            p.descripcion;

        document.getElementById("edit-estado").checked =
            p.estado === "activo";

        document.getElementById("edit-estado-texto").innerText =
            p.estado === "activo"
                ? "ACTIVO"
                : "INACTIVO";

        document.getElementById("modal-editar").style.display =
            "flex";

    } catch (error) {

        console.error(error);
        alert("Error al cargar producto");
    }
}

// =========================
// CERRAR MODAL EDITAR
// =========================
function cerrarModalEditar() {
    const modal = document.getElementById("modal-editar");
    if (modal) modal.style.display = "none";
}

// Opcional: limpiar campos después de cerrar
function limpiarModalEditar() {
    document.getElementById("edit-id").value = "";
    document.getElementById("edit-codigo").value = "";
    document.getElementById("edit-nombre").value = "";
    document.getElementById("edit-categoria").value = "";
    document.getElementById("edit-descripcion").value = "";
    document.getElementById("edit-estado").checked = false;
    document.getElementById("edit-estado-texto").textContent = "INACTIVO";
}
// =========================
// ACTUALIZAR PRODUCTO
// =========================

async function actualizarProducto() {

    const id = document.getElementById("edit-id").value;

    if (!id) {
        alert("Error: ID de producto no encontrado");
        return;
    }

    let categoria;

    const categoriaSelect =
        document.getElementById("edit-categoriaSelect");

    const categoriaNueva =
        document.getElementById("edit-categoriaNueva");

    if (categoriaSelect.value === "Otra") {
        categoria = categoriaNueva.value.trim();
    } else {
        categoria = categoriaSelect.value;
    }

    const data = {
        codigo: document.getElementById("edit-codigo").value.trim(),
        nombre: document.getElementById("edit-nombre").value.trim(),
        categoria: categoria,
        descripcion: document.getElementById("edit-descripcion").value.trim(),
        estado: document.getElementById("edit-estado").checked
            ? "activo"
            : "inactivo"
    };

    if (!data.codigo || !data.nombre) {
        alert("Código y nombre son obligatorios");
        return;
    }

    if (!data.categoria) {
        alert("Seleccione o escriba una categoría");
        return;
    }

    try {

        const res = await apiCall(
            API_PORTS.productos,
            `/api/productos/${id}`,
            "PUT",
            data
        );

        alert("✅ Producto actualizado correctamente");

        cerrarModalEditar();
        listarProductos();

    } catch (error) {

        console.error("Error al actualizar producto:", error);
        alert("Error al actualizar el producto");
    }
}

// =========================
// ELIMINAR PRODUCTO
// =========================

async function eliminarProducto(id) {

    // Confirmación de seguridad
    const confirmar = confirm("¿Estás seguro de que deseas eliminar este producto?\n\nEsta acción no se puede deshacer.");

    if (!confirmar) {
        return; // El usuario canceló
    }

    // Segunda confirmación (opcional pero recomendado para mayor seguridad)
    const confirmar2 = confirm("⚠️ ¿Realmente deseas eliminar este producto?");

    if (!confirmar2) {
        return;
    }

    try {
        await apiCall(
            API_PORTS.productos,
            `/api/productos/${id}`,
            "DELETE"
        );

        alert("✅ Producto eliminado correctamente");

        // Refrescar la tabla
        listarProductos();

    } catch (error) {
        console.error("Error al eliminar producto:", error);
        
        if (error.response?.data?.message) {
            alert("Error: " + error.response.data.message);
        } else {
            alert("Error al eliminar el producto");
        }
    }
}

// =========================
// VER HISTORIAL
// =========================

async function verHistorial(id) {

    try {

        const res = await apiCall(
            API_PORTS.productos,
            `/api/productos/${id}/historial`
        );

        const historial = res.data || [];

        if (historial.length === 0) {
            alert("Este producto aún no tiene historial de precios.");
            return;
        }

        // ==========================
        // CALCULAR PROMEDIOS
        // ==========================
        let sumaCompras = 0;
        let sumaVentas = 0;

        historial.forEach(h => {

            sumaCompras += Number(h.precio_compra_centavos || 0);
            sumaVentas += Number(h.precio_venta_centavos || 0);

        });

        const promedioCompra =
            ((sumaCompras / historial.length) / 100)
            .toFixed(2);

        const promedioVenta =
            ((sumaVentas / historial.length) / 100)
            .toFixed(2);

        // ==========================
        // RESUMEN
        // ==========================
        document.getElementById("historial-resumen").innerHTML = `
            <strong>📊 Resumen</strong><br><br>

            Promedio Compra:
            <strong>Bs ${promedioCompra}</strong>

            <br><br>

            Promedio Venta:
            <strong>Bs ${promedioVenta}</strong>
        `;

        // ==========================
        // TABLA
        // ==========================
        let tabla = `
            <table style="
                width:100%;
                border-collapse:collapse;
                margin-top:10px;
            ">
                <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="border:1px solid #ddd; padding:8px;">
                            Fecha
                        </th>

                        <th style="border:1px solid #ddd; padding:8px;">
                            Compra
                        </th>

                        <th style="border:1px solid #ddd; padding:8px;">
                            Venta
                        </th>
                    </tr>
                </thead>
                <tbody>
        `;

        historial.forEach(h => {

            const fecha =
                new Date(h.fecha_inicio)
                .toLocaleString("es-ES");

            const compra =
                ((h.precio_compra_centavos || 0) / 100)
                .toFixed(2);

            const venta =
                ((h.precio_venta_centavos || 0) / 100)
                .toFixed(2);

            tabla += `
                <tr>
                    <td style="border:1px solid #ddd; padding:8px;">
                        ${fecha}
                    </td>

                    <td style="border:1px solid #ddd; padding:8px;">
                        Bs ${compra}
                    </td>

                    <td style="border:1px solid #ddd; padding:8px;">
                        Bs ${venta}
                    </td>
                </tr>
            `;
        });

        tabla += `
                </tbody>
            </table>
        `;

        document.getElementById("historial-tabla").innerHTML = tabla;

        document.getElementById("modal-historial").style.display = "flex";

    } catch (error) {

        console.error(error);
        alert("Error al cargar el historial");
    }
}
function cerrarModalHistorial() {
    document.getElementById("modal-historial").style.display = "none";
}