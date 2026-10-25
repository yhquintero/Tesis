# Contrato de API — Prenómina UPR

Servidor local Node.js (`server/`) sobre SQLite. Todas las rutas cuelgan de `/api`.
Formato JSON UTF-8. Fechas `YYYY-MM-DD`; marcas de tiempo ISO-8601 UTC.

## Autenticación

- `POST /api/auth/login` → `{ email, password, cliente? }`
  - 200 `{ accessToken, expiraEn, refreshToken, usuario }`
  - 401 credenciales inválidas · 403 usuario no aprobado · 423 bloqueado · 429 demasiados intentos
  - La web recibe además cookies `pn_sesion` (access) y `pn_refresh` (HttpOnly, SameSite=Strict).
- `POST /api/auth/refresh` → `{ refreshToken? }` · 200 igual que login · 401 token inválido/revocado.
- `POST /api/auth/logout` → 204. Revoca el refresh y borra cookies.
- `GET /api/auth/me` → `{ usuario }`.
- `POST /api/auth/password` → `{ actual, nueva }` · 200 `{ ok:true }`.
- `POST /api/auth/recuperar` → `{ email }` · 202 `{ ok:true }` (crea solicitud para el administrador).

Cabeceras: `Authorization: Bearer <accessToken>` (Android) o cookie de sesión (web).
Mutaciones web exigen `X-CSRF-Token` igual al valor de la cookie `pn_csrf` (doble envío).

### Usuario

```json
{
  "id": 1, "email": "admin@upr.edu.cu", "nombre": "Administrador",
  "rol": "admin", "estado": "aprobado",
  "permisos": { "crear": true, "leer": true, "actualizar": true, "eliminar": true },
  "debeCambiarClave": false, "ultimoAcceso": "2025-05-31T14:02:11.000Z",
  "creadoEn": "2025-01-01T00:00:00.000Z"
}
```

Roles: `admin` | `determinado` | `sobrecarga`. Estados: `pendiente` | `aprobado` | `rechazado` | `inactivo`.

## Errores

```json
{ "error": { "codigo": "REGLA_NEGOCIO", "mensaje": "Texto para el usuario", "campos": { "email": "Formato inválido" } } }
```

Códigos HTTP: 400 validación · 401 no autenticado · 403 sin permiso · 404 no existe ·
409 conflicto · 422 regla de negocio · 423 bloqueado · 429 límite · 500 interno.

## Usuarios (admin)

| Método | Ruta | Cuerpo / Notas |
|---|---|---|
| GET | `/api/usuarios?q=&rol=&estado=&page=1&limit=20` | `{ items, total, page, limit, paginas }` |
| POST | `/api/usuarios` | `{ email, nombre, rol, estado?, permisos? }` |
| PATCH | `/api/usuarios/:id` | campos parciales; no permite auto-degradarse |
| POST | `/api/usuarios/:id/aprobar` | `{ aprobar: true }` |
| POST | `/api/usuarios/:id/reset-password` | 200 `{ passwordTemporal }` |
| DELETE | `/api/usuarios/:id` | 409 si es el último admin |

## Profesores

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/profesores?q=&categoria=&activo=&page=&limit=` | búsqueda por nombre/CI/no. trabajador |
| POST | `/api/profesores` | `{ noTrabajador, nombre, ci, anio, area, areaCiencia, categoriaPoc, categoriaDocente, cargaHoraria, correo?, telefono?, activo? }` |
| PATCH | `/api/profesores/:id` | parcial |
| DELETE | `/api/profesores/:id` | 409 si tiene contratos |
| GET | `/api/profesores/export.xlsx?q=&categoria=&activo=` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

## Períodos y prenómina

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/periodos` | lista |
| POST | `/api/periodos` | `{ nombre, inicio, fin, cortes }` |
| PATCH | `/api/periodos/:id` | `{ estado: "abierto"\|"cerrado" }` |
| GET | `/api/prenomina?periodoId=` | grilla completa + resumen |
| PUT | `/api/prenomina/horas` | `{ periodoId, profesorId, horas: [ .. cortes ] }` |
| GET | `/api/prenomina/export.xlsx?periodoId=` | hoja con la grilla y totales |

Respuesta de prenómina:

```json
{
  "periodo": { "id": 1, "nombre": "2025-1", "cortes": 14, "estado": "abierto" },
  "profesores": [
    { "profesorId": 4, "nombre": "Eliomar Rodríguez Izquierdo", "categoriaPoc": "Profesor",
      "categoriaDocente": "Auxiliar", "cargaHoraria": 8,
      "horas": [28,56,39,24,20,40,0,0,0,0,0,8,8,8],
      "thp": 231, "hsp": 117, "tpp": 2556.32 }
  ],
  "resumenCategorias": [
    { "categoriaDocente": "Auxiliar", "thp": 1527, "hsp": 672, "tpp": 14682.456 }
  ],
  "totales": { "thp": 4081, "hsp": 1894.2, "tpp": 39179.47 }
}
```

Cálculo (parametrizable en `configuracion` y `tarifas`):
`THP = Σ horas`; `HSP = Σ max(0, horas − cargaHoraria)`; `TPP = (THP − HSP)·tarifaBase(categoría) + HSP·tarifaSobrecarga(categoría)`.

## Contratos

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/contratos?estado=&tipo=&profesorId=&q=&page=&limit=` | incluye `profesor` y `diasParaVencer` |
| GET | `/api/contratos/:id` | detalle + pagos |
| POST | `/api/contratos` | `{ profesorId, tipo, objeto, periodo, fechaInicio, fechaFin, horas, clausulas[], observaciones? }`; tarifa e importe se calculan en el servidor |
| PATCH | `/api/contratos/:id` | solo en `borrador` o `rechazado` |
| POST | `/api/contratos/:id/estado` | `{ estado, motivo? }` transiciones: borrador→pendiente→aprobado→activo→completado; pendiente→rechazado; cualquiera→cancelado (admin) |
| DELETE | `/api/contratos/:id` | solo `borrador`, admin |
| GET | `/api/contratos/:id/pdf` | PDF del contrato |
| GET | `/api/contratos/pdf?estado=&tipo=` | PDF único con todos los contratos (una página por contrato) |

Reglas: duración ≤ 12 meses; `horas` > 0; solo contratos `aprobado` pasan a `activo`;
solo `activo`/`completado` generan pagos; cláusulas variables almacenadas como arreglo de textos.

## Pagos

| Método | Ruta | Notas |
|---|---|---|
| GET | `/api/pagos?estado=&periodo=&contratoId=&page=&limit=` | incluye contrato, profesor y `vencido` |
| POST | `/api/pagos` | `{ contratoId, periodo, horas, observaciones? }`; `fechaLimite = fechaFin + 30 días` |
| POST | `/api/pagos/:id/estado` | `{ estado: "aprobado"\|"pagado"\|"anulado", fechaPago?, forzar? }` |
| GET | `/api/pagos/export.xlsx?estado=&periodo=` | planilla de liquidación |

Reglas: importe = horas × tarifa del contrato; no aprobar si `fecha_limite` venció (salvo admin con `forzar`); un pago pagado no se modifica.

## Dashboard, tarifas, configuración, auditoría, respaldos

- `GET /api/dashboard` → `{ kpis, usuariosPorRol, permisos, estados, horasPorCategoria, distribucionProfesores, pagoPorSobrecarga, contratosRecientes, pagosPendientes }`.
- `GET /api/tarifas` · `POST /api/tarifas` · `PATCH /api/tarifas/:id`.
- `GET /api/configuracion` → objeto clave/valor · `PUT /api/configuracion` (admin).
- `GET /api/auditoria?page=&limit=&accion=&desde=&hasta=` (admin).
- `GET /api/respaldos` · `POST /api/respaldos` · `GET /api/respaldos/:id/descargar` · `POST /api/respaldos/:id/restaurar` (admin).
- `GET /api/salud` → `{ ok:true, version, hora }` (sin autenticación).

## Sincronización Android

La app usa las mismas rutas con `Authorization: Bearer`. Estrategia offline-first:
1. Al iniciar sesión guarda `accessToken`, `refreshToken` y `usuario` en DataStore.
2. Sincroniza catálogos (`profesores`, `contratos`, `pagos`, `tarifas`, `periodos`, `dashboard`) a Room.
3. Las mutaciones sin red se guardan en `pendientes_sync` y se reintentan en orden.
4. `POST /api/auth/refresh` antes de expirar (30 min).
