import { DownloadForm } from "@/components/download-form";

export default function Home() {
  return (
    <main className="container mx-auto p-4 min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-100">
          UR FAV DOWNLOADER
        </h1>
        <p className="text-muted-foreground">
          Download videos from your favorite social media platforms
        </p>
      </div>
      <DownloadForm />
    </main>
  );
}
