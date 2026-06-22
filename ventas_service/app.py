from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import os
import re
import sqlite3
import uuid

import requests
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS


app = Flask(__name__)
CORS(app)

# Configuracion principal del microservicio de Ventas y rutas externas que consume.
SERVICE_PORT = 5001
SERVICE_NAME = "Ventas"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.abspath(os.path.join(BASE_DIR, "..", "database", "ventas.db"))
COMPROBANTES_DIR = os.path.join(BASE_DIR, "comprobantes")

INVENTARIO_BAJA_URL = "http://127.0.0.1:5002/api/inventario/baja"
NOTIFICACIONES_EVENTO_URL = "http://127.0.0.1:5005/api/eventos/publicar"
CLIENTES_SERVICE_URL = "http://127.0.0.1:5004"
PRODUCTOS_SERVICE_URL = "http://127.0.0.1:5003"


# Conexion a la base propia del microservicio de Ventas.
def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Utilidades generales para convertir filas, validar texto y trabajar con montos.
def row_to_dict(row):
    return dict(row) if row else None


def has_html_or_script(value):
    if not isinstance(value, str):
        return False
    return bool(re.search(r"<[^>]*>|script|javascript:", value, re.IGNORECASE))


def validate_no_html(payload):
    if isinstance(payload, dict):
        for value in payload.values():
            validate_no_html(value)
    elif isinstance(payload, list):
        for value in payload:
            validate_no_html(value)
    elif has_html_or_script(payload):
        raise ValueError("No se permiten etiquetas HTML, scripts ni javascript en los campos.")


def get_required_text(data, field):
    value = data.get(field)
    if value is None or str(value).strip() == "":
        raise ValueError(f"El campo '{field}' es obligatorio.")
    if has_html_or_script(value):
        raise ValueError(f"El campo '{field}' contiene texto no permitido.")
    return str(value).strip()


def get_required_int(data, field, minimum=1):
    value = data.get(field)
    if value is None or str(value).strip() == "":
        raise ValueError(f"El campo '{field}' es obligatorio.")
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"El campo '{field}' debe ser numerico.")
    if number < minimum:
        raise ValueError(f"El campo '{field}' debe ser mayor o igual a {minimum}.")
    return number


def money_to_centavos(value, field):
    if value is None or str(value).strip() == "":
        raise ValueError(f"El campo '{field}' es obligatorio.")
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f"El campo '{field}' debe ser un monto valido.")
    if amount < 0:
        raise ValueError(f"El campo '{field}' no puede ser negativo.")
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def amount_from_payload(data, centavos_field, decimal_field, default=None):
    if centavos_field in data and data.get(centavos_field) not in (None, ""):
        return get_required_int(data, centavos_field, minimum=0)
    if decimal_field in data and data.get(decimal_field) not in (None, ""):
        return money_to_centavos(data.get(decimal_field), decimal_field)
    if default is not None:
        return default
    raise ValueError(f"Debe enviar '{centavos_field}' o '{decimal_field}'.")


def format_money(centavos):
    return f"{Decimal(centavos) / Decimal(100):.2f}"


def get_allowed_points_discount_percent(puntos):
    return min((int(puntos or 0) // 100) * 10, 30)


def get_points_earned(total_centavos):
    return int(total_centavos or 0) // 10000


# Consultas a otros microservicios para enriquecer datos sin acceder directo a sus tablas.
def fetch_cliente_fidelizacion(cliente_uid):
    if not cliente_uid:
        return None, None
    try:
        response = requests.get(f"{CLIENTES_SERVICE_URL}/api/clientes/uid/{cliente_uid}", timeout=3)
        if response.status_code == 200:
            return response.json().get("data") or {}, None
        return None, f"Clientes respondio {response.status_code} al consultar fidelizacion."
    except requests.RequestException as exc:
        return None, f"No se pudo consultar fidelizacion del cliente: {exc}"


def fetch_producto_nombre(producto_id):
    if not producto_id:
        return None
    try:
        response = requests.get(f"{PRODUCTOS_SERVICE_URL}/api/productos/{producto_id}", timeout=2)
        if response.status_code == 200:
            producto = response.json().get("data") or {}
            return producto.get("nombre") or producto.get("nombre_producto") or producto.get("descripcion")
    except requests.RequestException:
        return None
    return None


# Publica cambios de fidelizacion al servicio de Clientes cuando una venta se confirma o se anula.
def publish_customer_loyalty_update(
    cliente_id,
    cliente_uid,
    venta_uid,
    total_centavos,
    puntos_ganados,
    contador_compras_incremento=1,
    motivo="VENTA_CONFIRMADA",
):
    if not cliente_id and not cliente_uid:
        return None

    if not cliente_id and cliente_uid:
        cliente_data, warning = fetch_cliente_fidelizacion(cliente_uid)
        if warning:
            return warning
        cliente_id = cliente_data.get("id") if cliente_data else None

    if not cliente_id:
        return "No se pudo actualizar fidelizacion porque no se obtuvo cliente_id."

    try:
        if contador_compras_incremento > 0:
            response = requests.post(
                f"{CLIENTES_SERVICE_URL}/api/clientes/eventos/venta-finalizada",
                json={
                    "cliente_id": cliente_id,
                    "venta_uid": venta_uid,
                    "origen": "ventas_service",
                    "puntos_ganados": max(int(puntos_ganados or 0), 0),
                    "total_centavos": total_centavos,
                    "motivo": motivo,
                },
                timeout=3,
            )
            if response.status_code >= 400:
                return f"Clientes respondio {response.status_code} al confirmar fidelizacion."
            return None

        warnings = []
        response = requests.post(
            f"{CLIENTES_SERVICE_URL}/api/clientes/{cliente_id}/contador-compras/decrementar",
            json={"cantidad": abs(int(contador_compras_incremento))},
            timeout=3,
        )
        if response.status_code >= 400:
            warnings.append(f"Clientes respondio {response.status_code} al decrementar compras.")

        puntos_a_restar = abs(int(puntos_ganados or 0))
        if puntos_a_restar > 0:
            response = requests.post(
                f"{CLIENTES_SERVICE_URL}/api/clientes/{cliente_id}/puntos/restar",
                json={
                    "puntos": puntos_a_restar,
                    "descripcion": f"Reversion por {motivo} {venta_uid}",
                },
                timeout=3,
            )
            if response.status_code >= 400:
                warnings.append(f"Clientes respondio {response.status_code} al revertir puntos.")

        return " ".join(warnings) if warnings else None
    except requests.RequestException as exc:
        return f"No se pudo actualizar fidelizacion del cliente: {exc}"


# Utilidades para crear identificadores internos y escapar texto dentro del PDF.
def build_uid(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"


def escape_pdf_text(text):
    return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


# Genera un QR simple para el comprobante sin instalar dependencias externas.
def create_qr_commands(seed, origin_x=205, origin_y=35, cell_size=3):
    digest = hashlib.sha256(seed.encode("utf-8", errors="ignore")).digest()
    bits = "".join(f"{byte:08b}" for byte in digest)
    size = 21
    commands = ["0 0 0 rg"]

    def is_finder(row, col, start_row, start_col):
        in_box = start_row <= row < start_row + 7 and start_col <= col < start_col + 7
        if not in_box:
            return None
        local_row = row - start_row
        local_col = col - start_col
        border = local_row in (0, 6) or local_col in (0, 6)
        center = 2 <= local_row <= 4 and 2 <= local_col <= 4
        return border or center

    for row in range(size):
        for col in range(size):
            finder = (
                is_finder(row, col, 0, 0)
                if row < 7 and col < 7
                else is_finder(row, col, 0, 14)
                if row < 7 and col >= 14
                else is_finder(row, col, 14, 0)
                if row >= 14 and col < 7
                else None
            )
            filled = finder if finder is not None else bits[(row * size + col) % len(bits)] == "1"
            if filled:
                x = origin_x + col * cell_size
                y = origin_y + (size - row - 1) * cell_size
                commands.append(f"{x} {y} {cell_size} {cell_size} re f")
    return commands


# Crea el PDF del comprobante y, si corresponde, agrega marca de agua para ventas anuladas.
def create_simple_pdf(path, lines, watermark=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    page_width = 300
    top_margin = 24
    bottom_margin = 18
    line_height = 10
    qr_cell_size = 3
    qr_size = 21 * qr_cell_size
    qr_gap = 14
    qr_label_index = lines.index("QR DE VERIFICACION") if "QR DE VERIFICACION" in lines else len(lines) - 1
    page_height = top_margin + (qr_label_index * line_height) + qr_gap + qr_size + bottom_margin
    first_line_y = page_height - top_margin
    qr_label_y = first_line_y - (qr_label_index * line_height)
    qr_origin_y = qr_label_y - qr_gap - qr_size
    qr_origin_x = (page_width - qr_size) / 2

    stream_lines = []
    if watermark:
        watermark_text = str(watermark).upper()
        watermark_y = max(page_height / 2 - 70, 70)
        stream_lines.extend(
            [
                "q",
                "0.86 0.86 0.86 rg",
                "BT",
                "/F1 46 Tf",
                f"0.707 0.707 -0.707 0.707 46 {watermark_y:.2f} Tm",
                f"({escape_pdf_text(watermark_text)}) Tj",
                "ET",
                "Q",
            ]
        )

    stream_lines.extend(["BT", "/F1 8.5 Tf", f"18 {first_line_y} Td", f"{line_height} TL"])
    for line in lines:
        stream_lines.append(f"({escape_pdf_text(line)}) Tj")
        stream_lines.append("T*")
    stream_lines.append("ET")
    stream_lines.extend(
        create_qr_commands(
            "|".join(lines),
            origin_x=qr_origin_x,
            origin_y=qr_origin_y,
            cell_size=qr_cell_size,
        )
    )
    stream = "\n".join(stream_lines).encode("latin-1", errors="replace")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
            "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ).encode("ascii"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        b"<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = []
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")
    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode("ascii")
    )

    with open(path, "wb") as pdf_file:
        pdf_file.write(pdf)


# Recupera una venta completa con su detalle, pagos y factura.
def fetch_sale(conn, venta_id):
    venta = conn.execute("SELECT * FROM ventas WHERE id = ?", (venta_id,)).fetchone()
    if not venta:
        return None

    detalle = conn.execute(
        "SELECT * FROM detalle_ventas WHERE venta_id = ? ORDER BY id",
        (venta_id,),
    ).fetchall()
    pagos = conn.execute(
        "SELECT * FROM pagos_ventas WHERE venta_id = ? ORDER BY id",
        (venta_id,),
    ).fetchall()
    factura = conn.execute(
        "SELECT * FROM facturas WHERE venta_id = ?",
        (venta_id,),
    ).fetchone()

    venta_data = row_to_dict(venta)
    venta_data["detalle"] = [row_to_dict(row) for row in detalle]
    venta_data["pagos"] = [row_to_dict(row) for row in pagos]
    venta_data["factura"] = row_to_dict(factura)
    return venta_data


# Regenera el comprobante desde la informacion guardada, util cuando una venta fue anulada.
def regenerate_comprobante_pdf(venta):
    factura = venta.get("factura") or {}
    if not factura.get("numero_factura"):
        return None

    pagos = venta.get("pagos") or []
    pago = pagos[0] if pagos else {
        "metodo_pago": "S/N",
        "monto_centavos": venta.get("total_centavos", 0),
        "referencia": None,
    }
    cliente = {
        "nombre": factura.get("cliente_nombre") or "CONSUMIDOR FINAL",
        "nit_ci": factura.get("cliente_nit_ci") or "S/N",
        "correo": factura.get("cliente_correo") or "S/N",
    }
    pdf_path = factura.get("archivo_pdf") or os.path.join(
        COMPROBANTES_DIR,
        f"{factura['numero_factura']}.pdf",
    )
    watermark = "ANULADA" if venta.get("estado") == "anulada" else None
    create_simple_pdf(
        pdf_path,
        build_comprobante_lines(venta, venta.get("detalle") or [], pago, factura, cliente),
        watermark=watermark,
    )
    return pdf_path


# Solicita al microservicio de Inventario descontar stock por cada producto vendido.
def publish_inventory_discounts(items, venta_uid, sucursal_uid):
    warnings = []
    for item in items:
        payload = {
            "producto_id": item["producto_id"],
            "producto_uid": item["producto_uid"],
            "cantidad": item["cantidad"],
            "sucursal_uid": sucursal_uid,
            "origen": "ventas_service",
            "venta_uid": venta_uid,
        }
        try:
            response = requests.post(INVENTARIO_BAJA_URL, json=payload, timeout=3)
            if response.status_code >= 400:
                warnings.append(
                    f"Inventario respondio {response.status_code} para producto {item['producto_uid']}."
                )
        except requests.RequestException as exc:
            warnings.append(f"No se pudo descontar inventario de {item['producto_uid']}: {exc}")
    return warnings


# Publica a Notificaciones el evento de venta confirmada.
def publish_sale_event(venta, factura):
    factura = factura or {}
    evento = {
        "evento": "VENTA_CONFIRMADA",
        "origen": "ventas_service",
        "payload": {
            "venta_uid": venta.get("uid"),
            "cliente_uid": venta.get("cliente_uid"),
            "sucursal_uid": venta.get("sucursal_uid"),
            "empleado_uid": venta.get("empleado_uid"),
            "total_centavos": venta["total_centavos"],
            "estado": venta["estado"],
            "numero_factura": factura.get("numero_factura"),
            "cliente": factura.get("cliente_nombre") or "CONSUMIDOR FINAL",
            "fecha": venta.get("creado_en"),
        },
    }
    try:
        response = requests.post(NOTIFICACIONES_EVENTO_URL, json=evento, timeout=3)
        if response.status_code >= 400:
            return f"Notificaciones respondio {response.status_code}."
    except requests.RequestException as exc:
        return f"No se pudo publicar el evento de venta: {exc}"
    return None


# Publica a Notificaciones el evento de venta anulada.
def publish_sale_cancelled_event(venta):
    factura = venta.get("factura") or {}
    evento = {
        "evento": "VENTA_ANULADA",
        "origen": "ventas_service",
        "payload": {
            "venta_uid": venta.get("uid"),
            "cliente_uid": venta.get("cliente_uid"),
            "sucursal_uid": venta.get("sucursal_uid"),
            "empleado_uid": venta.get("empleado_uid"),
            "total_centavos": venta["total_centavos"],
            "estado": venta["estado"],
            "numero_factura": factura.get("numero_factura"),
            "cliente": factura.get("cliente_nombre") or "CONSUMIDOR FINAL",
            "fecha": venta.get("actualizado_en") or venta.get("creado_en"),
        },
    }
    try:
        response = requests.post(NOTIFICACIONES_EVENTO_URL, json=evento, timeout=3)
        if response.status_code >= 400:
            return f"Notificaciones respondio {response.status_code}."
    except requests.RequestException as exc:
        return f"No se pudo publicar el evento de anulacion: {exc}"
    return None


# Arma las lineas de texto que se imprimen en el comprobante PDF.
def build_comprobante_lines(venta, detalle, pago, factura, cliente):
    width = 42

    def center(text):
        return str(text)[:width].center(width)

    def line(char="-"):
        return char * width

    def field(label, value):
        return f"{label:<18}: {str(value or 'S/N')[:22]}"

    cliente_nombre = cliente.get("nombre") or "CONSUMIDOR FINAL"
    cliente_documento = cliente.get("nit_ci") or "S/N"
    cliente_correo = cliente.get("correo") or "S/N"
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    lines = [
        line("="),
        center("ABUELITA SERAFINA"),
        center("SUPERMARKET BOLIVIA S.A."),
        center("COMPROBANTE DE PAGO"),
        line("="),
        field("NRO.", factura["numero_factura"]),
        field("VENTA", venta["uid"]),
        field("SUCURSAL", venta.get("sucursal_uid")),
        field("CAJERO", venta.get("empleado_uid")),
        field("FECHA", fecha),
        line("-"),
        field("CLIENTE", cliente_nombre),
        field("DOCUMENTO", cliente_documento),
        field("CORREO", cliente_correo),
        line("-"),
        "DETALLE",
        line("-"),
        f"{'CODIGO':<12}{'CANT':>5}{'P.UNIT':>11}{'SUBT':>12}",
        line("-"),
    ]
    for item in detalle:
        lines.append(
            f"{item['producto_uid'][:12]:<12}"
            f"{item['cantidad']:>5}"
            f"{format_money(item['precio_unitario_centavos']):>11}"
            f"{format_money(item['subtotal_centavos']):>12}"
        )

    lines.extend(
        [
            line("-"),
            f"{'SUBTOTAL (BS)':<28}{format_money(venta['subtotal_centavos']):>14}",
            f"{'DESCUENTO (BS)':<28}{format_money(venta['descuento_centavos']):>14}",
            f"{'TOTAL A PAGAR (BS)':<28}{format_money(venta['total_centavos']):>14}",
            f"{'MONTO PAGADO (BS)':<28}{format_money(pago['monto_centavos']):>14}",
            f"{'SALDO (BS)':<28}{'0.00':>14}",
            line("-"),
            field("METODO PAGO", str(pago["metodo_pago"]).upper()),
            field("REFERENCIA", pago.get("referencia")),
            "",
            "DOCUMENTO GENERADO POR ERP SUPERMERCADO.",
            "CONSERVE ESTE COMPROBANTE PARA CONSULTAS.",
            "",
            "QR DE VERIFICACION",
            line("="),
        ]
    )
    return lines


# Endpoint de salud para verificar que el microservicio esta levantado.
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "success", "message": f"{SERVICE_NAME} OK en puerto {SERVICE_PORT}"}), 200


# Reporte de ventas por dia o por mes, agrupado por metodo de pago y productos vendidos.
@app.route("/api/ventas/reportes", methods=["GET"])
def reporte_ventas():
    try:
        tipo = request.args.get("tipo", "dia")
        if tipo not in ("dia", "mes"):
            return jsonify({"status": "error", "message": "El tipo debe ser 'dia' o 'mes'."}), 400

        if tipo == "mes":
            periodo = request.args.get("mes") or datetime.now().strftime("%Y-%m")
            if not re.fullmatch(r"\d{4}-\d{2}", periodo):
                return jsonify({"status": "error", "message": "El mes debe tener formato YYYY-MM."}), 400
            date_filter = "strftime('%Y-%m', v.creado_en) = ?"
        else:
            periodo = request.args.get("fecha") or datetime.now().strftime("%Y-%m-%d")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", periodo):
                return jsonify({"status": "error", "message": "La fecha debe tener formato YYYY-MM-DD."}), 400
            date_filter = "date(v.creado_en) = ?"

        conn = get_db_connection()
        resumen = conn.execute(
            f"""
            SELECT
                COUNT(*) AS cantidad_ventas,
                COALESCE(SUM(total_centavos), 0) AS total_centavos
            FROM ventas v
            WHERE v.estado = 'confirmada' AND {date_filter}
            """,
            (periodo,),
        ).fetchone()
        pagos = conn.execute(
            f"""
            SELECT
                p.metodo_pago,
                COUNT(DISTINCT v.id) AS cantidad_ventas,
                COALESCE(SUM(p.monto_centavos), 0) AS total_centavos
            FROM ventas v
            INNER JOIN pagos_ventas p ON p.venta_id = v.id
            WHERE v.estado = 'confirmada' AND {date_filter}
            GROUP BY p.metodo_pago
            ORDER BY p.metodo_pago
            """,
            (periodo,),
        ).fetchall()
        productos = conn.execute(
            f"""
            SELECT
                p.metodo_pago,
                d.producto_id,
                d.producto_uid,
                d.precio_unitario_centavos,
                COALESCE(SUM(d.cantidad), 0) AS cantidad,
                COALESCE(SUM(d.subtotal_centavos), 0) AS subtotal_centavos
            FROM ventas v
            INNER JOIN pagos_ventas p ON p.venta_id = v.id
            INNER JOIN detalle_ventas d ON d.venta_id = v.id
            WHERE v.estado = 'confirmada' AND {date_filter}
            GROUP BY p.metodo_pago, d.producto_id, d.producto_uid, d.precio_unitario_centavos
            ORDER BY p.metodo_pago, d.producto_uid
            """,
            (periodo,),
        ).fetchall()
        conn.close()

        detalle_por_metodo = {}
        nombres_productos = {}
        for row in productos:
            producto_id = row["producto_id"]
            if producto_id not in nombres_productos:
                nombres_productos[producto_id] = fetch_producto_nombre(producto_id)
            producto = row_to_dict(row)
            producto["producto_nombre"] = nombres_productos.get(producto_id) or producto["producto_uid"]
            metodo = row["metodo_pago"]
            detalle_por_metodo.setdefault(metodo, []).append(producto)

        return jsonify({
            "status": "success",
            "data": {
                "tipo": tipo,
                "periodo": periodo,
                "cantidad_ventas": resumen["cantidad_ventas"],
                "total_centavos": resumen["total_centavos"],
                "metodos_pago": [
                    {
                        **row_to_dict(row),
                        "productos": detalle_por_metodo.get(row["metodo_pago"], []),
                    }
                    for row in pagos
                ],
            },
        }), 200
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


# Lista ventas registradas para mostrarlas en la tabla principal del frontend.
@app.route("/api/ventas", methods=["GET"])
def listar_ventas():
    try:
        conn = get_db_connection()
        ventas = conn.execute(
            """
            SELECT v.*, f.numero_factura, f.archivo_pdf
            FROM ventas v
            LEFT JOIN facturas f ON f.venta_id = v.id
            ORDER BY v.creado_en DESC, v.id DESC
            """
        ).fetchall()
        conn.close()
        return jsonify({"status": "success", "data": [row_to_dict(row) for row in ventas]}), 200
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


# Obtiene una venta puntual con detalle, pagos y factura para ver el detalle.
@app.route("/api/ventas/<int:venta_id>", methods=["GET"])
def obtener_venta(venta_id):
    try:
        conn = get_db_connection()
        venta = fetch_sale(conn, venta_id)
        conn.close()
        if not venta:
            return jsonify({"status": "error", "message": "Venta no encontrada."}), 404
        return jsonify({"status": "success", "data": venta}), 200
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


# Anula una venta sin borrarla fisicamente y publica los eventos/reversiones necesarias.
@app.route("/api/ventas/<int:venta_id>", methods=["DELETE"])
def anular_venta(venta_id):
    conn = None
    try:
        conn = get_db_connection()
        venta_actual = conn.execute("SELECT * FROM ventas WHERE id = ?", (venta_id,)).fetchone()
        if not venta_actual:
            conn.close()
            return jsonify({"status": "error", "message": "Venta no encontrada."}), 404

        if venta_actual["estado"] == "anulada":
            venta = fetch_sale(conn, venta_id)
            conn.close()
            return jsonify({"status": "warning", "message": "La venta ya estaba anulada.", "data": venta}), 200

        conn.execute("BEGIN")
        conn.execute(
            "UPDATE ventas SET estado = 'anulada', actualizado_en = CURRENT_TIMESTAMP WHERE id = ?",
            (venta_id,),
        )
        conn.execute(
            "UPDATE facturas SET estado = 'anulada', actualizado_en = CURRENT_TIMESTAMP WHERE venta_id = ?",
            (venta_id,),
        )
        conn.commit()

        venta = fetch_sale(conn, venta_id)
        conn.close()
        conn = None
        regenerate_comprobante_pdf(venta)

        warnings = []
        if venta.get("cliente_uid"):
            puntos_a_revertir = get_points_earned(venta.get("total_centavos"))
            fidelizacion_warning = publish_customer_loyalty_update(
                venta.get("cliente_id"),
                venta.get("cliente_uid"),
                venta.get("uid"),
                venta.get("total_centavos"),
                -puntos_a_revertir,
                contador_compras_incremento=-1,
                motivo="VENTA_ANULADA",
            )
            if fidelizacion_warning:
                warnings.append(fidelizacion_warning)

        event_warning = publish_sale_cancelled_event(venta)
        if event_warning:
            warnings.append(event_warning)

        return jsonify({
            "status": "success" if not warnings else "warning",
            "message": "Venta anulada correctamente.",
            "data": venta,
            "fidelizacion": {
                "cliente_uid": venta.get("cliente_uid"),
                "contador_compras_incremento": -1 if venta.get("cliente_uid") else 0,
                "puntos_revertidos": get_points_earned(venta.get("total_centavos")) if venta.get("cliente_uid") else 0,
            },
            "advertencias": warnings,
        }), 200
    except Exception as exc:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"status": "error", "message": str(exc)}), 500


# Registra una venta completa: cabecera, detalle, pago, factura, PDF, inventario, fidelizacion y evento.
@app.route("/api/ventas", methods=["POST"])
def registrar_venta():
    conn = None
    try:
        data = request.get_json(silent=True) or {}
        validate_no_html(data)

        sucursal_id = get_required_int(data, "sucursal_id")
        sucursal_uid = get_required_text(data, "sucursal_uid")
        tipo_venta = data.get("tipo_venta", "contado")
        if tipo_venta not in ("contado", "credito"):
            raise ValueError("El campo 'tipo_venta' debe ser 'contado' o 'credito'.")

        items = data.get("productos") or data.get("detalle") or []
        if not isinstance(items, list) or not items:
            raise ValueError("Debe enviar al menos un producto en 'productos'.")

        detalle = []
        subtotal_centavos = 0
        for item in items:
            producto_id = get_required_int(item, "producto_id")
            producto_uid = get_required_text(item, "producto_uid")
            cantidad = get_required_int(item, "cantidad")
            precio_unitario = amount_from_payload(item, "precio_unitario_centavos", "precio_unitario")
            item_subtotal = cantidad * precio_unitario
            subtotal_centavos += item_subtotal
            detalle.append(
                {
                    "producto_id": producto_id,
                    "producto_uid": producto_uid,
                    "cantidad": cantidad,
                    "precio_unitario_centavos": precio_unitario,
                    "subtotal_centavos": item_subtotal,
                }
            )

        cliente = data.get("cliente") or {}
        cliente_id = data.get("cliente_id") or cliente.get("id")
        cliente_uid = data.get("cliente_uid") or cliente.get("uid")
        if cliente_uid is not None and str(cliente_uid).strip() == "":
            cliente_uid = None
        if cliente_uid and has_html_or_script(cliente_uid):
            raise ValueError("El cliente seleccionado contiene texto no permitido.")
        if cliente_uid:
            cliente_uid = str(cliente_uid).strip()

        fidelizacion = data.get("fidelizacion") or {}
        usar_descuento_puntos = bool(fidelizacion.get("usar_descuento"))
        porcentaje_descuento_puntos = int(fidelizacion.get("porcentaje_descuento") or 0)
        puntos_actuales = int(cliente.get("puntos") or 0)
        fidelizacion_warning = None

        if cliente_uid:
            cliente_fidelizacion, fidelizacion_warning = fetch_cliente_fidelizacion(cliente_uid)
            if cliente_fidelizacion:
                puntos_actuales = int(cliente_fidelizacion.get("puntos") or puntos_actuales)
                cliente = {**cliente, **cliente_fidelizacion}
                cliente_id = cliente_id or cliente_fidelizacion.get("id")

        descuento_manual_centavos = amount_from_payload(data, "descuento_centavos", "descuento", default=0)
        descuento_puntos_centavos = 0

        if usar_descuento_puntos:
            if not cliente_uid:
                raise ValueError("Solo un cliente registrado puede usar descuento con puntos.")
            if porcentaje_descuento_puntos not in (10, 20, 30):
                raise ValueError("El descuento con puntos debe ser 10, 20 o 30 por ciento.")

            porcentaje_permitido = get_allowed_points_discount_percent(puntos_actuales)
            if porcentaje_permitido < 10:
                raise ValueError("El cliente necesita al menos 100 puntos para usar descuento.")
            if porcentaje_descuento_puntos > porcentaje_permitido:
                raise ValueError(
                    f"El cliente solo puede usar hasta {porcentaje_permitido}% de descuento con sus puntos actuales."
                )

            descuento_puntos_centavos = (subtotal_centavos * porcentaje_descuento_puntos) // 100

        descuento_centavos = descuento_manual_centavos + descuento_puntos_centavos
        if descuento_centavos > subtotal_centavos:
            raise ValueError("El descuento no puede ser mayor al subtotal.")
        total_centavos = subtotal_centavos - descuento_centavos
        if total_centavos <= 0:
            raise ValueError("El total de la venta debe ser mayor a cero.")

        pago = data.get("pago") or {}
        metodo_pago = get_required_text(pago, "metodo_pago")
        if metodo_pago not in ("efectivo", "tarjeta", "qr", "transferencia"):
            raise ValueError("Metodo de pago no valido.")
        monto_pago = amount_from_payload(pago, "monto_centavos", "monto", default=total_centavos)
        if tipo_venta == "contado" and monto_pago != total_centavos:
            raise ValueError("Para ventas al contado, el monto pagado debe ser igual al total.")
        referencia_pago = pago.get("referencia")

        empleado_id = data.get("empleado_id")
        empleado_uid = data.get("empleado_uid")

        venta_uid = build_uid("VEN")
        pago_uid = build_uid("PAG")
        factura_uid = build_uid("FAC")
        puntos_ganados = get_points_earned(total_centavos) if cliente_uid else 0

        conn = get_db_connection()
        conn.execute("BEGIN")

        cursor = conn.execute(
            """
            INSERT INTO ventas (
                uid, sucursal_id, sucursal_uid, cliente_id, cliente_uid,
                empleado_id, empleado_uid, tipo_venta, subtotal_centavos,
                descuento_centavos, total_centavos, estado
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada')
            """,
            (
                venta_uid,
                sucursal_id,
                sucursal_uid,
                cliente_id,
                cliente_uid,
                empleado_id,
                empleado_uid,
                tipo_venta,
                subtotal_centavos,
                descuento_centavos,
                total_centavos,
            ),
        )
        venta_id = cursor.lastrowid

        for item in detalle:
            conn.execute(
                """
                INSERT INTO detalle_ventas (
                    venta_id, venta_uid, producto_id, producto_uid, cantidad,
                    precio_unitario_centavos, subtotal_centavos
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    venta_id,
                    venta_uid,
                    item["producto_id"],
                    item["producto_uid"],
                    item["cantidad"],
                    item["precio_unitario_centavos"],
                    item["subtotal_centavos"],
                ),
            )

        conn.execute(
            """
            INSERT INTO pagos_ventas (
                uid, venta_id, venta_uid, metodo_pago, monto_centavos, referencia
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (pago_uid, venta_id, venta_uid, metodo_pago, monto_pago, referencia_pago),
        )

        numero_factura = f"FAC-{datetime.now().strftime('%Y%m%d')}-{venta_id:06d}"
        conn.execute(
            """
            INSERT INTO facturas (
                uid, venta_id, venta_uid, numero_factura, cliente_id, cliente_uid,
                cliente_nombre, cliente_nit_ci, cliente_correo, monto_total_centavos
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                factura_uid,
                venta_id,
                venta_uid,
                numero_factura,
                cliente_id,
                cliente_uid,
                cliente.get("nombre"),
                cliente.get("nit_ci"),
                cliente.get("correo"),
                total_centavos,
            ),
        )

        pdf_filename = f"{numero_factura}.pdf"
        pdf_path = os.path.join(COMPROBANTES_DIR, pdf_filename)
        venta_pdf = {
            "uid": venta_uid,
            "sucursal_uid": sucursal_uid,
            "empleado_uid": empleado_uid,
            "subtotal_centavos": subtotal_centavos,
            "descuento_centavos": descuento_centavos,
            "total_centavos": total_centavos,
        }
        pago_pdf = {
            "metodo_pago": metodo_pago,
            "monto_centavos": monto_pago,
            "referencia": referencia_pago,
        }
        factura_pdf = {"numero_factura": numero_factura}
        create_simple_pdf(pdf_path, build_comprobante_lines(venta_pdf, detalle, pago_pdf, factura_pdf, cliente))

        conn.execute(
            "UPDATE facturas SET archivo_pdf = ?, actualizado_en = CURRENT_TIMESTAMP WHERE venta_id = ?",
            (pdf_path, venta_id),
        )
        conn.commit()

        venta = fetch_sale(conn, venta_id)
        conn.close()
        conn = None

        warnings = publish_inventory_discounts(detalle, venta_uid, sucursal_uid)
        if fidelizacion_warning:
            warnings.append(fidelizacion_warning)
        fidelizacion_update_warning = publish_customer_loyalty_update(
            cliente_id,
            cliente_uid,
            venta_uid,
            total_centavos,
            puntos_ganados,
        )
        if fidelizacion_update_warning:
            warnings.append(fidelizacion_update_warning)
        event_warning = publish_sale_event(venta, venta.get("factura"))
        if event_warning:
            warnings.append(event_warning)

        response_status = "success" if not warnings else "warning"
        return (
            jsonify(
                {
                    "status": response_status,
                    "message": "Venta registrada correctamente.",
                    "data": venta,
                    "fidelizacion": {
                        "cliente_uid": cliente_uid,
                        "puntos_antes": puntos_actuales if cliente_uid else 0,
                        "puntos_ganados": puntos_ganados,
                        "descuento_porcentaje": porcentaje_descuento_puntos if usar_descuento_puntos else 0,
                        "descuento_centavos": descuento_puntos_centavos,
                    },
                    "advertencias": warnings,
                }
            ),
            201,
        )
    except ValueError as exc:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"status": "error", "message": str(exc)}), 400
    except sqlite3.IntegrityError as exc:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"status": "error", "message": f"Error de integridad: {exc}"}), 400
    except Exception as exc:
        if conn:
            conn.rollback()
            conn.close()
        return jsonify({"status": "error", "message": str(exc)}), 500


# Descarga el comprobante PDF de una venta; si esta anulada, lo regenera con marca de agua.
@app.route("/api/ventas/<int:venta_id>/comprobante", methods=["GET"])
def descargar_comprobante(venta_id):
    try:
        conn = get_db_connection()
        venta = fetch_sale(conn, venta_id)
        conn.close()

        if not venta:
            return jsonify({"status": "error", "message": "Venta no encontrada."}), 404

        factura = venta.get("factura") or {}
        if venta.get("estado") == "anulada":
            archivo_pdf = regenerate_comprobante_pdf(venta)
            factura["archivo_pdf"] = archivo_pdf

        if not factura or not factura["archivo_pdf"]:
            return jsonify({"status": "error", "message": "Comprobante no encontrado."}), 404
        if not os.path.exists(factura["archivo_pdf"]):
            return jsonify({"status": "error", "message": "El archivo PDF no existe."}), 404

        return send_file(
            factura["archivo_pdf"],
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{factura['numero_factura']}.pdf",
        )
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=SERVICE_PORT)
