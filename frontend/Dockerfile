FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# next.config.mjs reads API_URL at build time to set up the /api/* proxy
ARG API_URL=http://backend:4000
ENV API_URL=$API_URL
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
