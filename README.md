# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Email reset configuration

The backend needs SMTP credentials so password-reset links can be emailed. Update your local `.env` (or `server/.env.example`) with Gmail values by following these steps:

1. Enable 2FA on the Gmail account you plan to send from.
2. Create an **App Password** at https://myaccount.google.com/apppasswords.
3. Populate the SMTP block with the Gmail server and the new app password:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-account@gmail.com
   SMTP_PASS=<app-password>
   SMTP_FROM="Nexora <no-reply@yourdomain.com>"
   ```

4. Restart the Node server so `server/utils/email.js` picks up those values and can dispatch reset links.

Use the same values in `server/.env.example` if you commit env samples for teammates, and keep secrets out of version control by keeping real credentials only in your local `.env`.
