import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json().catch(() => ({ city: "Hyderabad" }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

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
          max_tokens: 200,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `You are a fuel price lookup service for India. You must return the most recent real fuel prices you know for any Indian city. Prices should be realistic and non-zero. As a reference: in most Indian cities as of late 2024, petrol is approximately ₹94-110/L, diesel is ₹87-97/L, and CNG is ₹75-90/kg. Prices vary by city and state taxes. Reply with ONLY a raw JSON object, no markdown, no backticks, no explanation.`,
            },
            {
              role: "user",
              content: `Return the latest known fuel prices for ${city}, India as a JSON object with this exact format: {"petrol": <number>, "diesel": <number>, "cng": <number>, "city": "${city}", "date": "${today}"}. All prices must be non-zero realistic values in INR.`,
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    console.log("AI response content:", content);

    // Extract JSON from content (handle markdown code blocks too)
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error("Could not parse fuel prices from AI response");
    }

    const prices = JSON.parse(jsonMatch[0]);

    // Validate non-zero prices
    if (!prices.petrol || !prices.diesel || prices.petrol === 0 || prices.diesel === 0) {
      throw new Error("AI returned zero prices");
    }

    // Ensure all fields exist
    const result = {
      petrol: prices.petrol,
      diesel: prices.diesel,
      cng: prices.cng || 0,
      city: prices.city || city,
      date: prices.date || today,
    };

    return new Response(
      JSON.stringify({ success: true, prices: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-fuel-prices error:", e);
    const isTimeout = e instanceof DOMException && e.name === "AbortError";
    return new Response(
      JSON.stringify({
        success: false,
        error: isTimeout
          ? "Request timed out, please try again"
          : e instanceof Error
          ? e.message
          : "Unknown error",
      }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
