import { Elysia, t } from "elysia";
import { summarizePdf, textToSpeech } from "../services/gemini";

export const pdfRoutes = new Elysia({ prefix: "/pdf" }).post(
  "/summarize",
  async ({ body, set }) => {
    const { pdf, language = "pt", audio = false } = body;

    // Limpa o prefixo do base64 se existir (ex: data:application/pdf;base64,...)
    const cleanBase64 = pdf.includes("base64,")
      ? pdf.split("base64,")[1]
      : pdf;

    // Valida se a string parece ser um base64 válido
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64.trim())) {
      set.status = 400;
      return {
        error: "O campo 'pdf' não é um base64 válido.",
      };
    }

    try {
      // 1. Resumir o PDF com Gemini
      // Passamos 'audio' como 'isShort' para que o resumo seja breve se houver áudio
      const summary = await summarizePdf(cleanBase64, language, audio);

      // 2. Se audio=true, converter o resumo em áudio
      if (audio) {
        const { audio: audioBase64, mimeType } = await textToSpeech(summary);
        return {
          success: true,
          summary,
          audio: audioBase64,
          audioMimeType: mimeType,
          audioNote:
            "Decodifique o campo 'audio' de base64 e salve como .wav para ouvir.",
        };
      }

      return {
        success: true,
        summary,
      };
    } catch (err: any) {
      console.error("[PDF Route] Erro ao processar PDF:", err?.message ?? err);
      set.status = 500;
      return {
        error: "Erro ao processar o PDF com o Gemini.",
        details: err?.message ?? "Erro desconhecido",
      };
    }
  },
  {
    body: t.Object({
      pdf: t.String({
        description: "PDF codificado em base64",
        minLength: 1,
      }),
      language: t.Optional(
        t.String({
          description: "Idioma da resposta (padrão: 'pt')",
          examples: ["pt", "en", "es"],
        })
      ),
      audio: t.Optional(
        t.Boolean({
          description:
            "Se true, retorna o resumo também como áudio em base64 (WAV)",
          default: false,
        })
      ),
    }),
    detail: {
      summary: "Resumir PDF com Gemini",
      description:
        "Recebe um PDF em base64 e retorna um resumo em texto. Com audio:true, inclui também o áudio gerado pelo Gemini TTS.",
      tags: ["PDF"],
    },
  }
);
