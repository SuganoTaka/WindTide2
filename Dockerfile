FROM node:20-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# 依存だけ先に入れてレイヤをキャッシュする
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

RUN npm run build

ENV NODE_ENV=production

# Render は PORT 環境変数で待ち受けポートを指定する（next start が自動で従う）
CMD ["npm", "start"]
