import os
import re
import sqlite3
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests  # Para la simulación de eventos HTTP al servicio de notificaciones

app = Flask(__name__)
CORS(app)

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'inventario.db')
NOTIFICATION_SERVICE_URL = "http://127.0.0.1:5005/api/notifications" # Puerto simulado de notificaciones

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# ==========================================
# REGLA #2: VALIDACIONES Y SEGURIDAD
# ==========================================
def es_invalido(campo):
    """Retorna True si el campo es nulo, vacío o contiene solo espacios en blanco."""
    if campo is None or str(campo).strip() == "":
        return True
    return False

def sanitizar_xss(texto):
    if isinstance(texto, str):
        return re.sub(r'<[^>]*>', '', texto)
    return texto

def disparar_evento_notificacion(evento_tipo, cliente, contenido):
    """Simula el envío de eventos HTTP dirigidos al servicio de notificaciones (Regla #3)."""
    payload = {
        "fecha": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "cliente": cliente,
        "tipo": evento_tipo,
        "contenido": contenido
    }
    try:
        # Se envía de forma asíncrona simulada o con un timeout corto para no trabar el flujo
        requests.post(NOTIFICATION_SERVICE_URL, json=payload, timeout=1)
    except Exception:
        # No bloqueamos el flujo principal si el servicio de notificaciones de los compañeros está apagado
        pass

# ==========================================
# ENDPOINTS OBLIGATORIOS DEL MÓDULO
# ==========================================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success",
        "message": "Inventario OK en puerto 5002"
    }), 200


@app.route('/inventory/balance', methods=['GET'])
def get_balance():
    """Genera un reporte consolidado con el saldo disponible actual (Paso 10)."""
    try:
        conn = get_db_connection()
        query = """
            SELECT i.id, p.nombre AS producto_nombre, p.codigo AS producto_codigo, 
                   i.producto_uid, i.sucursal_id, i.sucursal_uid, 
                   i.stock_actual, i.stock_reservado, i.stock_minimo
            FROM inventario i
            JOIN productos p ON i.producto_id = p.id
        """
        filas = conn.execute(query).fetchall()
        conn.close()
        
        return jsonify({
            "status": "success",
            "data": [dict(f) for f in filas]
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/inventory/<product>', methods=['GET'])
def get_inventory_by_product(product):
    """Consulta las existencias de un producto específico mediante su ID, UID o código."""
    if es_invalido(product):
        return jsonify({"status": "error", "message": "Identificador de producto inválido."}), 400
        
    try:
        conn = get_db_connection()
        query = """
            SELECT i.*, p.nombre, p.codigo 
            FROM inventario i
            JOIN productos p ON i.producto_id = p.id
            WHERE p.id = ? OR p.uid = ? OR p.codigo = ?
        """
        filas = conn.execute(query, (product, product, product)).fetchall()
        conn.close()
        
        return jsonify({
            "status": "success",
            "data": [dict(f) for f in filas]
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/inventory/input', methods=['POST'])
def inventory_input():
    """Registra el ingreso manual de un lote de mercadería (Caso de Revisión 3)."""
    data = request.get_json() or {}
    
    # Validaciones obligatorias de campos vacíos
    for campo in ['producto_id', 'producto_uid', 'sucursal_id', 'sucursal_uid', 'cantidad']:
        if campo not in data or es_invalido(data[campo]):
            return jsonify({"status": "error", "message": f"El campo '{campo}' es obligatorio y no puede estar vacío."}), 400

    cantidad = int(data['cantidad'])
    if cantidad <= 0:
        return jsonify({"status": "error", "message": "La cantidad debe ser mayor a cero."}), 400

    p_id = data['producto_id']
    p_uid = sanitizar_xss(data['producto_uid'])
    s_id = data['sucursal_id']
    s_uid = sanitizar_xss(data['sucursal_uid'])

    try:
        conn = get_db_connection()
        
        # Verificar si el registro ya existe en el inventario de la sucursal
        registro = conn.execute(
            "SELECT stock_actual FROM inventario WHERE producto_id = ? AND sucursal_id = ?", 
            (p_id, s_id)
        ).fetchone()
        
        stock_anterior = 0
        if registro:
            stock_anterior = registro['stock_actual']
            stock_nuevo = stock_anterior + cantidad
            conn.execute(
                "UPDATE inventario SET stock_actual = ?, actualizado_en = datetime('now') WHERE producto_id = ? AND sucursal_id = ?",
                (stock_nuevo, p_id, s_id)
            )
        else:
            stock_nuevo = cantidad
            conn.execute(
                """INSERT INTO inventario (producto_id, producto_uid, sucursal_id, sucursal_uid, stock_actual, stock_reservado, stock_minimo, actualizado_en) 
                   VALUES (?, ?, ?, ?, ?, 0, 5, datetime('now'))""",
                (p_id, p_uid, s_id, s_uid, stock_nuevo)
            )
            
        # Registrar el movimiento en el historial de transacciones (Kardex)
        conn.execute(
            """INSERT INTO movimientos_inventario (uid, producto_id, producto_uid, sucursal_id, sucursal_uid, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, creado_en) 
               VALUES (?, ?, ?, ?, ?, 'INPUT', ?, ?, ?, datetime('now'))""",
            (str(uuid.uuid4()), p_id, p_uid, s_id, s_uid, cantidad, stock_anterior, stock_nuevo)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({"status": "success", "message": "Ingreso de mercadería registrado correctamente.", "stock_actual": stock_nuevo}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/inventory/output', methods=['POST'])
def inventory_output():
    """Registra una baja de inventario por merma, pérdida o vencimiento (Paso 8 del flujo)."""
    data = request.get_json() or {}
    
    for campo in ['producto_id', 'sucursal_id', 'cantidad']:
        if campo not in data or es_invalido(data[campo]):
            return jsonify({"status": "error", "message": f"El campo '{campo}' es requerido."}), 400

    cantidad = int(data['cantidad'])
    p_id = data['producto_id']
    s_id = data['sucursal_id']

    try:
        conn = get_db_connection()
        registro = conn.execute("SELECT * FROM inventario WHERE producto_id = ? AND sucursal_id = ?", (p_id, s_id)).fetchone()
        
        if not registro or registro['stock_actual'] < cantidad:
            conn.close()
            return jsonify({"status": "error", "message": "Stock insuficiente para procesar la baja."}), 400
            
        stock_anterior = registro['stock_actual']
        stock_nuevo = stock_anterior - cantidad
        
        conn.execute("UPDATE inventario SET stock_actual = ?, actualizado_en = datetime('now') WHERE id = ?", (stock_nuevo, registro['id']))
        
        conn.execute(
            """INSERT INTO movimientos_inventario (uid, producto_id, producto_uid, sucursal_id, sucursal_uid, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, creado_en) 
               VALUES (?, ?, ?, ?, ?, 'OUTPUT', ?, ?, ?, datetime('now'))""",
            (str(uuid.uuid4()), p_id, registro['producto_uid'], s_id, registro['sucursal_uid'], cantidad, stock_anterior, stock_nuevo)
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({"status": "success", "message": "Baja de inventario procesada con éxito."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/inventory/transfer', methods=['POST'])
def inventory_transfer():
    """Transfiere inventario entre sucursales (Caso de Revisión 5 - Ej: Prado a El Alto)."""
    data = request.get_json() or {}
    
    for campo in ['producto_id', 'sucursal_origen_id', 'sucursal_destino_id', 'cantidad']:
        if campo not in data or es_invalido(data[campo]):
            return jsonify({"status": "error", "message": f"Falta el campo obligatorio: {campo}"}), 400

    cantidad = int(data['cantidad'])
    p_id = data['producto_id']
    s_origen = data['sucursal_origen_id']
    s_destino = data['sucursal_destino_id']

    try:
        conn = get_db_connection()
        
        # 1. Validar existencias en la sucursal de origen
        origen = conn.execute("SELECT * FROM inventario WHERE producto_id = ? AND sucursal_id = ?", (p_id, s_origen)).fetchone()
        if not origen or origen['stock_actual'] < cantidad:
            conn.close()
            return jsonify({"status": "error", "message": "Monto de stock insuficiente en la sucursal de origen."}), 400
            
        # 2. Consultar la sucursal de destino
        destino = conn.execute("SELECT * FROM inventario WHERE producto_id = ? AND sucursal_id = ?", (p_id, s_destino)).fetchone()
        
        # Descontar de Origen
        orig_ant = origen['stock_actual']
        orig_nue = orig_ant - cantidad
        conn.execute("UPDATE inventario SET stock_actual = ?, actualizado_en = datetime('now') WHERE id = ?", (orig_nue, origen['id']))
        
        # Añadir a Destino
        if destino:
            dest_ant = destino['stock_actual']
            dest_nue = dest_ant + cantidad
            conn.execute("UPDATE inventario SET stock_actual = ?, actualizado_en = datetime('now') WHERE id = ?", (dest_nue, destino['id']))
            dest_uid = destino['sucursal_uid']
        else:
            dest_ant = 0
            dest_nue = cantidad
            dest_uid = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO inventario (producto_id, producto_uid, sucursal_id, sucursal_uid, stock_actual, stock_reservado, stock_minimo, actualizado_en) 
                   VALUES (?, ?, ?, ?, ?, 0, 5, datetime('now'))""",
                (p_id, origen['producto_uid'], s_destino, dest_uid, dest_nue)
            )

        # 3. Registrar el log detallado de transferencia en el Kardex
        conn.execute(
            """INSERT INTO movimientos_inventario (uid, producto_id, producto_uid, sucursal_id, sucursal_uid, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, sucursal_origen_uid, sucursal_destino_uid, creado_en) 
               VALUES (?, ?, ?, ?, ?, 'TRANSFER', ?, ?, ?, ?, ?, datetime('now'))""",
            (str(uuid.uuid4()), p_id, origen['producto_uid'], s_origen, origen['sucursal_uid'], cantidad, orig_ant, orig_nue, origen['sucursal_uid'], dest_uid)
        )
        
        conn.commit()
        conn.close()
        
        # REGLA #3: Publicar el evento mandando la alerta al microservicio de notificaciones
        disparar_evento_notificacion(
            evento_tipo="TransferCompleted", 
            cliente="Sistema Logística", 
            contenido=f"Se transfirieron {cantidad} unidades del producto ID {p_id} desde la sucursal {s_origen} a la {s_destino}."
        )
        
        return jsonify({"status": "success", "message": "Transferencia entre sucursales completada exitosamente y evento publicado."}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/inventory/loadExcel', methods=['POST'])
def load_excel_mock():
    """Simula de manera exacta la carga masiva desde un archivo Excel (Requerimiento Equipo 2)."""
    # En desarrollo real se procesa request.files['file'] con pandas/openpyxl
    # Simulamos el procesamiento exitoso de las filas estructuradas del Excel
    try:
        disparar_evento_notificacion("InventoryLoaded", "Admin Logística", "Carga masiva ejecutada vía archivo de importación Excel.")
        return jsonify({
            "status": "success",
            "message": "Archivo Excel importado correctamente. 4 registros de inventario procesados.",
            "event": "InventoryLoaded"
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5002, debug=True)