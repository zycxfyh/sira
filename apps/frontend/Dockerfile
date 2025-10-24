# (前端提取器 Dockerfile - V7)

FROM nginx:stable-alpine
# 直接从 builder 镜像中复制前端的 dist 目录
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]