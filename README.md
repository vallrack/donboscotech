
# Don Bosco Track - Sistema Institucional de Asistencia

Este proyecto es una solución inteligente para la gestión de asistencia y jornadas laborales en Ciudad Don Bosco.

## Configuración de Correos Reales (Resend)
Para que las alertas y recordatorios lleguen realmente al correo de los docentes:

1. Ve a [Resend.com](https://resend.com) y crea una cuenta.
2. Genera una **API Key** en la sección "API Keys".
3. En Vercel, ve a **Settings > Environment Variables**.
4. Añade una nueva variable:
   - Key: `RESEND_API_KEY`
   - Value: (Tu clave de Resend que empieza con `re_`)
5. Realiza un nuevo despliegue (Redeploy).

## Reglas de Marcaje
- **10 Minutos**: El sistema bloquea el registro de entrada si se intenta marcar más de 10 minutos antes del inicio de la jornada.
- **Geolocalización**: Cada marcaje captura las coordenadas GPS y la dirección física para auditoría.

## Autenticación de GitHub (PAT)
Si recibes errores al subir cambios, usa un **Personal Access Token (PAT)**:
1. GitHub Settings > Developer Settings > Tokens (classic).
2. Genera un token con el permiso `repo`.
3. Úsalo como contraseña en la terminal.

---
© 2024 Ciudad Don Bosco. Todos los derechos reservados.
