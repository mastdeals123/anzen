import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailParseRequest {
  emailSubject: string;
  emailBody: string;
  fromEmail: string;
  fromName?: string;
}

interface ParsedInquiry {
  productName: string;
  quantity: string;
  supplierName?: string;
  supplierCountry?: string;
  companyName: string;
  contactPerson?: string;
  contactEmail: string;
  contactPhone?: string;
  coaRequested: boolean;
  msdsRequested: boolean;
  sampleRequested: boolean;
  priceRequested: boolean;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  remarks?: string;
  confidence: 'high' | 'medium' | 'low';
  detectedLanguage: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { emailSubject, emailBody, fromEmail, fromName }: EmailParseRequest = await req.json();

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an AI assistant specialized in parsing pharmaceutical industry inquiry emails. Extract key information from emails written in Indonesian or English.

Your task is to analyze the email and extract:
1. Product name (e.g., "Sodium Hypophosphite Pharma Grade IHS")
2. Quantity with units (e.g., "150 KG", "2 MT")
3. Supplier/Manufacturer name if mentioned
4. Country of origin if mentioned (Japan, China, India, etc.)
5. Company name from signature or context
6. Contact person name
7. Whether COA (Certificate of Analysis) is requested
8. Whether MSDS (Material Safety Data Sheet) is requested
9. Whether sample is requested
10. Whether price quotation is requested
11. Urgency level based on keywords like "urgent", "ASAP", "segera", "mendesak"
12. Any additional remarks or special requirements
13. Phone/WhatsApp number if present
14. Detect the primary language (Indonesian or English)

Return a JSON object with the extracted information. If information is not found, use null or false for boolean fields.`;

    const userPrompt = `Parse this pharmaceutical inquiry email:

SUBJECT: ${emailSubject}
FROM: ${fromName || ''} <${fromEmail}>

BODY:
${emailBody}

Respond with a JSON object containing the extracted information.`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = JSON.parse(openaiData.choices[0].message.content);

    const parsedInquiry: ParsedInquiry = {
      productName: aiResponse.productName || aiResponse.product_name || '',
      quantity: aiResponse.quantity || '',
      supplierName: aiResponse.supplierName || aiResponse.supplier_name || aiResponse.supplier || null,
      supplierCountry: aiResponse.supplierCountry || aiResponse.supplier_country || aiResponse.country || null,
      companyName: aiResponse.companyName || aiResponse.company_name || aiResponse.company || 'Unknown',
      contactPerson: aiResponse.contactPerson || aiResponse.contact_person || aiResponse.contact || fromName || null,
      contactEmail: fromEmail,
      contactPhone: aiResponse.contactPhone || aiResponse.contact_phone || aiResponse.phone || aiResponse.whatsapp || null,
      coaRequested: aiResponse.coaRequested || aiResponse.coa_requested || aiResponse.coa || false,
      msdsRequested: aiResponse.msdsRequested || aiResponse.msds_requested || aiResponse.msds || false,
      sampleRequested: aiResponse.sampleRequested || aiResponse.sample_requested || aiResponse.sample || false,
      priceRequested: aiResponse.priceRequested || aiResponse.price_requested || aiResponse.price || true,
      urgency: aiResponse.urgency || 'medium',
      remarks: aiResponse.remarks || aiResponse.notes || aiResponse.additional_info || null,
      confidence: aiResponse.confidence || 'medium',
      detectedLanguage: aiResponse.detectedLanguage || aiResponse.language || 'unknown',
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedInquiry,
        rawAiResponse: aiResponse
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error parsing email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to parse email'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});