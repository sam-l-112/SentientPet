#!/bin/bash
# 備份 MariaDB 資料庫腳本

BACKUP_DIR="/home/prometheus/project/backups/mariadb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_CONTAINER_NAME="sentient_db"
DB_NAME="sentient_pet"
DB_PASS="sentient_root_pass"

# 建立備份目錄
mkdir -p $BACKUP_DIR

# 執行備份 (使用 docker exec 進入容器備份)
docker exec $DB_CONTAINER_NAME mysqldump -u root -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql

# 只保留最近 7 天的備份，刪除舊的
find $BACKUP_DIR -type f -mtime +7 -name "*.sql" -delete

echo "Database backup completed at $TIMESTAMP"