FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (doesn't require package-lock.json)
RUN npm install

# Copy all project files
COPY . .

# Expose the app port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]
