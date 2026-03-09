
# Don Bosco Track - Sistema Institucional de Asistencia

Este proyecto es una solución inteligente para la gestión de asistencia y jornadas laborales en Ciudad Don Bosco.

## Configuración de Correos Reales (Resend)
Para que las alertas y recordatorios lleguen realmente al correo de los docentes:

1. Ve a [Resend.com](https://resend.com) y crea una cuenta.
2. Genera una **API Key** en la sección "API Keys".
3. En Vercel, ve a **Settings > Environment Variables**.
4. Añade una nueva variable:
   - Key: `RESEND_API_KEY`
   - Value: (Tu clave de Resend: `re_vQmMKAsk_JpfmPSBDVNWwoA9k3PxvhfL8`)
5. Realiza un nuevo despliegue (Redeploy).

## Reglas de Marcaje
- **Margen de Seguridad**: El sistema bloquea el registro de entrada si se intenta marcar más de 10 minutos antes del inicio de la jornada.
- **Geolocalización**: Cada marcaje captura las coordenadas GPS y la dirección física para auditoría. Los enlaces en los reportes permiten ver el punto exacto en Google Maps.

## Autenticación de GitHub (PAT)
Si recibes errores al subir cambios (`git push`), usa un **Personal Access Token (PAT)** en lugar de tu contraseña de GitHub.

---
© 2024 Ciudad Don Bosco. Todos los derechos reservados.
