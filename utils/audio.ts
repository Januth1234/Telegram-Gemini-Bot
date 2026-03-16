/**
 * Decode base64 string to Uint8Array. Reused by voice components and Lyria recording.
 */
export function decodeBase64(base64: string): Uint8Array {
  const b = atob(base64);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return bytes;
}

/**
 * Lyria sends audio in audioChunk.data as base64 PCM (16-bit stereo).
 * Collect chunks into a buffer and assemble into a WAV file when the user hits Download.
 */
export const LYRIA_SAMPLE_RATE = 48000;
export const LYRIA_CHANNELS = 2;

/** Decode base64 PCM from Lyria into Int16Array (interleaved L/R). */
export function base64PcmToInt16(base64: string): Int16Array {
  const bytes = decodeBase64(base64);
  return new Int16Array(bytes.buffer);
}

/**
 * Assemble collected Int16 PCM chunks (interleaved stereo) into a WAV Blob.
 */
export function buildWavBlob(
  samples: Int16Array,
  sampleRate: number = LYRIA_SAMPLE_RATE,
  numChannels: number = LYRIA_CHANNELS
): Blob {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const write = (offset: number, value: number) => view.setUint32(offset, value, true);
  const write16 = (offset: number, value: number) => view.setUint16(offset, value, true);
  const writeStr = (offset: number, str: string) =>
    str.split('').forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));

  writeStr(0, 'RIFF');
  write(4, 36 + dataLength);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  write(16, 16);
  write16(20, 1);
  write16(22, numChannels);
  write(24, sampleRate);
  write(28, sampleRate * numChannels * 2);
  write16(32, numChannels * 2);
  write16(34, 16);
  writeStr(36, 'data');
  write(40, dataLength);
  const out = new Int16Array(buffer, 44);
  out.set(samples);
  return new Blob([buffer], { type: 'audio/wav' });
}
