from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash, make_response
from models.user import db, User, Donacion, Servicio, Ayuda, Mensaje, Actividad
import os
import uuid
import secrets
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Carga las variables definidas en el archivo .env (si existe) al entorno,
# para que os.environ.get(...) pueda encontrarlas más abajo.
load_dotenv()

app = Flask(__name__)

# Configuracion base de datos
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///aportar.db'
app.config['SECRET_KEY'] = 'clave_secreta'
db.init_app(app)

# Configuracion del correo para el envio del link de recuperacion de contraseña.
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', '')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', '')
app.config['MAIL_REMITENTE'] = os.environ.get('MAIL_REMITENTE', app.config['MAIL_USERNAME'])

# Cuánto dura el link de recuperación antes de vencer
TOKEN_VALIDEZ_MINUTOS = 30


def _enviar_email(destinatario, asunto, cuerpo, reply_to=None):
    """Envía un correo real por SMTP usando la configuración de MAIL_*.
    Si no hay credenciales cargadas, simula el envío imprimiendo en consola
    (útil para seguir probando sin un servidor de correo real)."""

    if not app.config['MAIL_USERNAME'] or not app.config['MAIL_PASSWORD']:
        print("=" * 60)
        print(f"[EMAIL SIMULADO] Para: {destinatario}")
        print(f"[EMAIL SIMULADO] Asunto: {asunto}")
        print(f"[EMAIL SIMULADO] Cuerpo:\n{cuerpo}")
        print("=" * 60)
        return True

    try:
        mensaje = EmailMessage()
        mensaje['Subject'] = asunto
        mensaje['From'] = app.config['MAIL_REMITENTE']
        mensaje['To'] = destinatario
        if reply_to:
            mensaje['Reply-To'] = reply_to
        mensaje.set_content(cuerpo)

        with smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT']) as servidor:
            servidor.starttls()
            servidor.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
            servidor.send_message(mensaje)
        return True
    except Exception as e:
        print(f"Error al enviar el email: {e}")
        return False


def _enviar_email_recuperacion(destinatario, link):
    asunto = "Recuperá tu contraseña - AportAR"
    cuerpo = (
        f"Recibimos una solicitud para restablecer tu contraseña.\n\n"
        f"Hacé clic en el siguiente enlace (válido por {TOKEN_VALIDEZ_MINUTOS} minutos):\n"
        f"{link}\n\n"
        f"Si no fuiste vos quien lo solicitó, podés ignorar este mensaje."
    )
    return _enviar_email(destinatario, asunto, cuerpo)


# Agrega las columnas del token de recuperación a bases de datos ya existentes
def _migrar_columna_reset_token():
    from sqlalchemy import text
    with app.app_context():
        columnas = [fila[1] for fila in db.session.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "reset_token" not in columnas:
            db.session.execute(text("ALTER TABLE users ADD COLUMN reset_token VARCHAR(100)"))
        if "reset_token_expira" not in columnas:
            db.session.execute(text("ALTER TABLE users ADD COLUMN reset_token_expira DATETIME"))
        db.session.commit()

@app.context_processor
def inject_asset_version():
    def asset_version(filename):
        ruta = os.path.join(app.static_folder, filename)
        try:
            return int(os.path.getmtime(ruta))
        except OSError:
            return 0
    return dict(asset_version=asset_version)

# Convierte una fecha en un texto relativo tipo "hace 2 días", para mostrar
# en la pantalla de detalle de una publicación sin exponer la hora exacta.
def tiempo_relativo(fecha):
    if not fecha:
        return ""
    segundos = (datetime.utcnow() - fecha).total_seconds()
    if segundos < 60:
        return "Publicado recién"
    minutos = int(segundos // 60)
    if minutos < 60:
        return f"Publicado hace {minutos} min"
    horas = int(minutos // 60)
    if horas < 24:
        return f"Publicado hace {horas} h"
    dias = int(horas // 24)
    if dias == 1:
        return "Publicado hace 1 día"
    if dias < 30:
        return f"Publicado hace {dias} días"
    meses = int(dias // 30)
    if meses == 1:
        return "Publicado hace 1 mes"
    return f"Publicado hace {meses} meses"

# Distritos disponibles 
DISTRITOS = ["Norte", "Noroeste", "Centro", "Oeste", "Sudoeste", "Sur"]

# Categorias disponibles por seccion
CATEGORIAS_DONACION = ["Ropa", "Calzado", "Muebles", "Electrónica", "Alimentos", "Libros", "Otros"]
CATEGORIAS_SERVICIO = ["Plomería", "Electricista", "Jardinería", "Belleza", "Limpieza", "Clases particulares", "Otros"]
CATEGORIAS_AYUDA = ["Emergencias", "Transporte", "Adultos mayores", "Mascotas", "Medicamentos", "Acompañamiento", "Otros"]

# Agrega la columna 'categoria' a bases de datos ya existentes 
def _migrar_columna_categoria():
    from sqlalchemy import text
    with app.app_context():
        for tabla in ("donaciones", "servicios", "ayuda"):
            columnas = [fila[1] for fila in db.session.execute(text(f"PRAGMA table_info({tabla})")).fetchall()]
            if "categoria" not in columnas:
                db.session.execute(text(f"ALTER TABLE {tabla} ADD COLUMN categoria VARCHAR(50)"))
        db.session.commit()

# Agrega la columna 'foto_perfil' a bases de datos ya existentes 
def _migrar_columna_foto_perfil():
    from sqlalchemy import text
    with app.app_context():
        columnas = [fila[1] for fila in db.session.execute(text("PRAGMA table_info(users)")).fetchall()]
        if "foto_perfil" not in columnas:
            db.session.execute(text("ALTER TABLE users ADD COLUMN foto_perfil VARCHAR(200)"))
        db.session.commit()

# Agrega la columna 'urgente' a la tabla de ayuda en bases de datos ya existentes
def _migrar_columna_urgente():
    from sqlalchemy import text
    with app.app_context():
        columnas = [fila[1] for fila in db.session.execute(text("PRAGMA table_info(ayuda)")).fetchall()]
        if "urgente" not in columnas:
            db.session.execute(text("ALTER TABLE ayuda ADD COLUMN urgente BOOLEAN DEFAULT 0"))
        db.session.commit()

# Hace disponible el usuario logueado 
@app.context_processor
def _inyectar_usuario_actual():
    if 'user_id' in session:
        return dict(usuario_actual=User.query.get(session['user_id']))
    return dict(usuario_actual=None)

# Carpeta donde se guardan las imagenes
UPLOAD_FOLDER = "static/uploads"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
# Crear carpeta si no existe
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Registra un evento de actividad para mostrarlo en el historial
def _registrar_actividad(user_id, categoria, titulo, evento):
    db.session.add(Actividad(
        user_id=user_id,
        categoria=categoria,
        titulo=titulo,
        evento=evento
    ))

# Guarda una imagen subida con un nombre unico
def _guardar_imagen(imagen):
    nombre_original = secure_filename(imagen.filename)
    extension = os.path.splitext(nombre_original)[1]
    filename = f"{uuid.uuid4().hex}{extension}"
    imagen.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    return filename

# Ruta inicio
@app.route('/')
@app.route('/inicio')
def inicio():
    # Renderiza inicio.html
    return render_template('inicio.html')

# GET para mostrar formulario, POST para enviar datos
@app.route('/registro', methods=['GET', 'POST'])
def registro():
    if request.method == 'POST':
        es_ajax = request.headers.get('X-Requested-With') == 'XMLHttpRequest'

        def responder_error(mensaje):
            if es_ajax:
                return jsonify(ok=False, mensaje=mensaje), 400
            return render_template('registro.html', mensaje=mensaje)

        username = request.form['username']
        password = request.form['password']
        nombre = request.form['nombre']
        apellido = request.form['apellido']
        dni = request.form['dni']
        distrito = request.form['distrito']
        email = request.form['email']
        telefono = request.form.get('telefono')

        if len(password) < 6:
            return responder_error("La contraseña debe tener al menos 6 caracteres")

        if User.query.filter_by(username=username).first():
            return responder_error("Usuario existente")
        elif User.query.filter_by(email=email).first():
            return responder_error("Ese email ya está registrado")
        elif User.query.filter_by(dni=dni).first():
            return responder_error("Ese DNI ya está registrado")
        elif telefono and User.query.filter_by(telefono=telefono).first():
            return responder_error("Ese número de celular ya está registrado")

        nuevo_usuario = User(
            username=username,
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            distrito=distrito,
            email=email,
            telefono=telefono
        )
        nuevo_usuario.set_password(password)  # encriptar contraseña

        db.session.add(nuevo_usuario)
        db.session.commit()

        if es_ajax:
            return jsonify(ok=True, redirect=url_for('login'))

        flash("Registro exitoso, ahora podés iniciar sesión", "success")
        return redirect(url_for('login'))

    respuesta = make_response(render_template('registro.html'))
    # Evita que el navegador guarde en cache el formulario con los datos ingresados,
    respuesta.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    respuesta.headers['Pragma'] = 'no-cache'
    return respuesta

# Login 
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        user = User.query.filter_by(username=username).first()

        if user and user.check_password(password):
            session['user_id'] = user.id
            session['username'] = user.username
            return redirect(url_for('dashboard'))
        else:
            return render_template('login.html', error="Credenciales inválidas")

    respuesta = make_response(render_template('login.html'))
    respuesta.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    respuesta.headers['Pragma'] = 'no-cache'
    return respuesta

# Paso 1: el usuario ingresa su email y se le envía el link de recuperación
@app.route('/olvide-contrasena', methods=['GET', 'POST'])
def olvide_contrasena():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        usuario = User.query.filter_by(email=email).first()

        # Por seguridad, se muestra siempre el mismo mensaje exista o no el email,
        # para no revelar qué correos están registrados en el sitio.
        if usuario:
            token = secrets.token_urlsafe(32)
            usuario.reset_token = token
            usuario.reset_token_expira = datetime.utcnow() + timedelta(minutes=TOKEN_VALIDEZ_MINUTOS)
            db.session.commit()

            link = url_for('restablecer_contrasena', token=token, _external=True)
            _enviar_email_recuperacion(usuario.email, link)

        flash("Si el email está registrado, te enviamos un link para restablecer tu contraseña.", "success")
        return redirect(url_for('login'))

    return render_template('olvide_contrasena.html')


# Paso 2: el usuario entra desde el link del email y define una nueva contraseña
@app.route('/restablecer-contrasena/<token>', methods=['GET', 'POST'])
def restablecer_contrasena(token):
    usuario = User.query.filter_by(reset_token=token).first()

    token_valido = bool(
        usuario and usuario.reset_token_expira and usuario.reset_token_expira > datetime.utcnow()
    )

    if not token_valido:
        flash("El link de recuperación es inválido o venció. Solicitá uno nuevo.", "danger")
        return redirect(url_for('olvide_contrasena'))

    if request.method == 'POST':
        nueva = request.form.get('nueva', '')
        confirmar = request.form.get('confirmar', '')

        if len(nueva) < 6:
            return render_template('restablecer_contrasena.html', token=token, error="La contraseña debe tener al menos 6 caracteres")
        if nueva != confirmar:
            return render_template('restablecer_contrasena.html', token=token, error="Las contraseñas no coinciden")

        usuario.set_password(nueva)
        # El token se invalida para que no se pueda volver a usar el mismo link
        usuario.reset_token = None
        usuario.reset_token_expira = None
        db.session.commit()

        flash("Contraseña actualizada correctamente. Ya podés iniciar sesión.", "success")
        return redirect(url_for('login'))

    return render_template('restablecer_contrasena.html', token=token)


@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])

    # Estadisticas para el panel "Impacto de Donaciones"
    total_donaciones = Donacion.query.filter_by(concretada=False).count()
    top_categorias = (
        db.session.query(Donacion.categoria, db.func.count(Donacion.id).label("cantidad"))
        .filter(Donacion.concretada == False, Donacion.categoria.isnot(None))
        .group_by(Donacion.categoria)
        .order_by(db.func.count(Donacion.id).desc())
        .limit(3)
        .all()
    )

    # Estadisticas para el panel "Red de Oficios"
    total_profesionales = (
        db.session.query(Servicio.user_id)
        .filter(Servicio.concretada == False)
        .distinct()
        .count()
    )
    top_oficios = (
        db.session.query(Servicio.categoria, db.func.count(Servicio.id).label("cantidad"))
        .filter(Servicio.concretada == False, Servicio.categoria.isnot(None))
        .group_by(Servicio.categoria)
        .order_by(db.func.count(Servicio.id).desc())
        .limit(3)
        .all()
    )

    # Estadisticas para el panel "Centro de Ayuda"
    total_solicitudes = Ayuda.query.filter_by(concretada=False).count()
    top_distritos = (
        db.session.query(Ayuda.ubicacion, db.func.count(Ayuda.id).label("cantidad"))
        .filter(Ayuda.concretada == False)
        .group_by(Ayuda.ubicacion)
        .order_by(db.func.count(Ayuda.id).desc())
        .limit(3)
        .all()
    )

    return render_template(
        'dashboard.html',
        usuario=usuario,
        total_donaciones=total_donaciones, top_categorias=top_categorias,
        total_profesionales=total_profesionales, top_oficios=top_oficios,
        total_solicitudes=total_solicitudes, top_distritos=top_distritos
    )

# Ruta para cerrar sesion
@app.route('/logout')
def logout():
    # Limpia datos de sesion
    session.clear()
    # Redirige al inicio
    return redirect(url_for('inicio'))

# Rutas para mostrar formularios 
@app.route('/donaciones/publicar')
def publicar_donacion():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])
    return render_template('publicar.html', usuario=usuario, distritos=DISTRITOS, categorias=CATEGORIAS_DONACION)

@app.route('/donaciones/ver')
def ver_donaciones():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])

    # Estadisticas para el panel "Impacto de Donaciones"
    total_donaciones = Donacion.query.filter_by(concretada=False).count()
    top_categorias = (
        db.session.query(Donacion.categoria, db.func.count(Donacion.id).label("cantidad"))
        .filter(Donacion.concretada == False, Donacion.categoria.isnot(None))
        .group_by(Donacion.categoria)
        .order_by(db.func.count(Donacion.id).desc())
        .limit(3)
        .all()
    )

    return render_template(
        'ver.html', distritos=DISTRITOS, categorias=CATEGORIAS_DONACION,
        usuario=usuario, total_donaciones=total_donaciones, top_categorias=top_categorias
    )

@app.route('/servicios/publicar')
def publicar_servicio():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])
    return render_template('publicar_servicio.html', usuario=usuario, distritos=DISTRITOS, categorias=CATEGORIAS_SERVICIO)

@app.route('/servicios/ver')
def ver_servicios():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])

    # Estadisticas para el panel "Red de Oficios"
    total_profesionales = (
        db.session.query(Servicio.user_id)
        .filter(Servicio.concretada == False)
        .distinct()
        .count()
    )
    top_oficios = (
        db.session.query(Servicio.categoria, db.func.count(Servicio.id).label("cantidad"))
        .filter(Servicio.concretada == False, Servicio.categoria.isnot(None))
        .group_by(Servicio.categoria)
        .order_by(db.func.count(Servicio.id).desc())
        .limit(3)
        .all()
    )

    return render_template(
        'ver_servicios.html', distritos=DISTRITOS, categorias=CATEGORIAS_SERVICIO,
        usuario=usuario, total_profesionales=total_profesionales, top_oficios=top_oficios
    )

@app.route('/ayuda/solicitar')
def solicitar_ayuda():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])
    return render_template('solicitar_ayuda.html', usuario=usuario, distritos=DISTRITOS, categorias=CATEGORIAS_AYUDA)

# Pantalla de detalle completo de una publicación (donación, servicio o ayuda)
@app.route('/publicacion/<tipo>/<int:id>')
def ver_publicacion(tipo, id):
    if 'user_id' not in session:
        return redirect(url_for('login'))

    modelos = {"donacion": Donacion, "servicio": Servicio, "ayuda": Ayuda}
    modelo = modelos.get(tipo)
    if not modelo:
        return redirect(url_for('dashboard'))

    item = modelo.query.get_or_404(id)

    rutas_volver = {
        "donacion": url_for('ver_donaciones'),
        "servicio": url_for('ver_servicios'),
        "ayuda": url_for('ver_ayuda')
    }
    etiquetas = {"donacion": "Donación", "servicio": "Servicio", "ayuda": "Ayuda"}

    # Cantidad total de publicaciones activas de este usuario
    total_publicaciones_usuario = (
        Donacion.query.filter_by(user_id=item.user_id).count()
        + Servicio.query.filter_by(user_id=item.user_id).count()
        + Ayuda.query.filter_by(user_id=item.user_id).count()
    )

    return render_template(
        'detalle_publicacion.html',
        item=item,
        tipo=tipo,
        etiqueta_tipo=etiquetas[tipo],
        es_mia=item.user_id == session['user_id'],
        volver_url=rutas_volver[tipo],
        fecha_relativa=tiempo_relativo(item.fecha_creacion),
        total_publicaciones_usuario=total_publicaciones_usuario
    )

@app.route('/ayuda/ver')
def ver_ayuda():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])

    # Estadisticas para el panel "Centro de Ayuda"
    total_solicitudes = Ayuda.query.filter_by(concretada=False).count()
    top_distritos = (
        db.session.query(Ayuda.ubicacion, db.func.count(Ayuda.id).label("cantidad"))
        .filter(Ayuda.concretada == False)
        .group_by(Ayuda.ubicacion)
        .order_by(db.func.count(Ayuda.id).desc())
        .limit(3)
        .all()
    )

    return render_template(
        'ver_ayuda.html', distritos=DISTRITOS, categorias=CATEGORIAS_AYUDA,
        usuario=usuario, total_solicitudes=total_solicitudes, top_distritos=top_distritos
    )

@app.route('/busqueda')
def busqueda():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('busqueda_avanzada.html', active_section='busqueda', distritos=DISTRITOS, usuario=User.query.get(session['user_id']))

@app.route('/perfil')
def perfil():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    usuario = User.query.get(session['user_id'])
    return render_template('Mi_perfil.html', active_section='perfil', usuario=usuario)

# Obtener todas las donaciones
@app.route("/api/donaciones", methods=["GET"])
def obtener_donaciones():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    donaciones = Donacion.query.filter_by(concretada=False).all()

    return jsonify([
        {
            "id": d.id,
            "titulo": d.titulo,
            "descripcion": d.descripcion,
            "ubicacion": d.ubicacion,
            "categoria": d.categoria,
            "imagen": d.imagen,
            "fecha_creacion": d.fecha_creacion.isoformat(),
            "usuario": d.usuario.username,
            "user_id": d.user_id,
            "es_mia": d.user_id == session["user_id"]
        }
        for d in donaciones
    ])

@app.route("/api/donaciones", methods=["POST"])
def crear_donacion():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    titulo = request.form["titulo"]
    descripcion = request.form["descripcion"]
    ubicacion = request.form["ubicacion"]
    categoria = request.form.get("categoria")
    imagen = request.files.get("imagen")
    user_id = session['user_id']

    filename = None
    if imagen and imagen.filename:
        filename = _guardar_imagen(imagen)

    nueva_donacion = Donacion(
        titulo=titulo,
        descripcion=descripcion,
        ubicacion=ubicacion,
        categoria=categoria,
        imagen=filename,
        user_id=user_id
    )

    db.session.add(nueva_donacion)
    _registrar_actividad(user_id, "donacion", titulo, "publicada")
    db.session.commit()

    return jsonify({"mensaje": "Donación publicada con éxito"})

@app.route("/donaciones/eliminar/<int:id>", methods=["POST"])
def eliminar_donacion(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    don = Donacion.query.get_or_404(id)
    if don.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para eliminar esta donación"}), 403

    # Elimina imagen si existe
    if don.imagen:
        path_imagen = os.path.join(app.config["UPLOAD_FOLDER"], don.imagen)
        if os.path.exists(path_imagen):
            os.remove(path_imagen)

    _registrar_actividad(session['user_id'], "donacion", don.titulo, "eliminada")
    db.session.delete(don)
    db.session.commit()
    return jsonify({"mensaje": "Donación eliminada con éxito"})

@app.route("/donaciones/editar/<int:id>", methods=["POST"])
def editar_donacion(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    don = Donacion.query.get_or_404(id)
    if don.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para editar esta donación"}), 403

    don.titulo = request.form["titulo"]
    don.descripcion = request.form["descripcion"]
    don.ubicacion = request.form["ubicacion"]
    don.categoria = request.form.get("categoria")

    imagen = request.files.get("imagen")
    if imagen and imagen.filename:
        # Elimina imagen anterior si había
        if don.imagen:
            path_anterior = os.path.join(app.config["UPLOAD_FOLDER"], don.imagen)
            if os.path.exists(path_anterior):
                os.remove(path_anterior)

        filename = _guardar_imagen(imagen)
        don.imagen = filename

    _registrar_actividad(session['user_id'], "donacion", don.titulo, "editada")
    db.session.commit()
    return jsonify({"mensaje": "Donación actualizada con éxito"})

# Obtener servicios del usuario 
@app.route("/api/servicios", methods=["GET"])
def obtener_servicios():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    servicios = Servicio.query.filter_by(concretada=False).all()

    return jsonify([
        {
            "id": s.id,
            "titulo": s.titulo,
            "descripcion": s.descripcion,
            "ubicacion": s.ubicacion,
            "categoria": s.categoria,
            "contacto": s.contacto,
            "imagen": s.imagen,
            "fecha_creacion": s.fecha_creacion.isoformat(),
            "usuario": s.usuario.username,
            "user_id": s.user_id,
            "es_mia": s.user_id == session["user_id"]
        }
        for s in servicios
    ])

# Crear servicio nuevo
@app.route("/api/servicios", methods=["POST"])
def crear_servicio():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    user_id = session['user_id']
    usuario = User.query.get(user_id)

    titulo = request.form["titulo"]
    descripcion = request.form["descripcion"]
    ubicacion = request.form["ubicacion"]
    categoria = request.form.get("categoria")
    contacto = usuario.telefono or ""
    imagen = request.files.get("imagen")

    filename = None
    if imagen and imagen.filename:
        filename = _guardar_imagen(imagen)

    nuevo_servicio = Servicio(
        titulo=titulo,
        descripcion=descripcion,
        ubicacion=ubicacion,
        categoria=categoria,
        contacto=contacto,
        imagen=filename,
        user_id=user_id
    )
    db.session.add(nuevo_servicio)
    _registrar_actividad(user_id, "servicio", titulo, "publicada")
    db.session.commit()

    return jsonify({"mensaje": "Servicio publicado con éxito"})

# ayudas solicitadas por usuario 
@app.route("/api/ayuda", methods=["GET"])
def obtener_ayuda():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    # Prioridad: urgentes primero, y dentro de cada grupo, las más recientes primero
    ayudas = Ayuda.query.filter_by(concretada=False) \
        .order_by(Ayuda.urgente.desc(), Ayuda.fecha_creacion.desc()).all()

    return jsonify([
        {
            "id": a.id,
            "titulo": a.titulo,
            "descripcion": a.descripcion,
            "ubicacion": a.ubicacion,
            "categoria": a.categoria,
            "contacto": a.contacto,
            "imagen": a.imagen,
            "fecha_creacion": a.fecha_creacion.isoformat(),
            "usuario": a.usuario.username,
            "user_id": a.user_id,
            "urgente": bool(a.urgente),
            "es_mia": a.user_id == session["user_id"]
        }
        for a in ayudas
    ])

# Crear solicitud de ayuda nueva
@app.route("/api/ayuda", methods=["POST"])
def crear_ayuda():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    user_id = session['user_id']
    usuario = User.query.get(user_id)

    titulo = request.form["titulo"]
    descripcion = request.form["descripcion"]
    ubicacion = request.form["ubicacion"]
    categoria = request.form.get("categoria")
    contacto = usuario.telefono or ""
    imagen = request.files.get("imagen")
    urgente = request.form.get("urgente") in ("true", "on", "1")

    filename = None
    if imagen and imagen.filename:
        filename = _guardar_imagen(imagen)

    nueva_ayuda = Ayuda(
        titulo=titulo,
        descripcion=descripcion,
        ubicacion=ubicacion,
        categoria=categoria,
        contacto=contacto,
        imagen=filename,
        user_id=user_id,
        urgente=urgente
    )
    db.session.add(nueva_ayuda)
    _registrar_actividad(user_id, "ayuda", titulo, "publicada")
    db.session.commit()

    return jsonify({"mensaje": "Solicitud de ayuda publicada con éxito"})

@app.route("/servicios/editar/<int:id>", methods=["POST"])
def editar_servicio(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    serv = Servicio.query.get_or_404(id)
    if serv.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para editar este servicio"}), 403

    serv.titulo = request.form["titulo"]
    serv.descripcion = request.form["descripcion"]
    serv.ubicacion = request.form["ubicacion"]
    serv.categoria = request.form.get("categoria")
    serv.contacto = serv.usuario.telefono or ""

    imagen = request.files.get("imagen")
    if imagen and imagen.filename:
        if serv.imagen:
            path_anterior = os.path.join(app.config["UPLOAD_FOLDER"], serv.imagen)
            if os.path.exists(path_anterior):
                os.remove(path_anterior)

        filename = _guardar_imagen(imagen)
        serv.imagen = filename

    _registrar_actividad(session['user_id'], "servicio", serv.titulo, "editada")
    db.session.commit()
    return jsonify({"mensaje": "Servicio actualizado con éxito"})

@app.route("/servicios/eliminar/<int:id>", methods=["POST"])
def eliminar_servicio(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    serv = Servicio.query.get_or_404(id)
    if serv.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para eliminar este servicio"}), 403

    if serv.imagen:
        path_imagen = os.path.join(app.config["UPLOAD_FOLDER"], serv.imagen)
        if os.path.exists(path_imagen):
            os.remove(path_imagen)

    _registrar_actividad(session['user_id'], "servicio", serv.titulo, "eliminada")
    db.session.delete(serv)
    db.session.commit()
    return jsonify({"mensaje": "Servicio eliminado con éxito"})

@app.route("/api/publicacion/<tipo>/<int:id>", methods=["GET"])
def obtener_publicacion(tipo, id):
    if 'user_id' not in session:
        return jsonify(None), 401

    if tipo == "donacion":
        item = Donacion.query.get(id)
    elif tipo == "servicio":
        item = Servicio.query.get(id)
    elif tipo == "ayuda":
        item = Ayuda.query.get(id)
    else:
        return jsonify(None)

    if not item:
        return jsonify(None)

    # Datos completos
    return jsonify({
        "id": item.id,
        "tipo": tipo,
        "titulo": item.titulo,
        "descripcion": item.descripcion,
        "ubicacion": item.ubicacion,
        "categoria": getattr(item, "categoria", None),
        "contacto": getattr(item, "contacto", None),
        "imagen": item.imagen,
        "urgente": bool(getattr(item, "urgente", False)),
        "concretada": bool(getattr(item, "concretada", False)),
        "usuario": item.usuario.username,
        "user_id": item.user_id,
        "es_mia": item.user_id == session['user_id']
    })

@app.route("/api/publicaciones", methods=["GET"])
def todas_publicaciones():
    publicaciones = []
    user_id_actual = session.get("user_id")

    # Cantidad de publicaciones activas por usuario
    conteo_por_usuario = {}
    for modelo in (Donacion, Servicio, Ayuda):
        for user_id, cantidad in (
            db.session.query(modelo.user_id, db.func.count(modelo.id))
            .group_by(modelo.user_id)
            .all()
        ):
            conteo_por_usuario[user_id] = conteo_por_usuario.get(user_id, 0) + cantidad

    # Donaciones
    for d in Donacion.query.filter_by(concretada=False).all():
        publicaciones.append({
            "id": d.id,
            "titulo": d.titulo,
            "descripcion": d.descripcion,
            "ubicacion": d.ubicacion,
            "categoria": d.categoria,
            "imagen": d.imagen,
            "fecha_creacion": d.fecha_creacion.isoformat(),
            "usuario": d.usuario.username,
            "usuario_foto": d.usuario.foto_perfil,
            "usuario_email": d.usuario.email,
            "usuario_publicaciones": conteo_por_usuario.get(d.user_id, 0),
            "user_id": d.user_id,
            "es_mia": d.user_id == user_id_actual,
            "tipo": "donacion"
        })
        
    # Servicios
    for s in Servicio.query.filter_by(concretada=False).all():
        publicaciones.append({
            "id": s.id,
            "titulo": s.titulo,
            "descripcion": s.descripcion,
            "ubicacion": s.ubicacion,
            "categoria": s.categoria,
            "imagen": s.imagen,
            "contacto": s.contacto,
            "fecha_creacion": s.fecha_creacion.isoformat(),
            "usuario": s.usuario.username,
            "usuario_foto": s.usuario.foto_perfil,
            "usuario_email": s.usuario.email,
            "usuario_publicaciones": conteo_por_usuario.get(s.user_id, 0),
            "user_id": s.user_id,
            "es_mia": s.user_id == user_id_actual,
            "tipo": "servicio"
        })

    # Ayuda
    for a in Ayuda.query.filter_by(concretada=False).all():
        publicaciones.append({
            "id": a.id,
            "titulo": a.titulo,
            "descripcion": a.descripcion,
            "ubicacion": a.ubicacion,
            "categoria": a.categoria,
            "imagen": a.imagen,
            "contacto": a.contacto,
            "fecha_creacion": a.fecha_creacion.isoformat(),
            "usuario": a.usuario.username,
            "usuario_foto": a.usuario.foto_perfil,
            "usuario_email": a.usuario.email,
            "usuario_publicaciones": conteo_por_usuario.get(a.user_id, 0),
            "user_id": a.user_id,
            "es_mia": a.user_id == user_id_actual,
            "urgente": bool(a.urgente),
            "tipo": "ayuda"
        })

    return jsonify(publicaciones)

# editar solicitudes de Ayuda
@app.route("/ayuda/editar/<int:id>", methods=["POST"])
def editar_ayuda(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    ayuda_item = Ayuda.query.get_or_404(id)
    if ayuda_item.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para editar esta solicitud de ayuda"}), 403

    ayuda_item.titulo = request.form["titulo"]
    ayuda_item.descripcion = request.form["descripcion"]
    ayuda_item.ubicacion = request.form["ubicacion"]
    ayuda_item.categoria = request.form.get("categoria")
    ayuda_item.contacto = ayuda_item.usuario.telefono or ""
    ayuda_item.urgente = request.form.get("urgente") in ("true", "on", "1")

    imagen = request.files.get("imagen")
    if imagen and imagen.filename:
        if ayuda_item.imagen:
            path_anterior = os.path.join(app.config["UPLOAD_FOLDER"], ayuda_item.imagen)
            if os.path.exists(path_anterior):
                os.remove(path_anterior)

        filename = _guardar_imagen(imagen)
        ayuda_item.imagen = filename

    _registrar_actividad(session['user_id'], "ayuda", ayuda_item.titulo, "editada")
    db.session.commit()
    return jsonify({"mensaje": "Solicitud de ayuda actualizada con éxito"})

# eliminar solicitudes de Ayuda
@app.route("/ayuda/eliminar/<int:id>", methods=["POST"])
def eliminar_ayuda(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    ayuda_item = Ayuda.query.get_or_404(id)
    if ayuda_item.user_id != session['user_id']:
        return jsonify({"error": "No tienes permiso para eliminar esta solicitud de ayuda"}), 403

    # Elimina la imagen del servidor
    if ayuda_item.imagen:
        path_imagen = os.path.join(app.config["UPLOAD_FOLDER"], ayuda_item.imagen)
        if os.path.exists(path_imagen):
            os.remove(path_imagen)

    _registrar_actividad(session['user_id'], "ayuda", ayuda_item.titulo, "eliminada")
    db.session.delete(ayuda_item)
    db.session.commit()
    return jsonify({"mensaje": "Solicitud de ayuda eliminada con éxito"})

@app.route("/api/enviar-correo", methods=["POST"])
def enviar_correo_contacto():
    if "user_id" not in session:
        return jsonify({"exito": False, "error": "Tenés que iniciar sesión."}), 401

    datos = request.get_json(silent=True) or {}
    destinatario_id = datos.get("destinatario_id")
    asunto = (datos.get("asunto") or "").strip()
    mensaje_texto = (datos.get("mensaje") or "").strip()

    if not destinatario_id or not mensaje_texto:
        return jsonify({"exito": False, "error": "Faltan datos del mensaje."}), 400

    remitente = User.query.get(session["user_id"])
    destinatario = User.query.get(destinatario_id)

    if not destinatario or not destinatario.email:
        return jsonify({"exito": False, "error": "Ese usuario no tiene un correo registrado."}), 404

    if not asunto:
        asunto = f"{remitente.username} te contactó por AportAR"

    publicacion_titulo = (datos.get("publicacion_titulo") or "").strip()
    referencia = f"\n\nSobre la publicación: {publicacion_titulo}" if publicacion_titulo else ""

    cuerpo = (
        f"{remitente.username} ({remitente.email}) te escribió a través de AportAR:{referencia}\n\n"
        f"\"{mensaje_texto}\"\n\n"
        f"Podés responderle directamente a este correo."
    )

    enviado = _enviar_email(destinatario.email, asunto, cuerpo, reply_to=remitente.email)

    if not enviado:
        return jsonify({"exito": False, "error": "No se pudo enviar el correo. Probá de nuevo en un rato."}), 500

    return jsonify({"exito": True})


@app.route("/mensaje/enviar", methods=["POST"])
def enviar_mensaje():

    if "user_id" not in session:
        return redirect(url_for("login"))

    nuevo = Mensaje(
        emisor_id=session["user_id"],
        receptor_id=request.form["receptor_id"],
        asunto=request.form["asunto"],
        mensaje=request.form["mensaje"],
        tipo=request.form.get("tipo") or "donacion",
        publicacion_id=request.form.get("publicacion_id") or None,
        publicacion_titulo=request.form.get("publicacion_titulo") or None
    )

    db.session.add(nuevo)
    db.session.commit()

    # Vuelve a la página desde donde se escribió el mensaje
    destino = request.form.get("origen") or "/donaciones/ver"
    return redirect(destino)

@app.route("/api/mensajes")
def obtener_mensajes():

    if 'user_id' not in session:
        return jsonify([])

    user_id = session["user_id"]

    # Trae los mensajes donde se participo
    mensajes = Mensaje.query.filter(
        (Mensaje.receptor_id == user_id) | (Mensaje.emisor_id == user_id)
    ).order_by(Mensaje.fecha.asc()).all()

    resultado = []
    for m in mensajes:
        es_mia = m.emisor_id == user_id
        otro_id = m.receptor_id if es_mia else m.emisor_id
        otro_usuario = User.query.get(otro_id)

        resultado.append({
            "id": m.id,
            "emisor_id": m.emisor_id,
            "receptor_id": m.receptor_id,
            "usuario": otro_usuario.username if otro_usuario else "Usuario eliminado",
            "asunto": m.asunto,
            "mensaje": m.mensaje,
            "fecha": m.fecha,
            "leido": bool(m.leido),
            "es_mia": es_mia,
            "tipo": m.tipo if m.tipo in ("donacion", "servicio", "ayuda") else "donacion",
            "publicacion_id": m.publicacion_id,
            "publicacion_titulo": m.publicacion_titulo or "Consulta general"
        })

    return jsonify(resultado)

# Marca un mensaje recibido como leído
@app.route("/api/mensajes/leer/<int:id>", methods=["POST"])
def marcar_mensaje_leido(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    msg = Mensaje.query.get_or_404(id)
    if msg.receptor_id != session['user_id']:
        return jsonify({"error": "No tenés permiso sobre este mensaje"}), 403

    msg.leido = True
    db.session.commit()
    return jsonify({"mensaje": "Marcado como leído"})

@app.route("/mensajes")
def mensajes():

    if 'user_id' not in session:
        return redirect("/login")

    return render_template("mensajes.html")


# Elimina toda la conversación con un usuario dentro de una categoría
@app.route("/mensaje/eliminar_conversacion", methods=["POST"])
def eliminar_conversacion():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    user_id = session["user_id"]
    otro_id = request.form.get("otro_id")
    tipo = request.form.get("tipo")

    if not otro_id or tipo not in ("donacion", "servicio", "ayuda"):
        return jsonify({"error": "Datos inválidos"}), 400

    otro_id = int(otro_id)

    Mensaje.query.filter(
        Mensaje.tipo == tipo,
        (
            ((Mensaje.emisor_id == user_id) & (Mensaje.receptor_id == otro_id)) |
            ((Mensaje.emisor_id == otro_id) & (Mensaje.receptor_id == user_id))
        )
    ).delete(synchronize_session=False)

    db.session.commit()
    return jsonify({"mensaje": "Chat eliminado"})


# PERFIL: informacion personal
@app.route("/perfil/actualizar", methods=["POST"])
def actualizar_perfil():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    usuario = User.query.get(session['user_id'])

    usuario.nombre = request.form["nombre"]
    usuario.apellido = request.form["apellido"]
    usuario.dni = request.form["dni"]
    usuario.distrito = request.form["distrito"]
    usuario.email = request.form["email"]
    usuario.telefono = request.form.get("telefono")

    # Foto de perfil 
    imagen = request.files.get("foto_perfil")
    if imagen and imagen.filename:
        extension = os.path.splitext(imagen.filename)[1].lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}:
            return jsonify({"error": "Formato de imagen no permitido."}), 400

        if usuario.foto_perfil:
            path_anterior = os.path.join(app.config["UPLOAD_FOLDER"], usuario.foto_perfil)
            if os.path.exists(path_anterior):
                try:
                    os.remove(path_anterior)
                except OSError:
                    pass

        usuario.foto_perfil = _guardar_imagen(imagen)

    db.session.commit()
    session['username'] = usuario.username  

    return jsonify({
        "mensaje": "Datos actualizados correctamente",
        "foto_perfil": url_for('static', filename='uploads/' + usuario.foto_perfil) if usuario.foto_perfil else None
    })


# PERFIL: contraseña y seguridad
@app.route("/perfil/cambiar_contrasena", methods=["POST"])
def cambiar_contrasena():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    usuario = User.query.get(session['user_id'])

    actual = request.form.get("actual", "")
    nueva = request.form.get("nueva", "")
    confirmar = request.form.get("confirmar", "")

    if not usuario.check_password(actual):
        return jsonify({"error": "La contraseña actual no es correcta"}), 400

    if len(nueva) < 6:
        return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres"}), 400

    if nueva != confirmar:
        return jsonify({"error": "Las contraseñas nuevas no coinciden"}), 400

    usuario.set_password(nueva)
    db.session.commit()

    return jsonify({"mensaje": "Contraseña actualizada correctamente"})


@app.route("/perfil/baja", methods=["POST"])
def perfil_baja():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    usuario = User.query.get(session['user_id'])

    try:
        Donacion.query.filter_by(user_id=usuario.id).delete()
        Servicio.query.filter_by(user_id=usuario.id).delete()
        Ayuda.query.filter_by(user_id=usuario.id).delete()

        db.session.delete(usuario)
        db.session.commit()

        session.clear()
        return jsonify({"mensaje": "Tu cuenta ha sido dada de baja correctamente."})
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Ocurrió un error al intentar dar de baja la cuenta."}), 500


# PERFIL: mis publicaciones
@app.route("/api/mis_publicaciones")
def mis_publicaciones():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    user_id = session['user_id']

    donaciones = Donacion.query.filter_by(user_id=user_id).order_by(Donacion.fecha_creacion.desc()).all()
    servicios = Servicio.query.filter_by(user_id=user_id).order_by(Servicio.fecha_creacion.desc()).all()
    ayudas = Ayuda.query.filter_by(user_id=user_id).order_by(Ayuda.fecha_creacion.desc()).all()

    return jsonify({
        "donaciones": [
            {
                "id": d.id, "titulo": d.titulo, "descripcion": d.descripcion,
                "ubicacion": d.ubicacion, "categoria": d.categoria, "imagen": d.imagen,
                "concretada": bool(d.concretada), "fecha_creacion": d.fecha_creacion
            } for d in donaciones
        ],
        "servicios": [
            {
                "id": s.id, "titulo": s.titulo, "descripcion": s.descripcion,
                "ubicacion": s.ubicacion, "categoria": s.categoria, "contacto": s.contacto, "imagen": s.imagen,
                "concretada": bool(s.concretada), "fecha_creacion": s.fecha_creacion
            } for s in servicios
        ],
        "ayuda": [
            {
                "id": a.id, "titulo": a.titulo, "descripcion": a.descripcion,
                "ubicacion": a.ubicacion, "categoria": a.categoria, "contacto": a.contacto, "imagen": a.imagen,
                "concretada": bool(a.concretada), "fecha_creacion": a.fecha_creacion, "urgente": bool(a.urgente)
            } for a in ayudas
        ]
    })


# Marcar como concretada / no concretada
def _marcar_concretada(modelo, id, categoria):
    item = modelo.query.get_or_404(id)
    if item.user_id != session['user_id']:
        return jsonify({"error": "No tenés permiso sobre esta publicación"}), 403

    valor = request.form.get("concretada", "true").lower() == "true"
    item.concretada = valor
    item.fecha_concretada = datetime.utcnow() if valor else None
    _registrar_actividad(session['user_id'], categoria, item.titulo, "concretada" if valor else "no_concretada")
    db.session.commit()
    return jsonify({"mensaje": "Actualizado correctamente", "concretada": item.concretada})

@app.route("/donaciones/concretar/<int:id>", methods=["POST"])
def concretar_donacion(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401
    return _marcar_concretada(Donacion, id, "donacion")

@app.route("/servicios/concretar/<int:id>", methods=["POST"])
def concretar_servicio(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401
    return _marcar_concretada(Servicio, id, "servicio")

@app.route("/ayuda/concretar/<int:id>", methods=["POST"])
def concretar_ayuda(id):
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401
    return _marcar_concretada(Ayuda, id, "ayuda")


# PERFIL: historial (publicada / editada / concretada / eliminada)
@app.route("/api/historial")
def historial():
    if 'user_id' not in session:
        return jsonify({"error": "No autorizado"}), 401

    user_id = session['user_id']

    registros = Actividad.query.filter_by(user_id=user_id).order_by(Actividad.fecha.desc()).all()

    eventos = [
        {
            "evento": r.evento,
            "categoria": r.categoria,
            "titulo": r.titulo,
            "fecha": r.fecha
        }
        for r in registros
    ]

    return jsonify(eventos)

with app.app_context():
    db.create_all()
_migrar_columna_categoria()
_migrar_columna_foto_perfil()
_migrar_columna_urgente()
_migrar_columna_reset_token()

if __name__ == '__main__':
    app.run(debug=True)