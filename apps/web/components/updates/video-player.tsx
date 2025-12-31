"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { cn } from "@/lib/utils";

export interface VideoPlayerHandle {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  posterUrl?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ src, posterUrl, className, onTimeUpdate, onLoadedMetadata }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime ?? 0;
      },
    }));

    const handleTimeUpdate = () => {
      if (onTimeUpdate && videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (onLoadedMetadata && videoRef.current) {
        onLoadedMetadata(videoRef.current.duration);
      }
    };

    return (
      <video
        ref={videoRef}
        src={src}
        poster={posterUrl}
        controls
        preload="metadata"
        className={cn("w-full h-full", className)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
      />
    );
  }
);
