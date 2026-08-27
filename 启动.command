#!/bin/zsh
# 个人工作生活 App - 启动器（双击运行）
cd "$(dirname "$0")" || exit 1

NODE_BIN="$(command -v node 2>/dev/null)"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  NODE_BIN="/usr/local/bin/node"
fi
if [ ! -x "$NODE_BIN" ]; then
  osascript -e 'display alert "未找到 Node.js" message "请先安装 Node.js（https://nodejs.org）后再启动本 App。"' >/dev/null 2>&1
  exit 1
fi

mkdir -p data

# 找一个空闲端口（从 8765 开始往上找）
PORT=8765
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  if [ "$PORT" -gt 8900 ]; then
    PORT=8765
    break
  fi
done

# 后台启动服务（关掉终端窗口也不影响运行）
nohup "$NODE_BIN" server.js "$PORT" > data/server.log 2>&1 &
echo $! > data/server.pid

# 等服务就绪后打开浏览器
for i in $(seq 1 50); do
  if curl -s "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

open "http://127.0.0.1:$PORT"
echo ""
echo "✅ 个人工作生活 App 已启动：http://127.0.0.1:$PORT"
echo "   （数据保存在 data 文件夹，关闭浏览器不影响数据）"
echo ""
