// Puertos definidos para cada microservicio
const API_PORTS = {
    ventas: 5001,
    inventario: 5002,
    productos: 5003,
    clientes: 5004,
    notificaciones: 5005,
    administracion: 5006
};

const BASE_URL = 'http://localhost';

// =========================================================
// FUNCIÓN GLOBAL PARA PETICIONES (USAR ESTA FUNCIÓN SIEMPRE)
// =========================================================
async function apiCall(servicePort, route, method = 'GET', bodyData = null) {
    const url = `${BASE_URL}:${servicePort}${route}`;
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
            // Aquí en el futuro puedes agregar: 'Authorization': `Bearer ${token}`
        }
    };

    if (bodyData && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(bodyData);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fallo en la petición a ${url}:`, error);
        alert("Error de conexión con el servicio. Revisa la consola.");
        throw error;
    }
}

// =========================================================
// LÓGICA DE NAVEGACIÓN Y VISTAS DE LA SPA
// =========================================================
function loadModule(moduleName, buttonElement) {
    // 1. Actualizar UI del menú
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    buttonElement.classList.add('active');
    
    // 2. Actualizar Título
    document.getElementById('module-title').innerText = `Módulo de ${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;
    
    // 3. Cargar la vista correspondiente
    const contentArea = document.getElementById('main-content');
    
    // MOCKUP temporal para guiar a los desarrolladores:
    // contentArea.innerHTML = `
    //     <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
    //         <h4>Área de trabajo del Dev asignado a ${moduleName}</h4>
    //         <p style="margin-top: 10px;">La API de este servicio corre en: <strong>${BASE_URL}:${API_PORTS[moduleName]}</strong></p>
    //         <button onclick="testConnection('${moduleName}')" style="margin-top:15px; padding:8px 15px; background:var(--primary-color); border:none; border-radius:4px; cursor:pointer; color:white;">Probar Conexión Backend</button>
    //     </div>
    // `;
        // *** CARGA DE MÓDULOS ***
    switch(moduleName) {
        case 'clientes':
            if (typeof cargarVistaClientes === 'undefined') {
                const script = document.createElement('script');
                script.src = 'modules/clientes.js';
                script.onload = () => {
                    if (typeof cargarVistaClientes === 'function') {
                        cargarVistaClientes();
                    }
                };
                document.head.appendChild(script);
            } else {
                cargarVistaClientes();
            }
            break;
            
        default:
            contentArea.innerHTML = `
                <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h4>Área de trabajo del Dev asignado a ${moduleName}</h4>
                    <p style="margin-top: 10px;">La API de este servicio corre en: <strong>${BASE_URL}:${API_PORTS[moduleName]}</strong></p>
                    <button onclick="testConnection('${moduleName}')" style="margin-top:15px; padding:8px 15px; background:var(--primary-color); border:none; border-radius:4px; cursor:pointer; color:white;">Probar Conexión Backend</button>
                </div>
            `;
    }
}

// =========================================================
// PRUEBA DE CONEXIÓN UTILIZANDO LA NUEVA FUNCIÓN GLOBAL
// =========================================================
async function testConnection(moduleName) {
    const port = API_PORTS[moduleName];
    try {
        // Usamos la función global apiCall en lugar de hacer el fetch directamente
        const data = await apiCall(port, '/api/health');
        alert(`Éxito: ${data.message}`);
    } catch (error) {
        // El error ya fue manejado en consola por apiCall
        console.log("Prueba de conexión fallida para el módulo:", moduleName);
    }
}

// Cargar vista inicial al iniciar la app
// window.onload = () => {
//     loadModule('ventas', document.querySelector('.nav-btn'));
// };
// Cargar vista inicial al iniciar la app
// Cargar vista inicial al iniciar la app
window.onload = () => {
    // Iniciar con el módulo de clientes - buscar por texto del botón
    const btns = document.querySelectorAll('.nav-btn');
    let btnClientes = null;
    btns.forEach(btn => {
        if (btn.textContent.trim().includes('Clientes')) {
            btnClientes = btn;
        }
    });
    
    if (btnClientes) {
        loadModule('clientes', btnClientes);
    } else {
        // Si no encuentra, usar el primer botón (ventas)
        loadModule('ventas', document.querySelector('.nav-btn'));
    }
};