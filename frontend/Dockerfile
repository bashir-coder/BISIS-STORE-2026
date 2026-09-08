# frontend/Dockerfile
FROM node:22-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ENABLE_GOOGLE_OAUTH=false
ARG VITE_API_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ENABLE_GOOGLE_OAUTH=$VITE_ENABLE_GOOGLE_OAUTH
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
