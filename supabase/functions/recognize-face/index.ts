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
    
    console.log('Received imageBase64 length:', imageBase64?.length || 0);
    console.log('Received imageBase64 prefix:', imageBase64?.substring(0, 100) || 'null');
    
    if (!imageBase64 || imageBase64.length < 100) {
      return new Response(
        JSON.stringify({ error: 'Valid image is required. Image data is too small or missing.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and clean the image data URL
    let imageUrl: string;
    
    // Check if it's a valid data URL with actual base64 content
    const dataUrlMatch = imageBase64.match(/^data:(image\/[a-zA-Z+-]+);base64,([A-Za-z0-9+/]+=*)$/);
    
    if (dataUrlMatch) {
      // Valid data URL format
      const mimeType = dataUrlMatch[1];
      const base64Data = dataUrlMatch[2];
      
      if (base64Data.length < 100) {
        return new Response(
          JSON.stringify({ error: 'Image data is too small. Please capture a valid image.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      imageUrl = `data:${mimeType};base64,${base64Data}`;
    } else if (imageBase64.startsWith('data:')) {
      // Has data: prefix but might have issues - try to extract base64
      const base64Part = imageBase64.replace(/^data:[^;]+;base64,/, '');
      if (base64Part.length < 100 || base64Part === imageBase64) {
        return new Response(
          JSON.stringify({ error: 'Invalid image format. Please try capturing again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      imageUrl = `data:image/jpeg;base64,${base64Part}`;
    } else {
      // Raw base64 without prefix
      if (imageBase64.length < 100) {
        return new Response(
          JSON.stringify({ error: 'Image data is too small.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      imageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    console.log('Processed imageUrl length:', imageUrl.length);
    console.log('Processed imageUrl prefix:', imageUrl.substring(0, 60));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt with registered students including their face images
    const studentsWithPhotos = registeredStudents?.filter((s: any) => s.face_image_url) || [];
    const studentsInfo = registeredStudents?.map((s: any) => 
      `Student ID: ${s.student_id}, Name: ${s.name}${s.face_image_url ? ' (has reference photo)' : ' (no reference photo)'}`
    ).join('\n') || 'No students registered';

    const systemPrompt = `You are a face recognition assistant for an attendance system. 
Your task is to compare faces in the CAPTURED IMAGE against the REFERENCE PHOTOS of registered students.

Registered students in this class:
${studentsInfo}

Instructions:
1. First, analyze the CAPTURED IMAGE (the last image) for any human faces
2. Then compare each detected face against the REFERENCE PHOTOS (the first ${studentsWithPhotos.length} images)
3. Look for matching facial features: face shape, eyes, nose, mouth, hair, etc.
4. Return a JSON response with the following structure:
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

IMPORTANT: Only mark a student as recognized if you are reasonably confident the face matches.
If no face is detected or students cannot be identified, indicate that clearly.
Be honest about confidence levels - if unsure, use lower confidence scores.`;

    // Build message content with reference photos first, then the captured image
    const messageContent: any[] = [
      {
        type: 'text',
        text: `I will show you reference photos of registered students, then a captured image. Please identify which students (if any) appear in the captured image.\n\nReference photos of students:`
      }
    ];

    // Add reference photos for each student with a face image
    for (const student of studentsWithPhotos) {
      messageContent.push({
        type: 'text',
        text: `\nStudent: ${student.name} (ID: ${student.student_id})`
      });
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: student.face_image_url
        }
      });
    }

    // Add the captured image last
    messageContent.push({
      type: 'text',
      text: '\n\nNow here is the CAPTURED IMAGE to analyze for attendance:'
    });
    messageContent.push({
      type: 'image_url',
      image_url: {
        url: imageUrl
      }
    });

    console.log('Sending request with', studentsWithPhotos.length, 'reference photos');

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
          { role: 'user', content: messageContent }
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
