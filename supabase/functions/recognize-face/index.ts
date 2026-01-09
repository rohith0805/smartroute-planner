import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, classId, registeredStudents } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt with registered students
    const studentsInfo = registeredStudents?.map((s: any) => 
      `Student ID: ${s.student_id}, Name: ${s.name}`
    ).join('\n') || 'No students registered';

    const systemPrompt = `You are a face recognition assistant for an attendance system. 
Your task is to analyze the captured image and identify if any faces match the registered students.

Registered students in this class:
${studentsInfo}

Instructions:
1. Analyze the image for any human faces
2. If you detect faces, try to identify them based on facial features
3. Return a JSON response with the following structure:
{
  "detected": true/false,
  "faces_count": number,
  "recognized_students": [
    {
      "student_id": "the student ID if recognized",
      "name": "student name",
      "confidence": 0.0-1.0
    }
  ],
  "message": "Description of what you detected"
}

If no face is detected or students cannot be identified, indicate that clearly.
Be honest about confidence levels - if unsure, use lower confidence scores.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this image and identify any students for attendance marking.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || '';
    
    // Try to parse JSON from the response
    let result;
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = {
          detected: false,
          faces_count: 0,
          recognized_students: [],
          message: content
        };
      }
    } catch (parseError) {
      result = {
        detected: false,
        faces_count: 0,
        recognized_students: [],
        message: content
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in recognize-face:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
