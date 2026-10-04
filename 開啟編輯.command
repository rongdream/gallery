#!/bin/bash
# 雙擊這個檔案：啟動本機編輯模式並自動開啟瀏覽器
cd "$(dirname "$0")"
( sleep 1.5; open "http://localhost:8787/" ) &
echo "編輯模式啟動中…（要結束請關閉這個視窗）"
exec npm run preview
