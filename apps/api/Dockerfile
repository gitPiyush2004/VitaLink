FROM node:24-bookworm-slim
WORKDIR /app
ENV HUSKY=0
COPY . .
RUN npm ci
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["../../node_modules/.bin/tsx", "src/main.ts"]
