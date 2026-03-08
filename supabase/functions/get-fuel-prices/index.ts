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
          messages: [
            {
              role: "system",
              content:
                "You are a fuel price data provider. Return ONLY the JSON object requested, no markdown, no explanation.",
            },
            {
              role: "user",
              content: `What are the current fuel prices in ${city}, India as of ${today}? Return ONLY a JSON object in this exact format: {"petrol": <price_per_liter_INR>, "diesel": <price_per_liter_INR>, "cng": <price_per_kg_INR>, "city": "<city_name>", "date": "${today}"}. Use the most recent known prices. Numbers only, no currency symbols.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_fuel_prices",
                description: "Return current fuel prices for a city in India",
                parameters: {
                  type: "object",
                  properties: {
                    petrol: {
                      type: "number",
                      description: "Petrol price per liter in INR",
                    },
                    diesel: {
                      type: "number",
                      description: "Diesel price per liter in INR",
                    },
                    cng: {
                      type: "number",
                      description: "CNG price per kg in INR",
                    },
                    city: { type: "string", description: "City name" },
                    date: {
                      type: "string",
                      description: "Date of the prices YYYY-MM-DD",
                    },
                  },
                  required: ["petrol", "diesel", "cng", "city", "date"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_fuel_prices" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Failed to fetch fuel prices");
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const prices = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify({ success: true, prices }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    throw new Error("Unexpected AI response format");
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
