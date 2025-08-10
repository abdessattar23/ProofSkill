import axios from 'axios';
import FormData from 'form-data';
import { elevenLabsCircuitBreaker, elevenLabsSTTCircuitBreaker } from '../lib/circuitBreaker';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Default ElevenLabs voice

export async function synthesizeQuestion(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<Buffer> {
    if (!ELEVENLABS_API_KEY) {
        // Fallback to dummy audio for development
        const dummyWav = Buffer.alloc(44 + 1000); // WAV header + 1000 bytes of silence
        // Basic WAV header
        dummyWav.write('RIFF', 0);
        dummyWav.writeUInt32LE(36 + 1000, 4);
        dummyWav.write('WAVE', 8);
        dummyWav.write('fmt ', 12);
        dummyWav.writeUInt32LE(16, 16);
        dummyWav.writeUInt16LE(1, 20); // PCM
        dummyWav.writeUInt16LE(1, 22); // Mono
        dummyWav.writeUInt32LE(22050, 24); // Sample rate
        dummyWav.writeUInt32LE(22050, 28); // Byte rate
        dummyWav.writeUInt16LE(1, 32); // Block align
        dummyWav.writeUInt16LE(8, 34); // Bits per sample
        dummyWav.write('data', 36);
        dummyWav.writeUInt32LE(1000, 40);
        return dummyWav;
    }

    return elevenLabsCircuitBreaker.execute(async () => {
        const response = await axios.post(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                    style: 0.0,
                    use_speaker_boost: true
                }
            },
            {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY
                },
                responseType: 'arraybuffer',
                timeout: 30000 // 30 second timeout
            }
        );

        return Buffer.from(response.data);
    });
}

export async function transcribeAudio(audio: Buffer, filename?: string): Promise<string> {
    if (!ELEVENLABS_API_KEY) {
        // Fallback for development
        return `Transcript placeholder for ${filename || 'audio file'}`;
    }

    return elevenLabsSTTCircuitBreaker.execute(async () => {
        const formData = new FormData();
        formData.append('file', audio, {
            filename: filename || 'audio.mp3',
            contentType: 'audio/mpeg'
        });
        formData.append('model_id', 'scribe_v1');

        const response = await axios.post(
            'https://api.elevenlabs.io/v1/speech-to-text',
            formData,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    ...formData.getHeaders()
                },
                timeout: 60000 // 60 second timeout for transcription
            }
        );

        return response.data.text;
    });
}

export async function getAvailableVoices(): Promise<any[]> {
    if (!ELEVENLABS_API_KEY) {
        return [
            { voice_id: DEFAULT_VOICE_ID, name: 'Default Voice', category: 'premade' }
        ];
    }

    return elevenLabsCircuitBreaker.execute(async () => {
        const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY
            },
            timeout: 10000 // 10 second timeout
        });

        return response.data.voices;
    });
}
