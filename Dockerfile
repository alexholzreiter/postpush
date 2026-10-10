FROM node:22-bookworm-slim

ARG PIPER_VERSION=1.8.0
ARG PIPER_MODEL_URL=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx
ARG PIPER_CONFIG_URL=https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl python3 python3-pip \
    && python3 -m pip install --break-system-packages --no-cache-dir "piper-tts==${PIPER_VERSION}" \
    && mkdir -p /opt/postpush/voice \
    && curl -fL --retry 3 -o /opt/postpush/voice/de_DE-thorsten-medium.onnx "${PIPER_MODEL_URL}" \
    && curl -fL --retry 3 -o /opt/postpush/voice/de_DE-thorsten-medium.onnx.json "${PIPER_CONFIG_URL}" \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PIPER_MODEL=/opt/postpush/voice/de_DE-thorsten-medium.onnx
EXPOSE 8586

CMD ["npm", "start"]
