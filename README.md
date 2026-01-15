## Next.js App Router Course - Starter

This is the starter template for the Next.js App Router Course. It contains the starting code for the dashboard application.

For more information, see the [course curriculum](https://nextjs.org/learn) on the Next.js Website.

## Environment Variables

### Local Development

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your local configuration:
   ```
   POSTGRES_URL=postgresql://username:password@localhost:5432/database?sslmode=require
   ```

### Production Environment

Environment variables should be configured in your hosting platform:

- **Vercel**: Project Settings → Environment Variables
- **Netlify**: Site Settings → Environment Variables
- **Railway/Render**: Environment Variables section
- **Docker**: Use `docker-compose.yml` or `.env` file (not committed to git)
- **Server**: Set environment variables in your server's configuration

**Important**: Never commit `.env` files to git. They contain sensitive information.
