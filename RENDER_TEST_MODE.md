# AVERON — Render test mode

For temporary Render testing without a Persistent Disk:

- `NODE_ENV=production`
- `AVERON_DEPLOY_MODE=test`
- `AVERON_DATA_DIR` may be left unset

In this mode the app can use Render's ephemeral filesystem. Changes to orders/content can be lost on restart or redeploy. Do not use this mode for real sales.

For the real launch:

- `NODE_ENV=production`
- `AVERON_DEPLOY_MODE=production`
- set `AVERON_DATA_DIR` to a private persistent volume path

Production deploy mode refuses to start without persistent storage.
