FROM node:22-bookworm-slim

WORKDIR /app

# Build-Tools für native Node-Module (sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# sqlite3 aus Source bauen, damit die Binary zum Container-GLIBC passt
RUN npm install --build-from-source=sqlite3

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
