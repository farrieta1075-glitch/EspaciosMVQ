# MVQro Espacios

PWA para gestión y reserva de espacios y recursos, con Google Sheets como base de datos.

## Requisitos

- Node.js 20+
- Spreadsheet de Google compartido con el service account (permiso Editor)
- Pestañas: `Usuarios`, `Areas`, `Espacios`, `Mapas`, `Recursos`, `RecursoEspacio`, `Reservas`, `ReservaRecursos`, `EventoHistorico`

## Configuración

1. Copia `.env.local.example` a `.env.local` y completa las variables.
2. Comparte el spreadsheet con el email del service account.
3. En la pestaña `Usuarios`, agrega al menos un admin:

| id | email | username | passwordHash | role | areaId | active |
|----|-------|----------|--------------|------|--------|--------|
| admin-1 | admin@example.com | admin | _(hash bcrypt)_ | ADMIN | | true |

Generar hash de contraseña:

```bash
node -e "const b=require('bcryptjs'); b.hash('tu-password',10).then(console.log)"
```

4. Instala dependencias y arranca:

```bash
npm install
npm run dev
```

5. Verifica conexión a Sheets:

```
GET http://localhost:3000/api/sheets/health
```

## Autenticación

- **Usuario/contraseña**: provider `credentials` contra pestaña `Usuarios`.
- **Correo**: magic link con provider `email`. En desarrollo sin `EMAIL_SERVER`, el enlace se imprime en consola del servidor.

## Estructura actual (Módulo A)

- Layout responsivo con header, drawer lateral derecho y toggle claro/oscuro
- Cliente Google Sheets centralizado en `src/lib/sheets/`
- NextAuth con roles (`ADMIN`, `GENERAL`, `VISUALIZACION`)
- Middleware de protección por ruta y rol

## Próximos pasos

- Módulo B: CRUD Espacios + editor gráfico (Konva + PDF)
- Módulo C: CRUD Recursos
- Módulo D: Mapa reutilizable + selector de fecha
