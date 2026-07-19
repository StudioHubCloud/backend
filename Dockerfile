  FROM node:22.23.1-alpine3.24 AS base
  WORKDIR /app
  COPY package.json package-lock.json ./
  RUN npm ci
  
  FROM base AS build
  WORKDIR /app
  COPY . . 
  RUN npm run build
  
  FROM base AS prune
  WORKDIR /app
  RUN npm ci --omit=dev
  
  FROM node:22.23.1-alpine3.24 AS runtime
  WORKDIR /app
  
  COPY --from=prune /app/node_modules /app/node_modules
  COPY --from=build /app/dist /app
  COPY package.json ./

  ENV NODE_ENV=production
  
  CMD ["sh", "-c", "node src/main.js"]
  