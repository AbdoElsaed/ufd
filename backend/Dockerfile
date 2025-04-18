FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    chromium-driver \
    wget \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome binary location for yt-dlp
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMIUM_BIN=/usr/bin/chromium

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p downloads temp

# Copy the rest of the application
COPY . .

# Make scripts executable
RUN chmod +x run.sh

# Expose port
ENV PORT=8000
EXPOSE ${PORT}

# Set environment variables for yt-dlp
ENV YDL_EXTRACT_AUDIO_FORMAT=mp3
ENV YDL_RECODE_VIDEO_FORMAT=mp4
ENV YDL_NO_WARNINGS=1
ENV YDL_FORCE_IPV4=1
ENV RENDER=true

# Command to run the application
CMD ["./run.sh"] 