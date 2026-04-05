module.exports = {
  apps: [
    {
      name: "sentient-pet-backend",
      script: "./src/app.js", // 你的進入點
      instances: "max",       // 根據 CPU 核心數開啟最大實例
      exec_mode: "cluster",   // 叢集模式，提高效能
      watch: false,           // 生產環境建議關閉
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      // 日誌路徑 (與 docker-compose 掛載路徑對應)
      error_file: "/root/.pm2/logs/error.log",
      out_file: "/root/.pm2/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};