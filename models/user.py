from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()


class Mensaje(db.Model):
    __tablename__ = 'mensaje'

    id = db.Column(db.Integer, primary_key=True)
    emisor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    receptor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    asunto = db.Column(db.String(200), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    leido = db.Column(db.Boolean, default=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    tipo = db.Column(db.String(20), nullable=True)  # "donacion", "servicio" o "ayuda"
    publicacion_id = db.Column(db.Integer, nullable=True)
    publicacion_titulo = db.Column(db.String(200), nullable=True)  # guardado directo para no depender de que la publicación siga existiendo

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(100), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    apellido = db.Column(db.String(100), nullable=False)
    dni = db.Column(db.String(20), unique=True, nullable=False)
    distrito = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    telefono = db.Column(db.String(30), nullable=True)
    foto_perfil = db.Column(db.String(200), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expira = db.Column(db.DateTime, nullable=True)

    donaciones = db.relationship('Donacion', backref='usuario', lazy=True)
    servicios = db.relationship('Servicio', backref='usuario', lazy=True)
    ayudas = db.relationship('Ayuda', backref='usuario', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'

class Donacion(db.Model):
    __tablename__ = 'donaciones'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    ubicacion = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(50), nullable=True)
    imagen = db.Column(db.String(200), nullable=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    concretada = db.Column(db.Boolean, default=False)
    fecha_concretada = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'ubicacion': self.ubicacion,
            'categoria': self.categoria,
            'imagen': self.imagen,
            'fecha_creacion': self.fecha_creacion.isoformat(),
            'usuario': self.usuario.username
        }

class Servicio(db.Model):
    __tablename__ = 'servicios'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    ubicacion = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(50), nullable=True)
    contacto = db.Column(db.String(200), nullable=False)
    imagen = db.Column(db.String(200), nullable=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    concretada = db.Column(db.Boolean, default=False)
    fecha_concretada = db.Column(db.DateTime, nullable=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'ubicacion': self.ubicacion,
            'categoria': self.categoria,
            'contacto': self.contacto,
            'imagen': self.imagen,
            'fecha_creacion': self.fecha_creacion.isoformat(),
            'usuario': self.usuario.username
        }

class Actividad(db.Model):
    __tablename__ = 'actividad'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    categoria = db.Column(db.String(20), nullable=False)  # "donacion", "servicio" o "ayuda"
    titulo = db.Column(db.String(200), nullable=False)
    evento = db.Column(db.String(20), nullable=False)  # "publicada", "editada", "concretada", "no_concretada", "eliminada"
    fecha = db.Column(db.DateTime, default=datetime.utcnow)

class Ayuda(db.Model):
    __tablename__ = 'ayuda'
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    ubicacion = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(50), nullable=True)
    contacto = db.Column(db.String(200), nullable=False)
    imagen = db.Column(db.String(200), nullable=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    concretada = db.Column(db.Boolean, default=False)
    fecha_concretada = db.Column(db.DateTime, nullable=True)
    urgente = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'ubicacion': self.ubicacion,
            'categoria': self.categoria,
            'contacto': self.contacto,
            'imagen': self.imagen,
            'fecha_creacion': self.fecha_creacion.isoformat(),
            'usuario': self.usuario.username,
            'urgente': bool(self.urgente)
        }