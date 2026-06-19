from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import requests  # Importación añadida para comunicación entre servicios

app = Flask(__name__)
CORS(app)

SERVICE_PORT = 5006
SERVICE_NAME = "Administracion"
DATABASE_PATH = "../database/administracion.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "success", "message": f"{SERVICE_NAME} OK en puerto {SERVICE_PORT}"}), 200

# Ruta GET original: Para listar sucursales
@app.route('/api/sucursal', methods=['GET'])
def get_sucursales():
    try:
        # conn = get_db_connection()
        # Lógica para consultar las sucursales...
        return jsonify({"data": "Listado de sucursales"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Ruta POST de Kevin: Para crear sucursales y emitir eventos
@app.route('/api/sucursal', methods=['POST'])
def registrar_sucursal():
    try:
        data = request.json
        # 1. Aquí Fabian programará el INSERT de la sucursal
        
        # 2. Ejemplo con 'requests': Publicar evento de Sucursal Creada
        evento = {
            "evento": "SUCURSAL_CREADA",
            "origen": "administracion_service",
            "payload": {"nombre": data.get("nombre"), "uid": data.get("uid")}
        }
        
        requests.post('http://127.0.0.1:5005/api/eventos/publicar', json=evento)
        
        return jsonify({"status": "success", "data": "Sucursal creada exitosamente"}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=SERVICE_PORT)