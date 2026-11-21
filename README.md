# Mini Agenda

Agenda escolar para primaria. Sirve para apuntar exámenes, deberes y proyectos. La app reparte los días de estudio y prepara resúmenes y mini tests con Claude. También incluye el calendario del colegio, una recomendación de lectura diaria, estrellas y racha de días.

- **Web:** GitHub Pages (gratis). Son ficheros estáticos: `index.html`, `config.js` y `logo.svg`.
- **Datos e inicio de sesión:** Supabase (plan gratuito).
- **IA:** la función `ai` de Supabase llama a la API de Claude. Es de pago por uso, con un tope diario por persona.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto de Supabase
1. Entra en [supabase.com](https://supabase.com) y crea un proyecto gratuito. Elige una región de Europa.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.

### 2. Cerrar el registro y crear el usuario
1. Ve a **Authentication → Sign In / Providers** y desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta y gastar la IA.
2. Ve a **Authentication → Users → Add user → Create new user**. Pon un correo y una contraseña y marca **Auto Confirm User**. Con ese correo y esa contraseña se entra en la agenda.

### 3. Conectar la web con Supabase
1. En **Project Settings → API** copia la **Project URL** y la clave **anon public**.
2. Pégalas en [`config.js`](config.js) y sube el cambio a GitHub.

La clave anon es pública: está pensada para ir en la web. La clave **service_role** no debe ir nunca en este repositorio.

### 4. Activar la IA
1. Crea una clave de API en [console.anthropic.com](https://console.anthropic.com).
2. En **Settings → Limits**, pon un límite de gasto mensual.
3. Instala la herramienta de Supabase y publica la función:

```bash
brew install supabase/tap/supabase
```

```bash
supabase login
```

```bash
supabase link --project-ref TU_PROJECT_REF
```

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

```bash
supabase functions deploy ai
```

`TU_PROJECT_REF` es el código que aparece en la URL del proyecto (`https://TU_PROJECT_REF.supabase.co`).

Ajustes opcionales, también como secretos:

| Secreto | Para qué | Valor por defecto |
|---|---|---|
| `ANTHROPIC_MODEL` | Modelo de Claude | `claude-opus-5-5`, el de mejor calidad. `claude-haiku-5-5` cuesta unas 40 veces menos. |
| `DAILY_LIMIT` | Usos de la IA por persona y día | `40` |

Por ejemplo, para pasar al modelo más barato:

```bash
supabase secrets set ANTHROPIC_MODEL=claude-haiku-5-5
```

## Uso

Abre la dirección de GitHub Pages en cualquier dispositivo y entra con el usuario creado en el paso 2. Lo que se apunta en un dispositivo aparece en los demás.

En el iPad o el móvil, usa **Compartir → Añadir a pantalla de inicio** para tenerla como una app.

## Notas

- **El proyecto gratuito de Supabase se pausa tras 7 días sin uso.** Si pasa, se reactiva desde su panel.
- **Calendario del colegio:** las fechas sin cole están en la constante `SCHOOL` de `index.html`. Ahora tiene el curso 2026-27 de TEMS y hay que actualizarla cada curso.
- **Biblioteca de contenido:** cada resumen, test y repaso que genera la IA se guarda en la tabla `ai_library`. Si se vuelve a pedir el mismo tema en el mismo idioma, se reutiliza sin llamar a Claude. Si tu proyecto es anterior a esta tabla, ejecuta [`supabase/biblioteca.sql`](supabase/biblioteca.sql) en el SQL Editor.
- **Datos personales:** el nombre, la edad y el curso se guardan en la base de datos, no en el código. Este repositorio es público.
