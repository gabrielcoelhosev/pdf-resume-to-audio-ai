import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY não encontrada no ambiente. Verifique o arquivo .env");
}

const ai = new GoogleGenAI({ apiKey });

export async function summarizePdf(
  base64Pdf: string,
  language: string = "pt",
  isShort: boolean = false
): Promise<string> {
  const languageInstruction =
    language === "pt"
      ? "Responda em Português do Brasil."
      : `Respond in ${language}.`;

  const brevityInstruction = isShort
    ? "SEJA EXTREMAMENTE CONCISO E BREVE (máximo 3 parágrafos curtos). Foque no essencial para o áudio ser rápido."
    : "Extraia os pontos principais do documento e crie um resumo claro e bem estruturado.";

  // Usando o ID exato encontrado na descoberta de modelos para evitar 404
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest", 
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            text: `Você é um assistente especializado em leitura e síntese de documentos.
Analise o PDF fornecido e faça o seguinte:

${brevityInstruction}
Use tópicos ou seções quando adequado para facilitar a leitura.
Inclua informações essenciais como: tema central, argumentos ou dados principais, e conclusões.

${languageInstruction}`,
          },
        ],
      },
    ],
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini não retornou uma resposta válida");
  }

  return text;
}

/**
 * Converte texto em áudio usando o Gemini TTS.
 * Usando o modelo gemini-2.5-flash-preview-tts encontrado na lista de modelos.
 */
export async function textToSpeech(
  text: string,
  voiceName: string = "Aoede"
): Promise<{ audio: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ role: "user", parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];

  if (!part?.inlineData?.data) {
    throw new Error("Gemini TTS não retornou áudio válido");
  }

  // O Gemini 2.5 TTS retorna PCM bruto (MIME audio/pcm; rate=24000).
  // Navegadores não tocam PCM puro sem cabeçalho WAV.
  const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
  const wavBuffer = addWavHeader(pcmBuffer, 24000);

  return {
    audio: wavBuffer.toString("base64"),
    mimeType: "audio/wav",
  };
}

/**
 * Adiciona um cabeçalho RIFF/WAV de 44 bytes para dados PCM lineares de 16-bit.
 */
function addWavHeader(pcmData: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmData.length;

  // RIFF identifier
  header.write("RIFF", 0);
  // File size (dataSize + 36 bytes for header)
  header.writeUInt32LE(dataSize + 36, 4);
  // WAVE identifier
  header.write("WAVE", 8);
  // fmt chunk identifier
  header.write("fmt ", 12);
  // fmt chunk size (16 for PCM)
  header.writeUInt32LE(16, 16);
  // Audio format (1 for PCM)
  header.writeUInt16LE(1, 20);
  // Number of channels (1 for mono)
  header.writeUInt16LE(1, 22);
  // Sample rate
  header.writeUInt32LE(sampleRate, 24);
  // Byte rate (sampleRate * channels * bitsPerSample / 8)
  header.writeUInt32LE(sampleRate * 2, 28);
  // Block align (channels * bitsPerSample / 8)
  header.writeUInt16LE(2, 32);
  // Bits per sample
  header.writeUInt16LE(16, 34);
  // data chunk identifier
  header.write("data", 36);
  // data chunk size
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}
