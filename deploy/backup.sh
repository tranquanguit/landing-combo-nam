#!/usr/bin/env bash
# Sao lưu CSDL Mocha (đơn hàng, nội dung, ảnh, tài khoản, chat — tất cả nằm trong Postgres).
#
#   deploy/backup.sh                       # chạy tay
#   crontab -e  ->  15 2 * * * /home/mocha/mocha/deploy/backup.sh >> /var/log/mocha-backup.log 2>&1
#
# Giữ BACKUP_KEEP bản gần nhất (mặc định 14) trong BACKUP_DIR (mặc định /var/backups/mocha).
# Bản sao lưu nằm trên CÙNG máy chủ chưa phải là sao lưu: chép thêm ra ngoài (rclone, scp…).
# Khôi phục: docs/dua-len-production.md, mục "Sao lưu".
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${BACKUP_DIR:-/var/backups/mocha}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DIR"
chmod 700 "$DIR"   # có dữ liệu cá nhân của khách (đơn hàng)

FILE="$DIR/mocha-$(date +%Y%m%d-%H%M%S).dump"
docker compose exec -T db pg_dump -U mocha -d mocha -Fc > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"

# Bỏ các bản cũ, giữ KEEP bản mới nhất.
ls -1t "$DIR"/mocha-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm --

echo "$(date '+%F %T') đã sao lưu $FILE ($(du -h "$FILE" | cut -f1))"
