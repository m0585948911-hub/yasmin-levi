# Use an official Node.js runtime that includes puppeteer dependencies.
FROM node:20-slim

# Set the working directory in the container.
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) to leverage caching.
COPY package*.json ./

# Install all dependencies, including devDependencies needed for the build step.
RUN npm install

# Copy the rest of the application's source code.
COPY . .

# Build the TypeScript source code into JavaScript.
RUN npm run build

# The service listens on port 8080 by default, or the PORT env var. Expose it.
EXPOSE 8080

# Define the command to run the compiled application.
CMD [ "npm", "start" ]
