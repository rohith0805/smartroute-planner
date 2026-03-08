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
    const { city } = await req.json().catch(() => ({ city: "Hyderabad" }));
    console.log("Fetching fuel prices for:", city);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          max_tokens: 200,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You are a fuel price database for India. You must return realistic, accurate, non-zero fuel prices. As of your latest knowledge: Petrol in Hyderabad is around ₹109.66/L, Diesel ₹97.82/L. Mumbai petrol is ₹106.31/L. Delhi petrol is ₹94.72/L. CNG in Delhi is ₹76/kg, in Mumbai ₹78/kg. Always provide your best known prices. NEVER return 0. Reply with ONLY a JSON object, no other text.",
            },
            {
              role: "user",
              content: `Latest fuel prices for ${city}, India. Return ONLY: {"petrol": <price>, "diesel": <price>, "cng": <price>, "city": "${city}", "date": "${today}"}`,
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
    console.log("AI raw response:", JSON.stringify(aiData.choices?.[0]?.message));

    // Try tool_calls first
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let prices;

    if (toolCall?.function?.arguments) {
      prices = JSON.parse(toolCall.function.arguments);
      console.log("Parsed from tool_calls:", JSON.stringify(prices));
    } else {
      // Parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      console.log("AI content:", content);
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("Could not parse JSON from AI response");
      }
      prices = JSON.parse(jsonMatch[0]);
    }

    console.log("Parsed prices:", JSON.stringify(prices));

    // Validate - if zeros, use fallback prices
    if (!prices.petrol || prices.petrol === 0 || !prices.diesel || prices.diesel === 0) {
      console.warn("AI returned zero prices, using fallback");
      prices = getFallbackPrices(city);
    }

    const result = {
      petrol: Number(prices.petrol),
      diesel: Number(prices.diesel),
      cng: Number(prices.cng) || getFallbackCNG(city),
      city: prices.city || city,
      date: today,
    };

    return new Response(
      JSON.stringify({ success: true, prices: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-fuel-prices error:", e);
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

// Fallback prices based on known Indian city fuel prices (late 2024 data)
function getFallbackPrices(city: string): { petrol: number; diesel: number; cng: number; city: string } {
  const c = city.toLowerCase();
  const cityPrices: Record<string, { petrol: number; diesel: number; cng: number }> = {
    "hyderabad": { petrol: 109.66, diesel: 97.82, cng: 78.00 },
    "mumbai": { petrol: 106.31, diesel: 94.27, cng: 78.00 },
    "delhi": { petrol: 94.72, diesel: 87.62, cng: 76.59 },
    "bangalore": { petrol: 101.94, diesel: 87.89, cng: 72.00 },
    "bengaluru": { petrol: 101.94, diesel: 87.89, cng: 72.00 },
    "chennai": { petrol: 100.85, diesel: 92.44, cng: 80.00 },
    "kolkata": { petrol: 104.95, diesel: 91.76, cng: 79.00 },
    "pune": { petrol: 106.03, diesel: 92.60, cng: 73.50 },
    "ahmedabad": { petrol: 94.38, diesel: 90.30, cng: 72.00 },
    "jaipur": { petrol: 104.88, diesel: 90.36, cng: 78.00 },
    "lucknow": { petrol: 94.65, diesel: 87.60, cng: 76.00 },
    "guntur": { petrol: 109.66, diesel: 97.82, cng: 78.00 },
    "vijayawada": { petrol: 109.66, diesel: 97.82, cng: 78.00 },
    "tenali": { petrol: 109.66, diesel: 97.82, cng: 78.00 },
  };

  const match = cityPrices[c] || { petrol: 103.00, diesel: 92.00, cng: 77.00 };
  return { ...match, city };
}

function getFallbackCNG(city: string): number {
  return getFallbackPrices(city).cng;
}
