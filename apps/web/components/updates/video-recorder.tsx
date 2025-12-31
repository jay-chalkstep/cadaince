"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Video,
  Circle,
  Square,
  RotateCcw,
  Check,
  X,
  SwitchCamera,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type RecorderState = "idle" | "previewing" | "recording" | "review" | "uploading";

export interface VideoUploadResult {
  video_url: string;
  thumbnail_url: string | null;
  transcript: string;
  transcript_data: {
    text: string;
    words: { word: string; start: number; end: number }[];
  } | null;
  duration_seconds: number | null;
}

interface VideoRecorderProps {
  maxDuration?: number; // Default 120 seconds (2 min)
  onComplete: (result: VideoUploadResult) => void;
  onCancel: () => void;
}

export function VideoRecorder({
  maxDuration = 120,
  onComplete,
  onCancel,
}: VideoRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<"uploading" | "transcribing">("uploading");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Check for multiple cameras on mount
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoInputs.length > 1);
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Attach stream to video element when both are available
  useEffect(() => {
    if (
      (state === "previewing" || state === "recording") &&
      streamRef.current &&
      videoPreviewRef.current &&
      videoPreviewRef.current.srcObject !== streamRef.current
    ) {
      videoPreviewRef.current.srcObject = streamRef.current;
      videoPreviewRef.current.play().catch(console.error);
    }
  }, [state]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play();
      }

      setState("previewing");
    } catch (err) {
      console.error("Camera access error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera access denied. Please allow camera and microphone access in your browser settings.");
        } else if (err.name === "NotFoundError") {
          setError("No camera found. Please connect a camera and try again.");
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError("Failed to access camera. Please try again.");
      }
    }
  }, [facingMode]);

  const flipCamera = useCallback(async () => {
    const newFacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacingMode);

    if (state === "previewing" && streamRef.current) {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: newFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        });

        streamRef.current = stream;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
          await videoPreviewRef.current.play();
        }
      } catch (err) {
        console.error("Camera flip error:", err);
        setError("Failed to switch camera. Please try again.");
      }
    }
  }, [facingMode, state, stopStream]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setElapsedTime(0);

    // Determine best supported mime type
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];

    let mimeType = "";
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mimeType || "video/webm",
      });
      setRecordedBlob(blob);
      stopStream();
      setState("review");
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Collect data every second
    setState("recording");

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1;
        if (next >= maxDuration) {
          stopRecording();
        }
        return next;
      });
    }, 1000);
  }, [maxDuration, stopStream]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const retake = useCallback(() => {
    setRecordedBlob(null);
    setElapsedTime(0);
    setState("idle");
  }, []);

  // Capture thumbnail from video element
  const captureThumbnail = useCallback(async (videoElement: HTMLVideoElement): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve(blob),
          "image/jpeg",
          0.8
        );
      } catch {
        resolve(null);
      }
    });
  }, []);

  const uploadVideo = useCallback(async () => {
    if (!recordedBlob) return;

    setState("uploading");
    setUploadProgress(0);
    setUploadStage("uploading");
    setError(null);

    try {
      const supabase = createClient();
      let thumbnailUrl: string | null = null;

      // Step 1: Capture and upload thumbnail from video playback element
      if (videoPlaybackRef.current) {
        const thumbnailBlob = await captureThumbnail(videoPlaybackRef.current);
        if (thumbnailBlob) {
          // Get signed URL for thumbnail
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
      }

      setUploadProgress(20);

      // Step 2: Get a signed URL for video upload
      const signedUrlResponse = await fetch("/api/upload/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: recordedBlob.type }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      const { storagePath, token } = await signedUrlResponse.json();

      // Step 3: Upload video using Supabase client's uploadToSignedUrl
      const extension = storagePath.split(".").pop() || "webm";
      const file = new File([recordedBlob], `video.${extension}`, {
        type: recordedBlob.type,
      });

      const { error: uploadError } = await supabase.storage
        .from("update-videos")
        .uploadToSignedUrl(storagePath, token, file, {
          contentType: recordedBlob.type,
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

      onComplete({
        video_url: result.video_url,
        thumbnail_url: thumbnailUrl,
        transcript: result.transcript || "",
        transcript_data: result.transcript_data || null,
        duration_seconds: elapsedTime,
      });
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setState("review");
    }
  }, [recordedBlob, elapsedTime, onComplete, captureThumbnail]);

  const handleCancel = useCallback(() => {
    stopStream();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    onCancel();
  }, [stopStream, onCancel]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        if (state === "previewing") {
          startRecording();
        } else if (state === "recording") {
          stopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state, startRecording, stopRecording, handleCancel]);

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Idle state - Start button */}
      {state === "idle" && !error && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <Video className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4 text-center">
            Record a video update (up to {Math.floor(maxDuration / 60)} minutes)
          </p>
          <Button onClick={startCamera} size="lg">
            <Video className="mr-2 h-4 w-4" />
            Start Camera
          </Button>
        </div>
      )}

      {/* Preview and Recording states */}
      {(state === "previewing" || state === "recording") && (
        <div className="relative">
          {/* Video preview */}
          <div
            className={cn(
              "relative aspect-video bg-black rounded-lg overflow-hidden",
              state === "recording" && "ring-2 ring-red-500 ring-offset-2"
            )}
          >
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />

            {/* Recording indicator */}
            {state === "recording" && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-white text-sm font-medium">
                  {formatTime(elapsedTime)} / {formatTime(maxDuration)}
                </span>
              </div>
            )}

            {/* Camera flip button (mobile) */}
            {hasMultipleCameras && state === "previewing" && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4"
                onClick={flipCamera}
              >
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>

            {state === "previewing" && (
              <Button
                type="button"
                onClick={startRecording}
                className="bg-red-600 hover:bg-red-700"
                size="lg"
              >
                <Circle className="mr-2 h-4 w-4 fill-current" />
                Start Recording
              </Button>
            )}

            {state === "recording" && (
              <Button
                type="button"
                onClick={stopRecording}
                variant="destructive"
                size="lg"
              >
                <Square className="mr-2 h-4 w-4 fill-current" />
                Stop Recording
              </Button>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="text-xs text-muted-foreground text-center mt-2">
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Space</kbd> to{" "}
            {state === "previewing" ? "start" : "stop"} recording,{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to cancel
          </p>
        </div>
      )}

      {/* Review state */}
      {state === "review" && recordedBlob && (
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              ref={videoPlaybackRef}
              src={URL.createObjectURL(recordedBlob)}
              controls
              className="w-full h-full"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {formatTime(elapsedTime)} recorded •{" "}
              {(recordedBlob.size / (1024 * 1024)).toFixed(1)} MB
            </p>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={retake}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake
              </Button>
              <Button type="button" onClick={uploadVideo}>
                <Check className="mr-2 h-4 w-4" />
                Use This
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading state */}
      {state === "uploading" && (
        <div className="space-y-4 p-8 border rounded-lg">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="space-y-2">
            <Progress value={uploadStage === "transcribing" ? 100 : uploadProgress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {uploadStage === "uploading"
                ? `Uploading video... ${uploadProgress}%`
                : "Generating transcript..."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
