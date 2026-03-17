const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Voice IDs for different languages
const VOICE_MAP: Record<string, { voiceId: string; modelId: string }> = {
  en: { voiceId: "JBFqnCBsd6RMkjVDRZzb", modelId: "eleven_multilingual_v2" }, // George
  hi: { voiceId: "JBFqnCBsd6RMkjVDRZzb", modelId: "eleven_multilingual_v2" }, // George (multilingual)
  te: { voiceId: "JBFqnCBsd6RMkjVDRZzb", modelId: "eleven_multilingual_v2" }, // George (multilingual)
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const lang = language || "en";
    const config = VOICE_MAP[lang] || VOICE_MAP.en;

    // Truncate to stay within credit limits
    const truncatedText = text.length > 1000 ? text.substring(0, 1000) + "..." : text;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: truncatedText,
          model_id: config.modelId,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
            speed: lang === "en" ? 1.05 : 0.95,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);

      if (response.status === 401) {
        const errorData = JSON.parse(errorText).detail || {};
        const message = errorData.status === "quota_exceeded"
          ? `Quota exceeded: ${errorData.message}`
          : "Invalid ElevenLabs API key";
        return new Response(
          JSON.stringify({ error: message }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("elevenlabs-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
