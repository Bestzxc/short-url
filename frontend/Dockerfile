FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# next.config.mjs reads these at build time to set up the /api/* proxy to each service
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
ARG REDIRECT_API_URL=http://redirect:4002
ENV REDIRECT_API_URL=$REDIRECT_API_URL
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
