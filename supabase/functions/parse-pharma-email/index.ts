import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  purposeIcons: string[];
  deliveryDateExpected?: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  remarks?: string;
  confidence: 'high' | 'medium' | 'low';
  confidenceScore: number;
  detectedLanguage: string;
  autoDetectedCompany: boolean;
  autoDetectedContact: boolean;
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const domain = fromEmail.split('@')[1]?.toLowerCase();
    let companyFromDomain = null;
    let autoDetectedCompany = false;

    if (domain) {
      const { data: domainMapping } = await supabase
        .from('crm_company_domain_mapping')
        .select('company_name, confidence_score')
        .eq('email_domain', domain)
        .maybeSingle();

      if (domainMapping) {
        companyFromDomain = domainMapping.company_name;
        autoDetectedCompany = true;

        await supabase
          .from('crm_company_domain_mapping')
          .update({ 
            match_count: supabase.rpc('increment', { row_id: domain }),
            last_matched: new Date().toISOString() 
          })
          .eq('email_domain', domain);
      }
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to Supabase Edge Function secrets.',
          fallbackData: {
            productName: '',
            quantity: '',
            companyName: companyFromDomain || 'Unknown Company',
            contactPerson: fromName || null,
            contactEmail: fromEmail,
            coaRequested: false,
            msdsRequested: false,
            sampleRequested: false,
            priceRequested: true,
            purposeIcons: ['price'],
            urgency: 'medium' as const,
            confidence: 'low' as const,
            confidenceScore: 0.3,
            detectedLanguage: 'unknown',
            autoDetectedCompany,
            autoDetectedContact: false,
          }
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const systemPrompt = `You are an AI assistant specialized in parsing pharmaceutical industry inquiry emails. Extract key information from emails written in Indonesian or English.

Your task is to analyze the email and extract:
1. Product name (e.g., "Sodium Hypophosphite Pharma Grade IHS", "Triamcinolone Acetonide USP")
2. Quantity with units (e.g., "150 KG", "2 MT", "500 units")
3. Supplier/Manufacturer name if mentioned (e.g., "Omochi Seiyaku", "Pfizer")
4. Country of origin if mentioned (Japan, China, India, USA, etc.)
5. Company name from signature or context (prioritize email signature)
6. Contact person name (from signature or greeting)
7. Whether COA (Certificate of Analysis) is requested
8. Whether MSDS (Material Safety Data Sheet) is requested
9. Whether sample is requested
10. Whether price quotation is requested
11. Expected delivery date or timeframe (e.g., "November 2024", "ASAP", "2 weeks")
12. Urgency level based on keywords like "urgent", "ASAP", "segera", "mendesak"
13. Any additional remarks or special requirements
14. Phone/WhatsApp number if present
15. Detect the primary language (Indonesian or English)
16. Confidence score (0.0 to 1.0) for the extraction accuracy

IMPORTANT: Purpose icons should be an array containing any of: ['price', 'coa', 'msds', 'sample'] based on what is requested.

Return a JSON object with the following structure:
{
  "productName": string,
  "quantity": string,
  "supplierName": string | null,
  "supplierCountry": string | null,
  "companyName": string,
  "contactPerson": string | null,
  "contactPhone": string | null,
  "coaRequested": boolean,
  "msdsRequested": boolean,
  "sampleRequested": boolean,
  "priceRequested": boolean,
  "purposeIcons": string[],
  "deliveryDateExpected": string | null,
  "urgency": "low" | "medium" | "high" | "urgent",
  "remarks": string | null,
  "confidence": "high" | "medium" | "low",
  "confidenceScore": number,
  "detectedLanguage": string
}`;

    const userPrompt = `Parse this pharmaceutical inquiry email:

SUBJECT: ${emailSubject}
FROM: ${fromName || ''} <${fromEmail}>
${companyFromDomain ? `\nKNOWN COMPANY (from domain): ${companyFromDomain}` : ''}

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

    const purposeIcons: string[] = [];
    if (aiResponse.priceRequested || aiResponse.price_requested || aiResponse.price) purposeIcons.push('price');
    if (aiResponse.coaRequested || aiResponse.coa_requested || aiResponse.coa) purposeIcons.push('coa');
    if (aiResponse.msdsRequested || aiResponse.msds_requested || aiResponse.msds) purposeIcons.push('msds');
    if (aiResponse.sampleRequested || aiResponse.sample_requested || aiResponse.sample) purposeIcons.push('sample');
    if (purposeIcons.length === 0) purposeIcons.push('price');

    const extractedCompany = aiResponse.companyName || aiResponse.company_name || aiResponse.company;
    const finalCompanyName = companyFromDomain || extractedCompany || 'Unknown Company';

    if (!companyFromDomain && extractedCompany && domain) {
      await supabase
        .from('crm_company_domain_mapping')
        .insert({
          email_domain: domain,
          company_name: extractedCompany,
          confidence_score: aiResponse.confidenceScore || 0.7,
          is_verified: false,
          match_count: 1,
        })
        .then(() => {
          autoDetectedCompany = false;
        });
    }

    const parsedInquiry: ParsedInquiry = {
      productName: aiResponse.productName || aiResponse.product_name || '',
      quantity: aiResponse.quantity || '',
      supplierName: aiResponse.supplierName || aiResponse.supplier_name || aiResponse.supplier || null,
      supplierCountry: aiResponse.supplierCountry || aiResponse.supplier_country || aiResponse.country || null,
      companyName: finalCompanyName,
      contactPerson: aiResponse.contactPerson || aiResponse.contact_person || aiResponse.contact || fromName || null,
      contactEmail: fromEmail,
      contactPhone: aiResponse.contactPhone || aiResponse.contact_phone || aiResponse.phone || aiResponse.whatsapp || null,
      coaRequested: aiResponse.coaRequested || aiResponse.coa_requested || aiResponse.coa || false,
      msdsRequested: aiResponse.msdsRequested || aiResponse.msds_requested || aiResponse.msds || false,
      sampleRequested: aiResponse.sampleRequested || aiResponse.sample_requested || aiResponse.sample || false,
      priceRequested: aiResponse.priceRequested || aiResponse.price_requested || aiResponse.price || true,
      purposeIcons,
      deliveryDateExpected: aiResponse.deliveryDateExpected || aiResponse.delivery_date || aiResponse.deliveryDate || null,
      urgency: aiResponse.urgency || 'medium',
      remarks: aiResponse.remarks || aiResponse.notes || aiResponse.additional_info || null,
      confidence: aiResponse.confidence || 'medium',
      confidenceScore: aiResponse.confidenceScore || aiResponse.confidence_score || 0.7,
      detectedLanguage: aiResponse.detectedLanguage || aiResponse.language || 'unknown',
      autoDetectedCompany,
      autoDetectedContact: false,
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