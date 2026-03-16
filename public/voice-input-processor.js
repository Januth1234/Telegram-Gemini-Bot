/**
 * AudioWorklet processor for voice input. Runs on the audio thread (off main thread).
 * Posts Float32 chunks + sampleRate to the main thread for resampling and sending to Gemini.
 */
class VoiceInputProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.sampleRate = options.processorOptions?.sampleRate || 44100;
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;
    const samples = new Float32Array(input.length);
    samples.set(input);
    this.port.postMessage({ samples: samples.buffer, sampleRate: this.sampleRate }, [samples.buffer]);
    return true;
  }
}

registerProcessor('voice-input-processor', VoiceInputProcessor);
