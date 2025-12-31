"use client";

import { useState, useRef } from "react";
import { Loader2, Video, FileText, Upload, X, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoRecorder, VideoUploadResult } from "./video-recorder";

interface CreateUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUpdateDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateUpdateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"uploading" | "transcribing">("uploading");
  const [format, setFormat] = useState<"text" | "video">("text");
  const [videoMode, setVideoMode] = useState<"record" | "upload">("record");
  const [showRecorder, setShowRecorder] = useState(false);
  const [type, setType] = useState("general");
  const [content, setContent] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoResult, setVideoResult] = useState<VideoUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormat("text");
    setVideoMode("record");
    setShowRecorder(false);
    setType("general");
    setContent("");
    setVideoFile(null);
    setVideoResult(null);
    setUploadProgress(0);
    setUploadStage("uploading");
  };

  // Generate thumbnail from video file
  const generateThumbnail = async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadeddata = () => {
        // Seek to 1 second or 10% of duration, whichever is less
        video.currentTime = Math.min(1, video.duration * 0.1);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(video.src);
              resolve(blob);
            },
            "image/jpeg",
            0.8
          );
        } catch {
          URL.revokeObjectURL(video.src);
          resolve(null);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(null);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB max)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File too large. Maximum size is 50MB.");
      return;
    }

    setVideoFile(file);
    setUploading(true);
    setUploadProgress(0);
    setUploadStage("uploading");

    try {
      const supabase = createClient();
      let thumbnailUrl: string | null = null;

      // Step 1: Generate and upload thumbnail
      const thumbnailBlob = await generateThumbnail(file);
      if (thumbnailBlob) {
        const thumbSignedUrlResponse = await fetch("/api/upload/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: "image/jpeg" }),
        });

        if (thumbSignedUrlResponse.ok) {
          const { storagePath: thumbPath, token: thumbToken } = await thumbSignedUrlResponse.json();
          const thumbFile = new File([thumbnailBlob], "thumbnail.jpg", { type: "image/jpeg" });

          const { error: thumbUploadError } = await supabase.storage
            .from("update-videos")
            .uploadToSignedUrl(thumbPath, thumbToken, thumbFile, {
              contentType: "image/jpeg",
            });

          if (!thumbUploadError) {
            const { data: thumbUrlData } = supabase.storage
              .from("update-videos")
              .getPublicUrl(thumbPath);
            thumbnailUrl = thumbUrlData.publicUrl;
          }
        }
      }

      setUploadProgress(20);

      // Step 2: Get a signed URL for video upload
      const signedUrlResponse = await fetch("/api/upload/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      const { storagePath, token } = await signedUrlResponse.json();

      // Step 3: Upload video using Supabase client's uploadToSignedUrl
      const { error: uploadError } = await supabase.storage
        .from("update-videos")
        .uploadToSignedUrl(storagePath, token, file, {
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Upload failed");
      }

      setUploadProgress(100);

      // Step 4: Call our API to get the public URL and transcription
      setUploadStage("transcribing");

      const transcribeResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath }),
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || "Failed to process video");
      }

      const result = await transcribeResponse.json();

      setVideoResult({
        video_url: result.video_url,
        thumbnail_url: thumbnailUrl,
        transcript: result.transcript || "",
        transcript_data: result.transcript_data || null,
        duration_seconds: result.duration_seconds || null,
      });
    } catch (error) {
      console.error("Video upload failed:", error);
      setVideoFile(null);
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (format === "text" && !content.trim()) return;
    if (format === "video" && !videoResult) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          format,
          content: format === "text" ? content : null,
          video_url: format === "video" ? videoResult?.video_url : null,
          thumbnail_url: format === "video" ? videoResult?.thumbnail_url : null,
          transcript: format === "video" ? videoResult?.transcript : null,
          transcript_data: format === "video" ? videoResult?.transcript_data : null,
          duration_seconds: format === "video" ? videoResult?.duration_seconds : null,
          is_draft: false,
        }),
      });

      if (response.ok) {
        resetForm();
        onOpenChange(false);
        onCreated();
      }
    } catch (error) {
      console.error("Failed to create update:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoResult(null);
    setUploadProgress(0);
    setUploadStage("uploading");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post Update</DialogTitle>
          <DialogDescription>
            Share a video or text update with your team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={format} onValueChange={(v) => setFormat(v as "text" | "video")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2">
                <FileText className="h-4 w-4" />
                Text
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Video className="h-4 w-4" />
                Video
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <Label htmlFor="content">What's on your mind?</Label>
                <Textarea
                  id="content"
                  placeholder="Share an update with your team..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                />
              </div>
            </TabsContent>

            <TabsContent value="video" className="mt-4">
              <div className="space-y-4">
                {/* Video already uploaded - show success */}
                {videoResult && !showRecorder && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Video className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">
                            {videoFile ? videoFile.name : "Recorded video"}
                          </p>
                          <p className="text-xs text-green-600">
                            Video ready to post
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeVideo}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Show recorder */}
                {showRecorder && !videoResult && (
                  <VideoRecorder
                    onComplete={(result) => {
                      setVideoResult(result);
                      setShowRecorder(false);
                    }}
                    onCancel={() => setShowRecorder(false)}
                  />
                )}

                {/* Video mode selection - shown when no video and not recording */}
                {!videoResult && !showRecorder && !uploading && (
                  <>
                    {/* Mode toggle */}
                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                      <button
                        type="button"
                        onClick={() => setVideoMode("record")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          videoMode === "record"
                            ? "bg-background shadow-sm"
                            : "hover:bg-background/50"
                        }`}
                      >
                        <Camera className="h-4 w-4" />
                        Record
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoMode("upload")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                          videoMode === "upload"
                            ? "bg-background shadow-sm"
                            : "hover:bg-background/50"
                        }`}
                      >
                        <Upload className="h-4 w-4" />
                        Upload
                      </button>
                    </div>

                    {/* Record mode */}
                    {videoMode === "record" && (
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => setShowRecorder(true)}
                      >
                        <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Record a video</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use your camera to record up to 2 minutes
                        </p>
                      </div>
                    )}

                    {/* Upload mode */}
                    {videoMode === "upload" && (
                      <div
                        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Click to upload video</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          MP4, MOV, or WebM up to 50MB
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Uploading state */}
                {uploading && videoFile && (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">
                          {videoFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${uploadStage === "transcribing" ? 100 : uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {uploadStage === "uploading"
                          ? `Uploading... ${uploadProgress}%`
                          : "Generating transcript..."}
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="type">Update Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Update</SelectItem>
                <SelectItem value="rock">Rock Progress</SelectItem>
                <SelectItem value="scorecard">Scorecard Update</SelectItem>
                <SelectItem value="incident">Incident Report</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                uploading ||
                (format === "text" && !content.trim()) ||
                (format === "video" && !videoResult)
              }
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
