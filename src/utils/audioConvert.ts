import { Mp3Encoder } from '@breezystack/lamejs';

const OPUS_RE = /\.(opus|ogg|oga|webm|m4a|aac|flac)$/i;

/** Formatos que a ElevenLabs aceita diretamente */
export function needsMp3Conversion(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.includes('mpeg') || type.includes('mp3') || type.includes('wav')) return false;
  if (type.includes('opus') || type.includes('ogg') || type.includes('webm')) return true;
  return OPUS_RE.test(file.name);
}

function audioBufferToMp3(buffer: AudioBuffer): Blob {
  // Mixdown para mono
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
  }

  // Float -> PCM 16 bits
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const sampleRate = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(buffer.sampleRate)
    ? buffer.sampleRate
    : 44100;

  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const blocks: Uint8Array[] = [];
  const CHUNK = 1152;
  for (let i = 0; i < pcm.length; i += CHUNK) {
    const chunk = pcm.subarray(i, i + CHUNK);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) blocks.push(new Uint8Array(buf));
  }
  const end = encoder.flush();
  if (end.length > 0) blocks.push(new Uint8Array(end));

  return new Blob(blocks as BlobPart[], { type: 'audio/mpeg' });
}

/**
 * Converte áudios .opus/.ogg/.webm etc. para MP3 no navegador.
 * Arquivos já compatíveis (mp3/wav) são retornados sem alteração.
 */
export async function convertAudioToMp3(file: File): Promise<File> {
  if (!needsMp3Conversion(file)) return file;

  const arrayBuffer = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const mp3Blob = audioBufferToMp3(decoded);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'audio';
    return new File([mp3Blob], `${baseName}.mp3`, { type: 'audio/mpeg' });
  } finally {
    ctx.close().catch(() => {});
  }
}
