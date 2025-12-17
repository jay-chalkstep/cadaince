"use client";

import { useState, useRef } from "react";
import { Loader2, Video, FileText, Upload, X, Camera } from "lucide-react";
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
import { VideoRecorder } from "./video-recorder";

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
  const [format, setFormat] = useState<"text" | "video">("text");
  const [videoMode, setVideoMode] = useState<"record" | "upload">("record");
  const [showRecorder, setShowRecorder] = useState(false);
  const [type, setType] = useState("general");
  const [content, setContent] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFormat("text");
    setVideoMode("record");
    setShowRecorder(false);
    setType("general");
    setContent("");
    setVideoFile(null);
    setVideoAssetId(null);
    setUploadProgress(0);
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoFile(file);
    setUploading(true);
    setUploadProgress(0);

    try {
      // Get upload URL from our API
      const response = await fetch("/api/upload", { method: "POST" });
      if (!response.ok) throw new Error("Failed to get upload URL");

      const { uploadUrl, uploadId } = await response.json();

      // Upload directly to Mux
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.open("PUT", uploadUrl);
        xhr.send(file);
      });

      // Store the upload ID - we'll use this when creating the update
      // The Mux webhook will update the asset ID when processing completes
      setVideoAssetId(uploadId);
    } catch (error) {
      console.error("Video upload failed:", error);
      setVideoFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (format === "text" && !content.trim()) return;
    if (format === "video" && !videoAssetId) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          format,
          content: format === "text" ? content : null,
          video_asset_id: format === "video" ? videoAssetId : null,
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
    setVideoAssetId(null);
    setUploadProgress(0);
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
                {videoAssetId && !showRecorder && (
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
                {showRecorder && !videoAssetId && (
                  <VideoRecorder
                    onComplete={(uploadId) => {
                      setVideoAssetId(uploadId);
                      setShowRecorder(false);
                    }}
                    onCancel={() => setShowRecorder(false)}
                  />
                )}

                {/* Video mode selection - shown when no video and not recording */}
                {!videoAssetId && !showRecorder && (
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
                          Use your camera to record up to 3 minutes
                        </p>
                      </div>
                    )}

                    {/* Upload mode */}
                    {videoMode === "upload" && (
                      <>
                        {!videoFile ? (
                          <div
                            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm font-medium">Click to upload video</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              MP4, MOV, or WebM up to 500MB
                            </p>
                          </div>
                        ) : (
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Video className="h-8 w-8 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-medium truncate max-w-[200px]">
                                    {videoFile.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={removeVideo}
                                disabled={uploading}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {uploading && (
                              <div className="mt-3">
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Uploading... {uploadProgress}%
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
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
                (format === "video" && !videoAssetId)
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
