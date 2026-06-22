from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import uuid

app = Flask(__name__)
CORS(app)

SERVICE_PORT = 5003
SERVICE_NAME = "Productos"
DATABASE_PATH = "../database/inventario.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# HEALTH
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success",
        "message": f"{SERVICE_NAME} OK en puerto {SERVICE_PORT}"
    }), 200

# LISTAR PRODUCTOS}

@app.route('/api/productos', methods=['GET'])
def listar_productos():
    try:
        conn = get_db_connection()

        productos = conn.execute("""
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.categoria,
                p.estado,

                (
                    SELECT pc.ultimo_costo_centavos
                    FROM producto_costos pc
                    WHERE pc.producto_id = p.id
                    ORDER BY pc.actualizado_en DESC
                    LIMIT 1
                ) AS ultimo_costo_centavos,

                (
                    SELECT pc.costo_promedio_centavos
                    FROM producto_costos pc
                    WHERE pc.producto_id = p.id
                    ORDER BY pc.actualizado_en DESC
                    LIMIT 1
                ) AS costo_promedio_centavos,

                (
                    SELECT hp.precio_compra_centavos
                    FROM historial_precios hp
                    WHERE hp.producto_id = p.id
                    ORDER BY hp.fecha_inicio DESC
                    LIMIT 1
                ) AS precio_compra_centavos,

                (
                    SELECT hp.precio_venta_centavos
                    FROM historial_precios hp
                    WHERE hp.producto_id = p.id
                    ORDER BY hp.fecha_inicio DESC
                    LIMIT 1
                ) AS precio_venta_centavos

            FROM productos p
            ORDER BY p.id DESC
        """).fetchall()

        conn.close()

        productos_lista = []

        for p in productos:
            producto = dict(p)

            producto["ultimo_costo_centavos"] = (
                round(producto["ultimo_costo_centavos"] / 100, 2)
                if producto["ultimo_costo_centavos"] is not None else 0
            )

            producto["costo_promedio_centavos"] = (
                round(producto["costo_promedio_centavos"] / 100, 2)
                if producto["costo_promedio_centavos"] is not None else 0
            )

            producto["precio_compra_centavos"] = (
                round(producto["precio_compra_centavos"] / 100, 2)
                if producto["precio_compra_centavos"] is not None else 0
            )

            producto["precio_venta_centavos"] = (
                round(producto["precio_venta_centavos"] / 100, 2)
                if producto["precio_venta_centavos"] is not None else 0
            )

            productos_lista.append(producto)

        return jsonify({
            "status": "success",
            "data": productos_lista
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
# OBTENER PRODUCTO POR ID
# OBTENER PRODUCTO POR ID
@app.route('/api/productos/<int:id>', methods=['GET'])
def obtener_producto(id):
    try:
        conn = get_db_connection()

        producto = conn.execute("""
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.categoria,
                p.estado,

                (
                    SELECT pc.ultimo_costo_centavos
                    FROM producto_costos pc
                    WHERE pc.producto_id = p.id
                    ORDER BY pc.actualizado_en DESC
                    LIMIT 1
                ) AS ultimo_costo_centavos,

                (
                    SELECT pc.costo_promedio_centavos
                    FROM producto_costos pc
                    WHERE pc.producto_id = p.id
                    ORDER BY pc.actualizado_en DESC
                    LIMIT 1
                ) AS costo_promedio_centavos

            FROM productos p
            WHERE p.id = ?
        """, (id,)).fetchone()

        conn.close()

        if not producto:
            return jsonify({
                "status": "error",
                "message": "Producto no encontrado"
            }), 404

        producto_dict = dict(producto)

        # Convertir de centavos a decimales
        producto_dict["ultimo_costo_centavos"] = (
            round(producto_dict["ultimo_costo_centavos"] / 100, 2)
            if producto_dict["ultimo_costo_centavos"] is not None else 0
        )

        producto_dict["costo_promedio_centavos"] = (
            round(producto_dict["costo_promedio_centavos"] / 100, 2)
            if producto_dict["costo_promedio_centavos"] is not None else 0
        )

        return jsonify({
            "status": "success",
            "data": producto_dict
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# CREAR PRODUCTO
@app.route('/api/productos', methods=['POST'])
def crear_producto():
    try:
        data = request.get_json()

        codigo = data.get('codigo')
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        categoria = data.get('categoria')
        estado = data.get('estado', 'activo').lower()

        uid = str(uuid.uuid4())

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO productos(
                uid,
                codigo,
                nombre,
                descripcion,
                categoria,
                estado
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            uid,
            codigo,
            nombre,
            descripcion,
            categoria,
            estado
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Producto creado"
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/productos/<int:id>/costos', methods=['POST'])
def agregar_costos(id):
    try:
        data = request.get_json()

        # Recibimos los precios como float desde el frontend
        precio_compra = float(data.get('precio_compra', 0))
        precio_venta = float(data.get('precio_venta', 0))

        # ======================
        # CONVERSIÓN A CENTAVOS (Enteros)
        # ======================
        precio_compra_centavos = int(round(precio_compra * 100))
        precio_venta_centavos = int(round(precio_venta * 100))

        # Validaciones
        if precio_compra_centavos < 0 or precio_venta_centavos < 0:
            return jsonify({"error": "Los precios no pueden ser negativos"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # ======================
        # 1. obtener ultimo costo
        # ======================
        cursor.execute("""
            SELECT ultimo_costo_centavos, costo_promedio_centavos
            FROM producto_costos
            WHERE producto_id = ?
            ORDER BY actualizado_en DESC
            LIMIT 1
        """, (id,))

        row = cursor.fetchone()

        if row:
            ultimo_centavos = row[0]
            # Promedio simple en centavos (usando división entera)
            promedio_centavos = (ultimo_centavos + precio_compra_centavos) // 2
        else:
            promedio_centavos = precio_compra_centavos

        # ======================
        # 2. obtener producto
        # ======================
        cursor.execute("SELECT uid FROM productos WHERE id = ?", (id,))
        producto = cursor.fetchone()

        if not producto:
            return jsonify({"error": "Producto no existe"}), 404

        uid = producto[0]

        # ======================
        # 3. ACTUALIZAR último costo
        # ======================
        cursor.execute("""
            UPDATE producto_costos
            SET ultimo_costo_centavos = ?,
                costo_promedio_centavos = ?,
                actualizado_en = datetime('now')
            WHERE producto_id = ?
        """, (
            precio_compra_centavos,
            promedio_centavos,
            id
        ))

        # Si no existía fila → INSERT
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO producto_costos(
                    producto_id,
                    producto_uid,
                    ultimo_costo_centavos,
                    costo_promedio_centavos,
                    actualizado_en
                )
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (
                id,
                uid,
                precio_compra_centavos,
                promedio_centavos
            ))

        # ======================
        # 4. historial (SIEMPRE INSERTA)
        # ======================
        cursor.execute("""
            INSERT INTO historial_precios(
                producto_id,
                producto_uid,
                precio_compra_centavos,
                precio_venta_centavos,
                fecha_inicio,
                fecha_fin
            )
            VALUES (?, ?, ?, ?, datetime('now'), NULL)
        """, (
            id,
            uid,
            precio_compra_centavos,
            precio_venta_centavos
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": "Costo actualizado correctamente"
        }), 200

    except ValueError:
        return jsonify({"error": "Los precios deben ser números válidos"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/productos/<int:id>', methods=['PUT'])
def editar_producto(id):
    try:
        data = request.get_json()

        codigo = data.get('codigo')
        nombre = data.get('nombre')
        descripcion = data.get('descripcion')
        categoria = data.get('categoria')
        estado = data.get('estado', 'activo').lower()

        if estado not in ['activo', 'inactivo']:
            estado = 'activo'

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE productos
            SET codigo = ?,
                nombre = ?,
                descripcion = ?,
                categoria = ?,
                estado = ?
            WHERE id = ?
        """, (
            codigo,
            nombre,
            descripcion,
            categoria,
            estado,
            id
        ))

        conn.commit()

        if cursor.rowcount == 0:
            return jsonify({
                "status": "error",
                "message": "Producto no encontrado"
            }), 404

        return jsonify({
            "status": "success",
            "message": "Producto actualizado"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ELIMINAR PRODUCTO
@app.route('/api/productos/<int:id>', methods=['DELETE'])
def eliminar_producto(id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Verificar si el producto existe
        cursor.execute("SELECT id, nombre FROM productos WHERE id = ?", (id,))
        producto = cursor.fetchone()

        if not producto:
            conn.close()
            return jsonify({
                "status": "error",
                "message": "Producto no encontrado"
            }), 404

        # (Opcional) Verificar si tiene costos o historial
        cursor.execute("SELECT COUNT(*) FROM producto_costos WHERE producto_id = ?", (id,))
        tiene_costos = cursor.fetchone()[0] > 0

        cursor.execute("SELECT COUNT(*) FROM historial_precios WHERE producto_id = ?", (id,))
        tiene_historial = cursor.fetchone()[0] > 0

        # Eliminar registros relacionados primero (importante por integridad)
        cursor.execute("DELETE FROM historial_precios WHERE producto_id = ?", (id,))
        cursor.execute("DELETE FROM producto_costos WHERE producto_id = ?", (id,))

        # Eliminar el producto
        cursor.execute("DELETE FROM productos WHERE id = ?", (id,))

        conn.commit()
        conn.close()

        return jsonify({
            "status": "success",
            "message": f"Producto '{producto['nombre']}' eliminado correctamente"
        }), 200

    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return jsonify({
            "status": "error",
            "message": "Error al eliminar el producto",
            "details": str(e)
        }), 500
    
# HISTORIAL DE PRECIOS
@app.route('/api/productos/<int:id>/historial', methods=['GET']) 
def obtener_historial(id):
    try:
        conn = get_db_connection()

        historial = conn.execute("""
            SELECT 
                id,
                precio_compra_centavos,
                precio_venta_centavos,
                fecha_inicio,
                fecha_fin
            FROM historial_precios
            WHERE producto_id = ?
            ORDER BY fecha_inicio DESC
        """, (id,)).fetchall()

        conn.close()

        return jsonify({
            "status": "success",
            "data": [dict(row) for row in historial]
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": "Error al obtener historial",
            "details": str(e)
        }), 500

# ======================
# RUN
# ======================
if __name__ == '__main__':
    app.run(debug=True, port=SERVICE_PORT)