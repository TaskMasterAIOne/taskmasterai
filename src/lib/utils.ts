import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Decodes a base64 string into an ArrayBuffer.
 * @param base64 The base64 string to decode.
 * @returns The decoded ArrayBuffer.
 */
export function decode(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback.
 * @param arrayBuffer The raw PCM audio data.
 * @param audioContext The AudioContext to use.
 * @param sampleRate The sample rate of the audio (24kHz for TaskMaster Live output).
 * @param numChannels The number of channels (1 for mono).
 * @returns A promise that resolves with the decoded AudioBuffer.
 */
export async function decodeAudioData(
  arrayBuffer: ArrayBuffer,
  audioContext: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const samples = new Int16Array(arrayBuffer);
  const audioBuffer = audioContext.createBuffer(
    numChannels,
    samples.length,
    sampleRate,
  );
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < samples.length; i++) {
    channelData[i] = samples[i] / 32768.0;
  }

  return audioBuffer;
}


/**
 * Converts a Float32Array of PCM data to a Blob.
 * This is used for sending microphone input to the Gemini API.
 * @param pcmData The Float32Array of PCM data.
 * @returns A Blob containing the audio data.
 */
export function createBlob(pcmData: Float32Array): Blob {
  const VAD_PCM_BIT_DEPTH = 16;
  const buffer = new ArrayBuffer(pcmData.length * (VAD_PCM_BIT_DEPTH / 8));
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], {type: 'audio/l16'});
}
