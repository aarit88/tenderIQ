# Step 1: Build Frontend
FROM node:20 AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Step 2: Build Backend
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend
# Copy the built frontend from the builder stage
COPY --from=frontend-builder /app/dist ./dist

# Set environment variables
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./backend/tenderiq.db

# Expose the port
EXPOSE 8000

# Start command
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
