# Traefik certs

This folder is mounted into the Traefik container as `/certs`.

For local development you can:

- Create self-signed certificates for `app.localhost` and `api.localhost` and place them here, or
- Use a tool like `mkcert` to generate dev certificates and put them here.

Expected file names (examples):
- `app.localhost.crt`
- `app.localhost.key`
- `api.localhost.crt`
- `api.localhost.key`

If you don't need TLS for local testing, you can modify `docker-compose.yml` to expose port 80 instead of 443 and remove the cert mount.
