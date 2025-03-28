# Universal File Downloader (UFD)

A modern web application for downloading videos from various social media platforms with support for different formats and qualities. Built with Next.js, FastAPI, and yt-dlp.

## Features

- 🎥 Support for multiple platforms:
  - YouTube
  - Instagram
  - Facebook
  - Twitter
  - TikTok
  - Reddit
- 🎬 Multiple format options:
  - Video (MP4)
  - Audio (M4A)
- 📊 Quality selection:
  - Highest quality
  - 1080p
  - 720p
  - 480p
  - 360p
- 🚀 Real-time progress tracking
- 💨 Direct streaming without storage
- 🎨 Modern, responsive UI

## Tech Stack

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn/ui
- Lucide Icons

### Backend
- FastAPI
- Python 3.10+
- yt-dlp
- FFmpeg

## Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- FFmpeg
- Chrome browser (for Instagram downloads)

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file:
```bash
cp .env.example .env
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

## Running the Application

### Start the Backend

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
./run.sh  # On Windows: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Start the Frontend

```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:3000`

## API Documentation

Once the backend is running, you can access the API documentation at:
- Swagger UI: `http://localhost:8000/api/v1/docs`
- ReDoc: `http://localhost:8000/api/v1/redoc`

## Environment Variables

### Backend (.env)
```
API_V1_STR=/api/v1
PROJECT_NAME=UFD Backend
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for video downloading capabilities
- [FFmpeg](https://ffmpeg.org/) for video processing
- [Shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components

## Deployment

### Backend Deployment (Render)

1. Fork this repository to your GitHub account

2. Create a new Web Service on Render:
   - Connect your GitHub repository
   - Choose "Docker" as the environment
   - Select the free plan
   - Set the following environment variables:
     ```
     API_V1_STR=/api/v1
     PROJECT_NAME=UFD Backend
     CORS_ORIGINS=["https://your-frontend-domain.com"]
     MAX_CONCURRENT_DOWNLOADS=2
     ```

3. Deploy! Render will automatically build and deploy your container

Note: The free tier has some limitations:
- 512 MB RAM
- Shared CPU
- 15-minute request timeout
- Container spins down after inactivity
- Limited bandwidth

For production use, consider:
- Upgrading to a paid plan
- Using alternative hosting (DigitalOcean, AWS, etc.)
- Setting up a CDN for better performance

### Frontend Deployment

You can deploy the frontend to Vercel:

1. Push your code to GitHub
2. Import the project to Vercel
3. Set the environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api/v1
   ```
4. Deploy! 