// src/lib/AudioPlaybackQueue.ts
import { decodeAudioData } from './utils';

export class AudioPlaybackQueue {
  private audioContext: AudioContext;
  private nextPlayTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onPlayingChangeCallback?: (isPlaying: boolean) => void;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  public setOnPlayingChange(callback: (isPlaying: boolean) => void) {
    this.onPlayingChangeCallback = callback;
  }

  public async add(audioData: ArrayBuffer) {

    
    if (this.audioContext.state === 'suspended') {

      await this.audioContext.resume();
    }

    try {
      const audioBuffer = await decodeAudioData(audioData, this.audioContext, 24000, 1);


      this.nextPlayTime = Math.max(
        this.nextPlayTime,
        this.audioContext.currentTime,
      );

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.addEventListener('ended', () => {

        this.sources.delete(source);
        // Notify when no more audio is playing
        if (this.sources.size === 0 && this.onPlayingChangeCallback) {
          this.onPlayingChangeCallback(false);
        }
      });

      // Notify when audio starts playing (first source)
      if (this.sources.size === 0 && this.onPlayingChangeCallback) {
        this.onPlayingChangeCallback(true);
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.sources.add(source);
    } catch (error) {
      console.error("AudioPlaybackQueue: Error decoding audio data:", error);
    }
  }

  public stop() {
    const wasPlaying = this.sources.size > 0;
    for (const source of this.sources.values()) {
      source.stop();
      this.sources.delete(source);
    }
    this.nextPlayTime = 0;
    
    // Notify when audio stops
    if (wasPlaying && this.onPlayingChangeCallback) {
      this.onPlayingChangeCallback(false);
    }
  }
}
