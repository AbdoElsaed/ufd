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

# Update yt-dlp to latest version
RUN yt-dlp -U

# Copy scripts first
COPY scripts/setup_cookies.sh /app/scripts/
COPY scripts/generate_cookies.py /app/scripts/

# Make scripts executable
RUN chmod +x /app/scripts/setup_cookies.sh

# Create necessary directories
RUN mkdir -p downloads temp cookies

# Set up initial cookies
RUN /app/scripts/setup_cookies.sh

# Copy the rest of the application
COPY . .

# Expose port
EXPOSE 8000

# Set environment variables for yt-dlp
ENV YDL_EXTRACT_AUDIO_FORMAT=mp3
ENV YDL_RECODE_VIDEO_FORMAT=mp4
ENV YDL_NO_WARNINGS=1
ENV YDL_FORCE_IPV4=1
ENV RENDER=true
ENV YDL_SLEEP_INTERVAL=5
ENV YDL_MAX_SLEEP_INTERVAL=10
ENV YDL_SLEEP_INTERVAL_REQUESTS=3

# Optional YouTube authentication token (to be set in deployment)
ENV YOUTUBE_AUTH_TOKEN=""

# Make the run script executable
RUN chmod +x run.sh

# Command to run the application
CMD ["./run.sh"] 