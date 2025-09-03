// src/lib/audio-processor.js

class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channelData = input[0];
    
    // Send the raw PCM data back to the main thread
    if (channelData) {
      this.port.postMessage(channelData);
    }

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
