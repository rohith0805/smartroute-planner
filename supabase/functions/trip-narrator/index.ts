const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stops, vehicleType, totalDistance, totalTime, savings } = await req.json();

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "At least 2 stops required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const stopNames = stops.map((s: { name: string }) => s.name).join(" → ");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 1500,
          temperature: 0.8,
          messages: [
            {
              role: "system",
              content: `You are a charismatic Indian radio host narrating a road trip. Your style is fun, energetic, and informative — like an RJ on a popular FM station. Use a mix of English with occasional Hindi expressions (transliterated).

CRITICAL RULES:
- Every fact MUST be historically and geographically accurate for that specific city/place. Do NOT make up or generalize facts.
- Food recommendations must be REAL, famous local dishes and restaurants/street food areas actually known in that city.
- Include REAL landmarks, historical events, cultural traditions, and notable facts specific to each stop.
- If a city is famous for something (e.g., Hyderabad = Biryani & Charminar, Pune = Shaniwar Wada & Vada Pav, Goa = beaches & vindaloo), mention those REAL things.

For EACH stop include:
- 1 verified historical/geographical fun fact specific to that place
- 1 real famous local food dish with a specific place/area to try it
- 1 witty RJ-style comment
- Travel tips between stops (real road conditions, tolls, scenic routes)

End with a dramatic sign-off. Format as markdown with ## for each stop. Keep it concise but entertaining. Use emojis sparingly.`,
            },
            {
              role: "user",
              content: `Narrate this ${vehicleType} road trip: ${stopNames}. Total distance: ${totalDistance} km, estimated time: ${totalTime} minutes.${savings > 0 ? ` The optimized route saves ${savings.toFixed(1)}% distance!` : ""} Give real, accurate facts about each place. Make it fun and memorable!`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limited, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const narration = aiData.choices?.[0]?.message?.content || "";

    if (!narration) {
      throw new Error("Empty narration from AI");
    }

    return new Response(
      JSON.stringify({ success: true, narration }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("trip-narrator error:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
