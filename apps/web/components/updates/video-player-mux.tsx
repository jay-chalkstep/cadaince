"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type MuxPlayerElement from "@mux/mux-player";

export interface VideoPlayerMuxHandle {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerMuxProps {
  playbackId: string;
  thumbnailUrl?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const VideoPlayerMux = forwardRef<VideoPlayerMuxHandle, VideoPlayerMuxProps>(
  function VideoPlayerMux({ playbackId, thumbnailUrl, className, onTimeUpdate }, ref) {
    const playerRef = useRef<MuxPlayerElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (playerRef.current) {
          playerRef.current.currentTime = time;
        }
      },
      play: () => {
        playerRef.current?.play();
      },
      pause: () => {
        playerRef.current?.pause();
      },
      getCurrentTime: () => {
        return playerRef.current?.currentTime ?? 0;
      },
    }));

    const handleTimeUpdate = () => {
      if (onTimeUpdate && playerRef.current) {
        onTimeUpdate(playerRef.current.currentTime);
      }
    };

    return (
      <MuxPlayer
        ref={playerRef}
        playbackId={playbackId}
        poster={thumbnailUrl}
        streamType="on-demand"
        autoPlay={false}
        muted={false}
        preload="metadata"
        className={className}
        onTimeUpdate={handleTimeUpdate}
      />
    );
  }
);
