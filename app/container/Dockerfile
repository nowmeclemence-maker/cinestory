FROM node:20-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY server.mjs filter-graph.mjs ./
EXPOSE 8080
CMD ["node", "server.mjs"]
