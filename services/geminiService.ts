/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { ConversationTurn } from "../types";

// Initialize Gemini Client
// Note: We use process.env.API_KEY as per instructions.
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Audio Decoding Helper
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  // Simple check for uncompressed PCM vs WAV header is tricky without parsing.
  // Gemini TTS returns raw PCM.
  
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function createWavBlob(samples: Uint8Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length);
  const view = new DataView(buffer);
  
  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length, true);

  const dataView = new Uint8Array(buffer, 44);
  dataView.set(samples);

  return new Blob([buffer], { type: 'audio/wav' });
}

export interface GeneratedAudio {
  buffer: AudioBuffer;
  rawData: Uint8Array;
}

export const generateSpeech = async (
  text: string, 
  voiceName: string,
  styleInstruction?: string
): Promise<GeneratedAudio> => {
  const ai = getClient();
  
  const speakerName = 'Speaker';
  // Use speaker labeling to distinguish instructions from the text to be spoken.
  const fullInputText = styleInstruction 
    ? `${styleInstruction}\n\n${speakerName}: ${text}` 
    : `${speakerName}: ${text}`;

  // We need a second speaker to satisfy the API requirement of exactly 2 speakers for multiSpeakerVoiceConfig.
  const dummySpeakerName = 'Interactant'; 
  const dummyVoiceName = 'Puck'; 

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullInputText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speakerName,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName },
                }
              },
              {
                speaker: dummySpeakerName,
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: dummyVoiceName },
                }
              }
            ]
          }
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini.");
    }

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000, 
    });

    try {
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
      
      return { buffer: audioBuffer, rawData: audioBytes };
    } finally {
      await outputAudioContext.close();
    }

  } catch (error) {
    console.error("Error generating speech:", error);
    if (typeof error === 'object' && error !== null) {
      console.error("Detailed Error Details:", JSON.stringify(error, null, 2));
    }
    throw error;
  }
};

export const dramatizeText = async (text: string, styleInstruction?: string): Promise<string> => {
  const ai = getClient();
  
  const persona = styleInstruction 
    ? `役職/シチュエーション: ${styleInstruction}` 
    : `スタイル: 人狼ゲームにおけるドラマチックな会話。プレイヤーを没入させる演技。`;

  try {
    const prompt = `
      この人狼ゲーム（パーティーゲーム）のセリフや状況説明を、指定された【役職】や【シチュエーション】に合わせて、より魅力的で「それっぽい」セリフに書き直してください。
      
      ${persona}
      
      ガイドライン:
      1. **ロールプレイ**: 指定された役職（人狼、占い師、村人など）になりきり、その心理状態（焦り、欺瞞、自信など）を反映させる。
      2. **臨場感**: ゲームの議論中や夜の行動時のような、緊迫感や雰囲気を出す。
      3. **自然な口語**: 台本読みではなく、その場で発せられた言葉のように。
      4. **長さの維持**: 元のテキストの意図を大きく変えずに、表現を豊かにする。
      5. **フォーマット**: 書き直したテキストのみを引用符なしで返すこと。
      
      入力テキスト:
      "${text}"
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text || text;
  } catch (error) {
    console.error("Error dramatizing text:", error);
    throw error;
  }
};

const SCRIPT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    turns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          roleId: { type: Type.STRING },
          text: { type: Type.STRING }
        }
      }
    }
  }
};

export const generateConversationScript = async (sceneDescription: string, availableRoleIds: string[]): Promise<ConversationTurn[]> => {
  const ai = getClient();
  
  const prompt = `
    You are a scriptwriter for a "Werewolf" (Jinro) game audio drama.
    Create a short, intense dialogue script (4 to 6 turns) based on the user's scene description.

    Scene Description:
    "${sceneDescription}"

    Available Roles (Use ONLY these IDs):
    ${availableRoleIds.join(', ')}

    Requirements:
    - Return a JSON object with a "turns" property, which is an array of objects.
    - Each object must have "roleId" (one of the available roles) and "text" (the dialogue).
    - The dialogue should be dramatic, immersive, and fit the Werewolf game atmosphere.
    - Use Japanese for the dialogue text.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCRIPT_SCHEMA
      }
    });

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);
    return data.turns || [];
  } catch (error) {
    console.error("Error generating conversation script:", error);
    throw error;
  }
};

export const generateDayDiscussionScript = async (sceneDescription: string, availableRoleIds: string[]): Promise<ConversationTurn[]> => {
  const ai = getClient();
  
  const prompt = `
    You are a scriptwriter for a "Werewolf" (Jinro) game daytime discussion.
    Create a fast-paced, accusatory dialogue script (5 to 8 turns) where players are debating who the werewolf is.

    Context/Topic:
    "${sceneDescription}"

    Available Roles (Use ONLY these IDs):
    ${availableRoleIds.join(', ')}

    Requirements:
    - **Tone**: Urgent, suspicious, defensive, aggressive. Players are fighting for their lives.
    - **Content**: Accusations ("You are quiet today", "Your logic is flawed"), Defenses ("I am a villager!"), and Confusion.
    - **Length**: Sentences should be relatively short and punchy to simulate a heated debate.
    - Return a JSON object with a "turns" property (array of {roleId, text}).
    - Use Japanese.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCRIPT_SCHEMA
      }
    });

    const jsonStr = response.text || "{}";
    const data = JSON.parse(jsonStr);
    return data.turns || [];
  } catch (error) {
    console.error("Error generating day discussion script:", error);
    throw error;
  }
};