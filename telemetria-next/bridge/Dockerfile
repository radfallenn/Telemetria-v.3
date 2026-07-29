FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
RUN mkdir -p /app/data

ENV NODE_ENV=production \
    HTTP_PORT=8790 \
    UDP_RECEIVE_PORT=33740 \
    PS5_HEARTBEAT_PORT=33739 \
    DATA_DIR=/app/data

EXPOSE 8790/tcp
EXPOSE 33740/udp

CMD ["node", "src/server.js"]
