import { create } from 'zustand';

interface TimelineState {
  currentTime: number;
  timeRange: [number, number];
  isPlaying: boolean;
  playbackSpeed: number;
  setTimeRange: (range: [number, number]) => void;
  setCurrentTime: (time: number) => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  currentTime: 0,
  timeRange: [0, 100],
  isPlaying: false,
  playbackSpeed: 1, // Speed multiplier
  setTimeRange: (range) => set({ timeRange: range, currentTime: range[0] }),
  setCurrentTime: (time) => set({ currentTime: time }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
}));
