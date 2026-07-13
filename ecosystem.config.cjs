module.exports = {
  apps: [
    {
      name: 'financas',
      script: '/app/.output/server/index.mjs',
      cwd: '/app',
      interpreter: '/usr/bin/node',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '3000',
        LUMEN_DB_PATH: '/app/.data/lumen.sqlite3',
      },
    },
  ],
}
