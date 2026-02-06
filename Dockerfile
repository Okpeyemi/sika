# Use official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
# libsndfile1 is often needed for audio processing libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY scripts/requirements-tts.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements-tts.txt

# Copy the server script into the container at /app
COPY scripts/tts_server.py .

# Expose port 8000
EXPOSE 8001

# Define environment variable
ENV PORT=8001

# Run tts_server.py when the container launches
CMD ["sh", "-c", "uvicorn tts_server:app --host 0.0.0.0 --port ${PORT:-8001}"]
