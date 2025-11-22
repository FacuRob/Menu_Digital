# Backend - Menú Digital

API REST para el sistema de menú digital con autenticación JWT y gestión de categorías y productos.

## 🚀 Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` y renómbralo a `.env`:

```bash
cp .env.example .env
```

Luego edita el archivo `.env` con tus credenciales:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario_postgres
DB_PASSWORD=tu_contraseña
DB_NAME=menu_digital
JWT_SECRET=genera_una_clave_segura_aleatoria
```

### 3. Configurar Base de Datos PostgreSQL

Asegúrate de tener PostgreSQL instalado y ejecutándose. Luego crea la base de datos:

```sql
CREATE DATABASE menu_digital;
```

Ejecuta el script SQL para crear las tablas (ubicado en `src/config/schema.sql` si existe).

### 4. Crear Usuario Administrador

Puedes crear un usuario administrador inicial usando el endpoint de registro o directamente en la base de datos.

## 📦 Scripts Disponibles

- `npm start` - Inicia el servidor en modo producción
- `npm run dev` - Inicia el servidor en modo desarrollo con nodemon

## 🔐 Seguridad

**IMPORTANTE:** Nunca compartas tu archivo `.env` en repositorios públicos. Este archivo contiene información sensible como:
- Credenciales de base de datos
- Claves secretas JWT
- Configuraciones de producción

El archivo `.gitignore` está configurado para ignorar automáticamente el archivo `.env`.

## 🛣️ Rutas de la API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/register` - Registrar usuario
- `GET /api/auth/verify` - Verificar token

### Categorías
- `GET /api/categorias` - Obtener todas las categorías
- `GET /api/categorias/activas` - Obtener categorías activas
- `GET /api/categorias/:id` - Obtener categoría por ID
- `POST /api/categorias` - Crear categoría (requiere auth)
- `PUT /api/categorias/:id` - Actualizar categoría (requiere auth)
- `DELETE /api/categorias/:id` - Eliminar categoría (requiere auth)

### Productos
- `GET /api/productos` - Obtener todos los productos
- `GET /api/productos/disponibles` - Obtener productos disponibles
- `GET /api/productos/categoria/:id` - Obtener productos por categoría
- `GET /api/productos/:id` - Obtener producto por ID
- `POST /api/productos` - Crear producto (requiere auth)
- `PUT /api/productos/:id` - Actualizar producto (requiere auth)
- `DELETE /api/productos/:id` - Eliminar producto (requiere auth)

## 🔧 Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **PostgreSQL** - Base de datos
- **JWT** - Autenticación
- **bcryptjs** - Encriptación de contraseñas
- **dotenv** - Gestión de variables de entorno
