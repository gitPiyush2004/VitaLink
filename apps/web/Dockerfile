FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV HUSKY=0
COPY . .
RUN npm ci && npm run build --workspace @vitalink/web

FROM nginx:1.28-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 5173
