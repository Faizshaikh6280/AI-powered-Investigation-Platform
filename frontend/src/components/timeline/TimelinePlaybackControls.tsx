import React, { useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, RotateCcw, FastForward, Clock
} from 'lucide-react';
import { useTimelineStore } from '../../store/useTimelineStore';
import { cn } from '../../utils/cn';

const SPEEDS = [1, 2, 5, 10];

export const TimelinePlaybackControls: React.FC = () => {
  const {
    currentTime,
    setCurrentTime,
    timeRange,
    isPlaying,
    togglePlay,
    playbackSpeed,
    setPlaybackSpeed,
    stepForward,
    stepBackward
  } = useTimelineStore();

  const animationFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(Date.now());

  // Animation / Interval Loop for Playback
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    lastTickRef.current = Date.now();

    const loop = () => {
      const now = Date.now();
      const elapsedMs = now - lastTickRef.current;
      lastTickRef.current = now;

      const totalSpan = Math.max(1, timeRange[1] - timeRange[0]);
      // Simulation advance: progress across span in ~30 seconds at 1x
      const advanceRate = (totalSpan / 30000) * playbackSpeed;
      const nextTime = currentTime + elapsedMs * advanceRate;

      if (nextTime >= timeRange[1]) {
        setCurrentTime(timeRange[1]);
        togglePlay(); // Pause at end
      } else {
        setCurrentTime(nextTime);
        animationFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, currentTime, timeRange, playbackSpeed, setCurrentTime, togglePlay]);

  const progressPercent = timeRange[1] > timeRange[0]
    ? Math.min(100, Math.max(0, ((currentTime - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100))
    : 0;

  const currentFormatted = currentTime > 0
    ? new Date(currentTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '--:--:--';

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    const targetTime = timeRange[0] + (pct / 100) * (timeRange[1] - timeRange[0]);
    setCurrentTime(targetTime);
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/90 backdrop-blur-md gap-4 z-20">
      {/* Play / Step Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => stepBackward()}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
          title="Step Backward"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className={cn(
            "p-2 rounded-full transition-all shadow-sm flex items-center justify-center",
            isPlaying
              ? "bg-amber-500 text-black hover:bg-amber-400"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          title={isPlaying ? "Pause Playback" : "Play Chronological Sequence"}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => stepForward()}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
          title="Step Forward"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-md border border-border ml-2">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded transition-colors",
                playbackSpeed === s
                  ? "bg-card text-primary shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Time Scrubber Slider */}
      <div className="flex-1 flex items-center gap-3 max-w-2xl">
        <span className="text-[10px] font-mono text-muted-foreground">
          {timeRange[0] > 0 ? new Date(timeRange[0]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
        </span>

        <div className="flex-1 relative flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPercent}
            onChange={handleScrubberChange}
            className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary border border-border focus:outline-none"
          />
        </div>

        <span className="text-[10px] font-mono text-muted-foreground">
          {timeRange[1] > 0 ? new Date(timeRange[1]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '23:59'}
        </span>
      </div>

      {/* Current Scrubber Timestamp Display */}
      <div className="flex items-center gap-2 bg-secondary/60 border border-border px-3 py-1 rounded-md">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-mono font-bold text-foreground">{currentFormatted}</span>
      </div>
    </div>
  );
};
