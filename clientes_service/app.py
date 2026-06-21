from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import requests  # Importación añadida para comunicación entre servicios
import html
import re
import uuid
import csv
import io
import math
from datetime import datetime

app = Flask(__name__)
CORS(app)

SERVICE_PORT = 5004
SERVICE_NAME = "Clientes"
DATABASE_PATH = "../database/ventas.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "success", "message": f"{SERVICE_NAME} OK en puerto {SERVICE_PORT}"}), 200

# @app.route('/api/clientes', methods=['POST'])
# def registrar_cliente():
#     try:
#         data = request.json
#         # 1. Aquí Ronaldo programará el INSERT del cliente
        
#         # 2. Ejemplo con 'requests': Publicar evento de Cliente Creado
#         # evento = {
#         #     "evento": "CLIENTE_CREADO",
#         #     "origen": "clientes_service",
#         #     "payload": {"nombre": data.get("nombre"), "correo": data.get("correo")}
#         # }
        
#         # requests.post('http://127.0.0.1:5005/api/eventos/publicar', json=evento)
        
#         return jsonify({"status": "success", "data": "Cliente creado exitosamente"}), 201
        
#     except Exception as e:
#         return jsonify({"error": str(e)}), 500
    
# ================================================
# GRUPO 1: GESTIÓN BÁSICA DE CLIENTES (CRUD)
# ================================================

@app.route('/api/clientes', methods=['GET'])
def listar_clientes():
    """Listar todos los clientes (con paginación y filtros)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM clientes WHERE 1=1"
        params = []
        
        # Filtro por estado
        estado = request.args.get('estado')
        if estado is not None:
            query += " AND estado = ?"
            params.append(estado)
        
        # Búsqueda
        buscar = request.args.get('buscar')
        if buscar:
            query += """ AND (nombre LIKE ? OR correo LIKE ? OR telefono LIKE ? OR nit_ci LIKE ?)"""
            like_param = f"%{buscar}%"
            params.extend([like_param, like_param, like_param, like_param])
        
        # Paginación
        limit = request.args.get('limit', 20)
        offset = request.args.get('offset', 0)
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        clientes = cursor.fetchall()
        conn.close()
        
        resultado = [dict(cliente) for cliente in clientes]
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado),
            "limit": int(limit),
            "offset": int(offset)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>', methods=['GET'])
def obtener_cliente_por_id(id):
    """Obtener cliente por ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        conn.close()
        
        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        return jsonify({"status": "success", "data": dict(cliente)}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>', methods=['GET'])
def obtener_cliente_por_uid(uid):
    """Obtener cliente por UID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clientes WHERE uid = ?", (uid,))
        cliente = cursor.fetchone()
        conn.close()
        
        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        return jsonify({"status": "success", "data": dict(cliente)}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/buscar', methods=['GET'])
def buscar_clientes():
    """Buscar por nombre, correo, NIT/CI o teléfono"""
    try:
        q = request.args.get('q')
        if not q:
            return jsonify({"error": "Parámetro 'q' es requerido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """SELECT * FROM clientes 
                   WHERE estado = 'activo' AND (
                       nombre LIKE ? OR 
                       correo LIKE ? OR 
                       telefono LIKE ? OR 
                       nit_ci LIKE ?
                   ) ORDER BY nombre LIMIT 30"""
        
        like_param = f"%{q}%"
        cursor.execute(query, (like_param, like_param, like_param, like_param))
        clientes = cursor.fetchall()
        conn.close()
        
        resultado = [dict(cliente) for cliente in clientes]
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes', methods=['POST'])
def crear_cliente():
    """Crear nuevo cliente"""
    try:
        data = request.json
        
        # Validar campos requeridos
        campos_requeridos = ['nombre', 'telefono', 'nit_ci']
        for campo in campos_requeridos:
            if not data.get(campo) or str(data.get(campo)).strip() == '':
                return jsonify({"error": f"El campo '{campo}' es requerido"}), 400
        
        # Sanitizar entradas (prevenir XSS)
        nombre = html.escape(data['nombre'].strip())
        telefono = html.escape(data['telefono'].strip())
        # correo = html.escape(data['correo'].strip())
        correo = data.get('correo', '').strip()
        correo = correo if correo != '' else None
        nit_ci = html.escape(data['nit_ci'].strip())
        # estado = html.escape(data['estado'].strip())
        
        estado = data.get('estado', 'activo').strip().lower()
        
        

        if estado not in ['activo', 'inactivo']:
            return jsonify({
                "error": "Estado inválido. Debe ser 'activo' o 'inactivo'"
            }), 400
        # Validar formato de correo
        if correo:
            if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', correo):
                return jsonify({"error": "Formato de correo inválido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si correo ya existe
        cursor.execute("SELECT id FROM clientes WHERE correo = ?", (correo,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "El correo ya está registrado"}), 400
        
        # Verificar si NIT/CI ya existe
        cursor.execute("SELECT id FROM clientes WHERE nit_ci = ?", (nit_ci,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "El NIT/CI ya está registrado"}), 400
        
        # Generar UID
        uid = str(uuid.uuid4())
        
        # Insertar cliente
        cursor.execute("""
            INSERT INTO clientes (uid, nombre, telefono, correo, nit_ci, puntos, contador_compras, estado)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?)
        """, (uid, nombre, telefono, correo, nit_ci,estado))
        
        conn.commit()
        cliente_id = cursor.lastrowid
        
        # Obtener cliente creado
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,))
        nuevo_cliente = cursor.fetchone()
        conn.close()
        
        # Publicar evento (opcional)
        try:
            evento = {
                "evento": "CLIENTE_CREADO",
                "origen": "clientes_service",
                "payload": {"cliente_id": cliente_id, "nombre": nombre, "correo": correo}
            }
            requests.post('http://127.0.0.1:5005/api/eventos/publicar', json=evento, timeout=2)
        except:
            pass
        
        return jsonify({
            "status": "success",
            "mensaje": "Cliente creado exitosamente",
            "data": dict(nuevo_cliente)
        }), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>', methods=['PUT'])
def actualizar_cliente_por_id(id):
    """Actualizar cliente (por ID)"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si cliente existe
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        # Validar campos
        campos_requeridos = ['nombre', 'telefono', 'correo', 'nit_ci']
        for campo in campos_requeridos:
            if not data.get(campo) or str(data.get(campo)).strip() == '':
                return jsonify({"error": f"El campo '{campo}' es requerido"}), 400
        
        # Sanitizar
        nombre = html.escape(data['nombre'].strip())
        telefono = html.escape(data['telefono'].strip())
        correo = html.escape(data['correo'].strip())
        nit_ci = html.escape(data['nit_ci'].strip())
        
        # Verificar si correo ya existe (excepto el actual)
        cursor.execute("SELECT id FROM clientes WHERE correo = ? AND id != ?", (correo, id))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "El correo ya está registrado por otro cliente"}), 400
        
        # Verificar si NIT/CI ya existe (excepto el actual)
        cursor.execute("SELECT id FROM clientes WHERE nit_ci = ? AND id != ?", (nit_ci, id))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "El NIT/CI ya está registrado por otro cliente"}), 400
        
        # Actualizar cliente
        cursor.execute("""
            UPDATE clientes 
            SET nombre = ?, telefono = ?, correo = ?, nit_ci = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (nombre, telefono, correo, nit_ci, id))
        
        conn.commit()
        
        # Obtener cliente actualizado
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente_actualizado = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Cliente actualizado exitosamente",
            "data": dict(cliente_actualizado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>', methods=['PUT'])
def actualizar_cliente_por_uid(uid):
    """Actualizar cliente (por UID)"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar si cliente existe
        cursor.execute("SELECT * FROM clientes WHERE uid = ?", (uid,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        # Validar campos
        campos_requeridos = ['nombre', 'telefono', 'correo', 'nit_ci']
        for campo in campos_requeridos:
            if not data.get(campo) or str(data.get(campo)).strip() == '':
                return jsonify({"error": f"El campo '{campo}' es requerido"}), 400
        
        # Sanitizar
        nombre = html.escape(data['nombre'].strip())
        telefono = html.escape(data['telefono'].strip())
        correo = html.escape(data['correo'].strip())
        nit_ci = html.escape(data['nit_ci'].strip())
        
        # Actualizar cliente
        cursor.execute("""
            UPDATE clientes 
            SET nombre = ?, telefono = ?, correo = ?, nit_ci = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE uid = ?
        """, (nombre, telefono, correo, nit_ci, uid))
        
        conn.commit()
        
        # Obtener cliente actualizado
        cursor.execute("SELECT * FROM clientes WHERE uid = ?", (uid,))
        cliente_actualizado = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Cliente actualizado exitosamente",
            "data": dict(cliente_actualizado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>', methods=['DELETE'])
def eliminar_cliente(id):
    """Eliminar cliente (baja lógica - estado = inactivo)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar si cliente existe
        cursor.execute("SELECT id, estado FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()

        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404

        # Si ya está inactivo
        if cliente["estado"] == "inactivo":
            conn.close()
            return jsonify({
                "error": "El cliente ya está inactivo"
            }), 400

        # Baja lógica correcta
        cursor.execute("""
            UPDATE clientes 
            SET estado = 'inactivo', actualizado_en = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (id,))

        conn.commit()

        # Obtener cliente actualizado (opcional)
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente_actualizado = cursor.fetchone()

        conn.close()

        return jsonify({
            "status": "success",
            "mensaje": "Cliente desactivado exitosamente (baja lógica)",
            "data": dict(cliente_actualizado) if cliente_actualizado else None
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/estado', methods=['PATCH'])
def cambiar_estado_cliente(id):
    """Activar/desactivar cliente"""
    try:
        data = request.json or {}

        nuevo_estado = data.get('estado')

        # 🔴 Validar estados correctos (STRING)
        if nuevo_estado not in ['activo', 'inactivo']:
            return jsonify({
                "error": "El estado debe ser 'activo' o 'inactivo'"
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar existencia
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()

        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404

        # Actualizar estado
        cursor.execute("""
            UPDATE clientes 
            SET estado = ?, actualizado_en = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (nuevo_estado, id))

        conn.commit()

        # Obtener actualizado (opcional)
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente_actualizado = cursor.fetchone()

        conn.close()

        return jsonify({
            "status": "success",
            "mensaje": f"Cliente {'activado' if nuevo_estado == 'activo' else 'desactivado'} exitosamente",
            "data": dict(cliente_actualizado) if cliente_actualizado else None
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    

# ================================================
# GRUPO 2: PROGRAMA DE FIDELIZACIÓN (PUNTOS)
# ================================================

@app.route('/api/clientes/<int:id>/puntos', methods=['GET'])
def consultar_puntos(id):
    """Consultar puntos acumulados"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, puntos FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        conn.close()
        
        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        return jsonify({
            "status": "success",
            "cliente_id": cliente['id'],
            "nombre": cliente['nombre'],
            "puntos": cliente['puntos']
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>/puntos', methods=['GET'])
def consultar_puntos_por_uid(uid):
    """Consultar puntos por UID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, puntos FROM clientes WHERE uid = ? AND estado = 'activo'", (uid,))
        cliente = cursor.fetchone()
        conn.close()
        
        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        return jsonify({
            "status": "success",
            "cliente_id": cliente['id'],
            "nombre": cliente['nombre'],
            "puntos": cliente['puntos']
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/puntos/sumar', methods=['POST'])
def sumar_puntos(id):
    """Sumar puntos (por compras)"""
    try:
        data = request.json
        puntos_a_sumar = data.get('puntos')
        descripcion = data.get('descripcion', 'Suma de puntos por compra')
        
        if not puntos_a_sumar or puntos_a_sumar <= 0:
            return jsonify({"error": "Los puntos a sumar deben ser mayores a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, puntos FROM clientes WHERE id = ? AND estado = 'activo'", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        puntos_anteriores = cliente['puntos']
        
        cursor.execute("""
            UPDATE clientes 
            SET puntos = puntos + ?, actualizado_en = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (puntos_a_sumar, id))
        
        cursor.execute("""
            UPDATE clientes 
            SET contador_compras = contador_compras + 1 
            WHERE id = ?
        """, (id,))
        
        conn.commit()
        
        cursor.execute("SELECT puntos FROM clientes WHERE id = ?", (id,))
        puntos_actualizados = cursor.fetchone()['puntos']
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": f"Se sumaron {puntos_a_sumar} puntos",
            "cliente_id": id,
            "puntos_anteriores": puntos_anteriores,
            "puntos_actuales": puntos_actualizados,
            "descripcion": descripcion
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/puntos/restar', methods=['POST'])
def restar_puntos(id):
    """Restar puntos (por canje)"""
    try:
        data = request.json
        puntos_a_restar = data.get('puntos')
        descripcion = data.get('descripcion', 'Resta de puntos por canje')
        
        if not puntos_a_restar or puntos_a_restar <= 0:
            return jsonify({"error": "Los puntos a restar deben ser mayores a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, puntos FROM clientes WHERE id = ? AND estado = 'activo'", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        if cliente['puntos'] < puntos_a_restar:
            conn.close()
            return jsonify({"error": "Puntos insuficientes"}), 400
        
        puntos_anteriores = cliente['puntos']
        
        cursor.execute("""
            UPDATE clientes 
            SET puntos = puntos - ?, actualizado_en = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (puntos_a_restar, id))
        
        conn.commit()
        
        cursor.execute("SELECT puntos FROM clientes WHERE id = ?", (id,))
        puntos_actualizados = cursor.fetchone()['puntos']
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": f"Se restaron {puntos_a_restar} puntos",
            "cliente_id": id,
            "puntos_anteriores": puntos_anteriores,
            "puntos_actuales": puntos_actualizados,
            "descripcion": descripcion
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/top-puntos', methods=['GET'])
def top_clientes_puntos():
    """Top clientes con más puntos"""
    try:
        limit = request.args.get('limit', 10)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, uid, nombre, correo, telefono, puntos, contador_compras
            FROM clientes 
            WHERE estado = 'activo'
            ORDER BY puntos DESC 
            LIMIT ?
        """, (limit,))
        clientes = cursor.fetchall()
        conn.close()
        
        resultado = [dict(cliente) for cliente in clientes]
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/top-compras', methods=['GET'])
def top_clientes_compras():
    """Top clientes por contador_compras"""
    try:
        limit = int(request.args.get('limit', 10))
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, uid, nombre, correo, telefono, puntos, contador_compras
            FROM clientes 
            WHERE estado = 'activo' 
            ORDER BY contador_compras DESC 
            LIMIT ?
        """, (limit,))
        clientes = cursor.fetchall()
        conn.close()
        
        resultado = [dict(cliente) for cliente in clientes]
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ================================================
# GRUPO 3: HISTORIAL Y ESTADÍSTICAS
# ================================================

@app.route('/api/clientes/<int:id>/historial/ventas', methods=['GET'])
def historial_ventas_cliente(id):
    """Historial de ventas del cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        cursor.execute("""
            SELECT 
                v.id, v.uid, v.total_centavos, v.estado, v.creado_en, v.tipo_venta,
                f.numero_factura,
                (SELECT COUNT(*) FROM detalle_ventas WHERE venta_id = v.id) as total_productos
            FROM ventas v
            LEFT JOIN facturas f ON v.id = f.venta_id
            WHERE v.cliente_id = ?
            ORDER BY v.creado_en DESC
            LIMIT 50
        """, (id,))
        
        ventas = cursor.fetchall()
        conn.close()
        
        resultado = []
        for venta in ventas:
            venta_dict = dict(venta)
            if venta_dict.get('total_centavos'):
                venta_dict['total_bs'] = f"{venta_dict['total_centavos'] / 100:.2f}"
            resultado.append(venta_dict)
        
        return jsonify({
            "status": "success",
            "cliente": dict(cliente),
            "total_ventas": len(resultado),
            "ventas": resultado
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/historial/compras', methods=['GET'])
def historial_compras_resumen(id):
    """Resumen de compras agrupadas"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', creado_en) as mes,
                COUNT(*) as total_compras,
                SUM(total_centavos) as total_gastado,
                AVG(total_centavos) as promedio
            FROM ventas 
            WHERE cliente_id = ?
            GROUP BY mes
            ORDER BY mes DESC
        """, (id,))
        
        compras = cursor.fetchall()
        conn.close()
        
        resultado = []
        for compra in compras:
            compra_dict = dict(compra)
            if compra_dict.get('total_gastado'):
                compra_dict['total_gastado_bs'] = f"{compra_dict['total_gastado'] / 100:.2f}"
            resultado.append(compra_dict)
        
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/historial/facturas', methods=['GET'])
def historial_facturas_cliente(id):
    """Facturas emitidas al cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                id, uid, numero_factura, monto_total_centavos, 
                estado, creado_en, archivo_pdf
            FROM facturas 
            WHERE cliente_id = ?
            ORDER BY creado_en DESC
            LIMIT 50
        """, (id,))
        
        facturas = cursor.fetchall()
        conn.close()
        
        resultado = []
        for factura in facturas:
            factura_dict = dict(factura)
            if factura_dict.get('monto_total_centavos'):
                factura_dict['monto_total_bs'] = f"{factura_dict['monto_total_centavos'] / 100:.2f}"
            resultado.append(factura_dict)
        
        return jsonify({
            "status": "success",
            "data": resultado,
            "total": len(resultado)
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/estadisticas', methods=['GET'])
def estadisticas_cliente(id):
    """Estadísticas completas (clientes + ventas)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_compras,
                SUM(total_centavos) as total_gastado,
                AVG(total_centavos) as promedio_gasto,
                MAX(total_centavos) as compra_maxima,
                MIN(total_centavos) as compra_minima
            FROM ventas 
            WHERE cliente_id = ?
        """, (id,))
        resumen = cursor.fetchone()
        
        cursor.execute("""
            SELECT id, total_centavos, creado_en 
            FROM ventas 
            WHERE cliente_id = ? 
            ORDER BY creado_en DESC 
            LIMIT 1
        """, (id,))
        ultima_compra = cursor.fetchone()
        
        conn.close()
        
        return jsonify({
            "status": "success",
            "cliente": dict(cliente),
            "resumen": {
                "total_compras": resumen['total_compras'] or 0,
                "total_gastado_bs": f"{(resumen['total_gastado'] or 0) / 100:.2f}",
                "total_gastado_centavos": resumen['total_gastado'] or 0,
                "promedio_gasto_bs": f"{(resumen['promedio_gasto'] or 0) / 100:.2f}",
                "compra_maxima_bs": f"{(resumen['compra_maxima'] or 0) / 100:.2f}",
                "compra_minima_bs": f"{(resumen['compra_minima'] or 0) / 100:.2f}"
            },
            "ultima_compra": dict(ultima_compra) if ultima_compra else None
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>/estadisticas', methods=['GET'])
def estadisticas_cliente_por_uid(uid):
    """Estadísticas por UID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE uid = ?", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        # Reutilizar la función de estadísticas por ID
        return estadisticas_cliente(cliente['id'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/ultima-compra', methods=['GET'])
def ultima_compra_cliente(id):
    """Última compra realizada"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                v.id, v.uid, v.total_centavos, v.estado, v.creado_en,
                f.numero_factura,
                (SELECT COUNT(*) FROM detalle_ventas WHERE venta_id = v.id) as total_productos
            FROM ventas v
            LEFT JOIN facturas f ON v.id = f.venta_id
            WHERE v.cliente_id = ?
            ORDER BY v.creado_en DESC
            LIMIT 1
        """, (id,))
        
        ultima = cursor.fetchone()
        conn.close()
        
        if not ultima:
            return jsonify({"mensaje": "El cliente no tiene compras"}), 404
        
        resultado = dict(ultima)
        if resultado.get('total_centavos'):
            resultado['total_bs'] = f"{resultado['total_centavos'] / 100:.2f}"
        
        return jsonify({"status": "success", "data": resultado}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ================================================
# GRUPO 4: COMUNICACIÓN ENTRE SERVICIOS (EVENTOS)
# ================================================

@app.route('/api/clientes/eventos/venta-finalizada', methods=['POST'])
def evento_venta_finalizada():
    """Escuchar evento de venta finalizada: Sumar puntos + incrementar contador_compras"""
    try:
        data = request.json
        
        cliente_id = data.get('cliente_id')
        puntos_ganados = data.get('puntos_ganados', 0)
        
        if not cliente_id:
            return jsonify({"error": "cliente_id es requerido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, puntos FROM clientes WHERE id = ? AND estado = 'activo'", (cliente_id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        puntos_anteriores = cliente['puntos']
        
        if puntos_ganados > 0:
            cursor.execute("""
                UPDATE clientes 
                SET puntos = puntos + ?, contador_compras = contador_compras + 1,
                actualizado_en = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (puntos_ganados, cliente_id))
        else:
            cursor.execute("""
                UPDATE clientes 
                SET contador_compras = contador_compras + 1,
                actualizado_en = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (cliente_id,))
        
        conn.commit()
        
        cursor.execute("SELECT puntos FROM clientes WHERE id = ?", (cliente_id,))
        puntos_actualizados = cursor.fetchone()['puntos']
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Evento de venta procesado",
            "cliente_id": cliente_id,
            "puntos_ganados": puntos_ganados,
            "puntos_anteriores": puntos_anteriores,
            "puntos_totales": puntos_actualizados
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/eventos/puntos-actualizados', methods=['POST'])
def evento_puntos_actualizados():
    """Sincronizar puntos desde otro servicio: Actualizar clientes.puntos"""
    try:
        data = request.json
        
        cliente_id = data.get('cliente_id')
        nuevo_total_puntos = data.get('puntos')
        
        if not cliente_id or nuevo_total_puntos is None:
            return jsonify({"error": "cliente_id y puntos son requeridos"}), 400
        
        if nuevo_total_puntos < 0:
            return jsonify({"error": "Los puntos no pueden ser negativos"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE id = ?", (cliente_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        cursor.execute("""
            UPDATE clientes 
            SET puntos = ?, actualizado_en = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (nuevo_total_puntos, cliente_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Puntos actualizados correctamente",
            "cliente_id": cliente_id,
            "puntos_actuales": nuevo_total_puntos
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/eventos/health', methods=['GET'])
def eventos_health():
    """Health check de eventos"""
    return jsonify({
        "status": "success",
        "service": "Clientes Eventos",
        "listening_events": ["venta-finalizada", "puntos-actualizados"]
    }), 200

# ================================================
# GRUPO 5: VALIDACIONES Y BÚSQUEDAS ESPECIALES
# ================================================

@app.route('/api/clientes/verificar/correo', methods=['GET'])
def verificar_correo():
    """Verificar si correo ya existe"""
    try:
        correo = request.args.get('correo')
        if not correo:
            return jsonify({"error": "Parámetro 'correo' es requerido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM clientes WHERE correo = ?", (correo,))
        existe = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "correo": correo,
            "existe": existe is not None,
            "cliente": dict(existe) if existe else None
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/verificar/nit-ci', methods=['GET'])
def verificar_nit_ci():
    """Verificar si NIT/CI ya existe"""
    try:
        nit_ci = request.args.get('nit_ci')
        if not nit_ci:
            return jsonify({"error": "Parámetro 'nit_ci' es requerido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM clientes WHERE nit_ci = ?", (nit_ci,))
        existe = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "nit_ci": nit_ci,
            "existe": existe is not None,
            "cliente": dict(existe) if existe else None
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/verificar/telefono', methods=['GET'])
def verificar_telefono():
    """Verificar si teléfono ya existe"""
    try:
        telefono = request.args.get('telefono')
        if not telefono:
            return jsonify({"error": "Parámetro 'telefono' es requerido"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre FROM clientes WHERE telefono = ?", (telefono,))
        existe = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "telefono": telefono,
            "existe": existe is not None,
            "cliente": dict(existe) if existe else None
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/exportar', methods=['GET'])
def exportar_clientes():
    """Exportar clientes a CSV"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, uid, nombre, telefono, correo, nit_ci, 
                   puntos, contador_compras, estado, creado_en
            FROM clientes 
            WHERE estado = 'activo'
            ORDER BY nombre
        """)
        clientes = cursor.fetchall()
        conn.close()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Encabezados
        writer.writerow(['ID', 'UID', 'Nombre', 'Teléfono', 'Correo', 'NIT/CI', 
                       'Puntos', 'Compras', 'Estado', 'Fecha Registro'])
        
        # Datos
        for cliente in clientes:
            writer.writerow([
                cliente['id'], cliente['uid'], cliente['nombre'],
                cliente['telefono'], cliente['correo'], cliente['nit_ci'],
                cliente['puntos'], cliente['contador_compras'],
                'Activo' if cliente['estado'] == 1 else 'Inactivo',
                cliente['creado_en']
            ])
        
        return jsonify({
            "status": "success",
            "data": output.getvalue()
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# ============================================================
# GRUPO 6: HISTORIAL Y ESTADÍSTICAS (VENTAS)
# ============================================================

@app.route('/api/clientes/uid/<string:uid>/historial/ventas', methods=['GET'])
def historial_ventas_cliente_uid(uid):
    """Historial de ventas del cliente por UID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre FROM clientes WHERE uid = ? AND estado = 'activo'", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        cliente_id = cliente['id']
        conn.close()
        
        return historial_ventas_cliente(cliente_id)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/clientes/uid/<string:uid>/historial/facturas', methods=['GET'])
def historial_facturas_cliente_uid(uid):
    """Facturas emitidas al cliente por UID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE uid = ? AND estado = 'activo'", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        return historial_facturas_cliente(cliente['id'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/clientes/uid/<string:uid>/estadisticas', methods=['GET'])
def estadisticas_cliente_uid(uid):
    """Estadísticas por UID de cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE uid = ?", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        return estadisticas_cliente(cliente['id'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500    
@app.route('/api/clientes/uid/<string:uid>/ultima-compra', methods=['GET'])
def ultima_compra_cliente_uid(uid):
    """Última compra por UID de cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE uid = ? AND estado = 'activo'", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        return ultima_compra_cliente(cliente['id'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# ============================================================
# 6.1. ENDPOINTS PARA MODIFICAR contador_compras
# ============================================================

@app.route('/api/clientes/<int:id>/contador-compras', methods=['PUT'])
def actualizar_contador_compras(id):
    """Actualizar contador_compras manualmente"""
    try:
        data = request.json
        nuevo_valor = data.get('contador_compras')
        
        if nuevo_valor is None or nuevo_valor < 0:
            return jsonify({"error": "El contador_compras debe ser un número mayor o igual a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        valor_anterior = cliente['contador_compras']
        
        cursor.execute("""
            UPDATE clientes 
            SET contador_compras = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (nuevo_valor, id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Contador de compras actualizado",
            "cliente_id": id,
            "valor_anterior": valor_anterior,
            "valor_actual": nuevo_valor
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>/contador-compras', methods=['PUT'])
def actualizar_contador_compras_uid(uid):
    """Actualizar contador_compras por UID"""
    try:
        data = request.json
        nuevo_valor = data.get('contador_compras')
        
        if nuevo_valor is None or nuevo_valor < 0:
            return jsonify({"error": "El contador_compras debe ser un número mayor o igual a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM clientes WHERE uid = ?", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        return actualizar_contador_compras(cliente['id'])
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/contador-compras/incrementar', methods=['POST'])
def incrementar_contador_compras(id):
    """Incrementar contador_compras en +1 (o cantidad personalizada)"""
    try:
        data = request.json or {}
        cantidad = data.get('cantidad', 1)
        
        if cantidad <= 0:
            return jsonify({"error": "La cantidad debe ser mayor a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        valor_anterior = cliente['contador_compras']
        nuevo_valor = valor_anterior + cantidad
        
        cursor.execute("""
            UPDATE clientes 
            SET contador_compras = contador_compras + ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (cantidad, id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": f"Contador de compras incrementado en {cantidad}",
            "cliente_id": id,
            "valor_anterior": valor_anterior,
            "valor_actual": nuevo_valor,
            "incremento": cantidad
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/contador-compras/decrementar', methods=['POST'])
def decrementar_contador_compras(id):
    """Decrementar contador_compras en -1 (o cantidad personalizada)"""
    try:
        data = request.json or {}
        cantidad = data.get('cantidad', 1)
        
        if cantidad <= 0:
            return jsonify({"error": "La cantidad debe ser mayor a 0"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        if cliente['contador_compras'] < cantidad:
            conn.close()
            return jsonify({"error": f"El contador no puede ser negativo. Actual: {cliente['contador_compras']}"}), 400
        
        valor_anterior = cliente['contador_compras']
        nuevo_valor = valor_anterior - cantidad
        
        cursor.execute("""
            UPDATE clientes 
            SET contador_compras = contador_compras - ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (cantidad, id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": f"Contador de compras decrementado en {cantidad}",
            "cliente_id": id,
            "valor_anterior": valor_anterior,
            "valor_actual": nuevo_valor,
            "decremento": cantidad
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/contador-compras/reiniciar', methods=['POST'])
def reiniciar_contador_compras(id):
    """Reiniciar contador_compras a 0"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        valor_anterior = cliente['contador_compras']
        
        cursor.execute("""
            UPDATE clientes 
            SET contador_compras = 0, actualizado_en = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            "status": "success",
            "mensaje": "Contador de compras reiniciado a 0",
            "cliente_id": id,
            "valor_anterior": valor_anterior,
            "valor_actual": 0
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/<int:id>/contador-compras', methods=['GET'])
def obtener_contador_compras(id):
    """Obtener contador_compras de un cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE id = ?", (id,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        
        return jsonify({
            "status": "success",
            "cliente_id": cliente['id'],
            "nombre": cliente['nombre'],
            "contador_compras": cliente['contador_compras']
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/uid/<string:uid>/contador-compras', methods=['GET'])
def obtener_contador_compras_uid(uid):
    """Obtener contador_compras por UID de cliente"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, nombre, contador_compras FROM clientes WHERE uid = ?", (uid,))
        cliente = cursor.fetchone()
        if not cliente:
            conn.close()
            return jsonify({"error": "Cliente no encontrado"}), 404
        
        conn.close()
        
        return jsonify({
            "status": "success",
            "cliente_uid": uid,
            "cliente_id": cliente['id'],
            "nombre": cliente['nombre'],
            "contador_compras": cliente['contador_compras']
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/contador-compras/promedio', methods=['GET'])
def promedio_contador_compras():
    """Promedio de compras de todos los clientes activos"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                AVG(contador_compras) as promedio,
                COUNT(*) as total_clientes,
                SUM(contador_compras) as total_compras
            FROM clientes 
            WHERE estado = 'activo'
        """)
        
        resultado = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "promedio_compras": round(resultado['promedio'] or 0, 2),
            "total_clientes": resultado['total_clientes'] or 0,
            "total_compras": resultado['total_compras'] or 0
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/clientes/contador-compras/total', methods=['GET'])
def total_contador_compras():
    """Total de compras de todos los clientes activos"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT SUM(contador_compras) as total_compras
            FROM clientes 
            WHERE estado = 'activo'
        """)
        
        resultado = cursor.fetchone()
        conn.close()
        
        return jsonify({
            "status": "success",
            "total_compras": resultado['total_compras'] or 0
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/clientes/analisis/compras', methods=['GET'])
def analisis_compras_por_fechas():
    """Analisis de compras por rango de fechas"""
    try:
        desde = request.args.get('desde')
        hasta = request.args.get('hasta')
        
        if not desde or not hasta:
            return jsonify({"error": "Los parámetros 'desde' y 'hasta' son requeridos"}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener todos los clientes activos
        cursor.execute("SELECT id, nombre, uid FROM clientes WHERE estado = 'activo'")
        clientes = cursor.fetchall()
        
        resultados = []
        total_general_compras = 0
        total_general_gastado = 0
        total_general_puntos = 0
        
        for cliente in clientes:
            # Obtener ventas del cliente en el rango de fechas
            cursor.execute("""
                SELECT 
                    v.id, 
                    v.uid,
                    v.total_centavos, 
                    v.creado_en,
                    v.estado,
                    v.tipo_venta,
                    f.numero_factura,
                    (SELECT COUNT(*) FROM detalle_ventas WHERE venta_id = v.id) as total_productos
                FROM ventas v
                LEFT JOIN facturas f ON v.id = f.venta_id
                WHERE v.cliente_id = ? 
                    AND DATE(v.creado_en) >= DATE(?)
                    AND DATE(v.creado_en) <= DATE(?)
                    AND v.estado = 'confirmada'
                ORDER BY v.creado_en DESC
            """, (cliente['id'], desde, hasta))
            
            ventas = cursor.fetchall()
            
            if ventas:
                total_compras = len(ventas)
                total_gastado = sum(v['total_centavos'] or 0 for v in ventas)
                puntos_generados = sum(math.floor((v['total_centavos'] or 0) / 1000) for v in ventas)
                
                ventas_list = []
                for v in ventas:
                    venta_dict = dict(v)
                    if venta_dict.get('total_centavos'):
                        venta_dict['total_bs'] = f"{venta_dict['total_centavos'] / 100:.2f}"
                    ventas_list.append(venta_dict)
                
                resultados.append({
                    "cliente_id": cliente['id'],
                    "cliente_nombre": cliente['nombre'],
                    "cliente_uid": cliente['uid'],
                    "total_compras": total_compras,
                    "total_gastado_centavos": total_gastado,
                    "total_gastado_bs": f"{total_gastado / 100:.2f}",
                    "puntos_generados": puntos_generados,
                    "promedio_gasto_bs": f"{(total_gastado / total_compras) / 100:.2f}",
                    "ventas": ventas_list
                })
                
                total_general_compras += total_compras
                total_general_gastado += total_gastado
                total_general_puntos += puntos_generados
        
        conn.close()
        
        return jsonify({
            "status": "success",
            "data": resultados,
            "resumen": {
                "total_clientes_con_compras": len(resultados),
                "total_compras": total_general_compras,
                "total_gastado_centavos": total_general_gastado,
                "total_gastado_bs": f"{total_general_gastado / 100:.2f}",
                "total_puntos_generados": total_general_puntos
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    app.run(debug=True, port=SERVICE_PORT)