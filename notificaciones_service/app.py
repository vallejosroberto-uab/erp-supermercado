from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import requests  # Importado para consumir APIs externas (ej. Twilio, SendGrid) si es necesario

app = Flask(__name__)
CORS(app)

SERVICE_PORT = 5005
SERVICE_NAME = "Notificaciones"
DATABASE_PATH = "../database/notificaciones.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "success", "message": f"{SERVICE_NAME} OK en puerto {SERVICE_PORT}"}), 200

# Este es el ENDPOINT CLAVE donde los demás servicios enviarán sus eventos
@app.route('/api/eventos/publicar', methods=['POST'])
def recibir_evento():
    try:
        # 1. Fabián recibe el payload del evento enviado por Ventas, Inventario, etc.
        evento_data = request.json
        
        tipo_evento = evento_data.get("evento")
        origen = evento_data.get("origen")
        
        # 2. Aquí programará el INSERT a la tabla 'eventos' de notificaciones.db
        print(f"[BROKER] Evento recibido: {tipo_evento} desde {origen}")
        
        return jsonify({"status": "success", "message": "Evento registrado en el broker"}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=SERVICE_PORT)