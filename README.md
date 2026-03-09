# Don Bosco Track - Sistema Institucional de Asistencia

Este proyecto es una solución inteligente para la gestión de asistencia y jornadas laborales en Ciudad Don Bosco.

## Tecnologías Principales
- **NextJS 15** (App Router)
- **Firebase** (Firestore & Auth)
- **Genkit** (IA para reportes)
- **ShadCN UI** & **Tailwind CSS**

## Autenticación de GitHub (IMPORTANTE)
Si recibes un error de "Authentication failed" al hacer push, recuerda que GitHub ya no acepta contraseñas normales por terminal. Debes usar un **Personal Access Token (PAT)**:

1. Ve a **GitHub Settings > Developer Settings > Personal access tokens > Tokens (classic)**.
2. Genera un nuevo token con el permiso **`repo`**.
3. Copia el token.
4. Cuando la terminal te pida "Password", **pega el token** en lugar de tu contraseña de GitHub.

## Comandos para GitHub (Pasos para subir cambios)
Para subir tus últimos cambios al repositorio:

1. Abre tu terminal en la carpeta del proyecto.
2. `git add .` (Prepara todos los archivos modificados).
3. `git commit -m "Fix: corrección de firmas digitales, auditoría GPS y exportación Excel"` (Crea el punto de guardado).
4. `git push origin main` (Sube los cambios a la nube). Usa tu **PAT** como contraseña.

## Despliegue en Vercel
La aplicación está optimizada para desplegarse en Vercel. Asegúrate de configurar las variables de entorno de Firebase en el panel de Vercel antes de desplegar. Se han corregido los errores de `next/image` y `Link` para una compilación exitosa.

---
© 2024 Ciudad Don Bosco. Todos los derechos reservados.
