import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateImage } from '../_shared/llm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function detectGender(name: string): 'female' | 'male' | 'neutral' {
  if (!name) return 'neutral';
  const first = name.trim().split(/\s+/)[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const femaleNames = ['ana', 'maria', 'julia', 'bruna', 'camila', 'carla', 'daniela', 'fernanda', 'gabriela', 
    'isabela', 'jessica', 'juliana', 'larissa', 'leticia', 'luana', 'mariana', 'natalia', 'patricia', 'raquel',
    'sabrina', 'tatiana', 'vanessa', 'amanda', 'aline', 'andrea', 'beatriz', 'carol', 'claudia', 'cristina',
    'debora', 'elaine', 'fabiana', 'helena', 'iris', 'joana', 'karen', 'laura', 'lucia', 'marta', 'priscila',
    'renata', 'sandra', 'simone', 'viviane', 'alice', 'clara', 'sofia', 'valentina', 'manuela', 'heloisa',
    'lorena', 'marina', 'vitoria', 'isadora', 'livia', 'giovanna', 'bianca', 'milena', 'yasmin', 'rafaela',
    'nicole', 'sarah', 'thais', 'monique', 'ingrid', 'stella', 'carolina', 'emilly', 'lais', 'agatha'];
    
  const maleNames = ['jose', 'joao', 'carlos', 'pedro', 'lucas', 'marcos', 'paulo', 'rafael', 'andre',
    'bruno', 'daniel', 'diego', 'eduardo', 'felipe', 'gabriel', 'gustavo', 'henrique', 'igor', 'julio',
    'leonardo', 'marcelo', 'matheus', 'nicolas', 'otavio', 'ricardo', 'rodrigo', 'sergio', 'thiago',
    'vinicius', 'william', 'alexandre', 'anderson', 'arthur', 'caio', 'david', 'emerson', 'fabio',
    'fernando', 'guilherme', 'hugo', 'ivan', 'kleber', 'leandro', 'murilo', 'nelson', 'oscar',
    'patrick', 'renan', 'samuel', 'victor', 'wagner', 'yuri', 'bernardo', 'enzo', 'heitor', 'miguel',
    'noah', 'davi', 'theo', 'lorenzo', 'benjamin', 'anthony', 'sander', 'luan', 'mateus'];

  if (femaleNames.includes(first)) return 'female';
  if (maleNames.includes(first)) return 'male';
  
  const femaleEndings = ['a', 'ia', 'na', 'la', 'cia', 'lia', 'nia', 'ane', 'ene', 'ice', 'ise', 'ine'];
  const maleEndings = ['o', 'os', 'on', 'son', 'ton', 'el', 'er', 'or', 'us', 'io'];
  
  for (const ending of femaleEndings) {
    if (first.endsWith(ending) && first.length > ending.length + 1) return 'female';
  }
  for (const ending of maleEndings) {
    if (first.endsWith(ending) && first.length > ending.length + 1) return 'male';
  }
  
  return 'neutral';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const { contact_name, contact_phone, contact_id, force_regenerate, force_gender } = await req.json();
    if (!contact_id) throw new Error('contact_id is required');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_regenerate) {
      // Check if conversation already has avatar
      const { data: existing } = await supabase
        .from('ycloud_conversations')
        .select('profile_picture')
        .eq('id', contact_id)
        .maybeSingle();

      if (existing?.profile_picture) {
        return new Response(JSON.stringify({ avatar_url: existing.profile_picture, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const detectedGender = detectGender(contact_name || '');
    const gender = force_gender === 'male' || force_gender === 'female' || force_gender === 'neutral'
      ? force_gender
      : detectedGender;
    const genderDesc = gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person';

    const maleStyles = [
      'with short hair, masculine facial features, no makeup, wearing a casual t-shirt',
      'with short dark hair, defined jawline, wearing a collared shirt',
      'with crew cut hairstyle, masculine look, wearing a sweater',
      'with side-part haircut, broad jawline, wearing a modern casual outfit',
      'with short wavy hair, masculine expression, wearing a polo shirt',
    ];
    const femaleStyles = [
      'with long wavy hair, feminine facial features, wearing earrings',
      'with a bun hairstyle, feminine look, wearing a collared blouse',
      'with curly hair, soft facial features, wearing a sweater',
      'with straight hair, warm smile, wearing a modern outfit',
      'with ponytail hairstyle, feminine expression, wearing accessories',
    ];
    const neutralStyles = [
      'with short hair, casual style',
      'with medium length hair, modern look',
      'with curly hair, warm smile',
      'with straight hair, minimalist style',
      'with casual hairstyle, clean portrait style',
    ];

    const stylePool = gender === 'male' ? maleStyles : gender === 'female' ? femaleStyles : neutralStyles;
    const randomStyle = stylePool[Math.floor(Math.random() * stylePool.length)];

    const prompt = `Create a flat illustrated avatar portrait of a ${genderDesc} ${randomStyle}. IMPORTANT: This person MUST look clearly ${genderDesc}. ${gender === 'male' ? 'Do not generate feminine traits.' : gender === 'female' ? 'Do not generate masculine traits.' : 'Keep neutral appearance.'} The style should be modern flat illustration with warm skin tones, simple geometric shapes, minimal details, on a light beige/cream circular background. Similar to corporate illustrated avatars. Head and shoulders only, facing slightly to the side. No text.`;

    console.log(`[Avatar] Generating for "${contact_name}" (${gender}) - ${contact_id}`);

    const imageBase64 = await generateImage({ prompt, size: '1024x1024' });

    if (!imageBase64) {
      console.error('[Avatar] A OpenAI nao devolveu imagem');
      throw new Error('No image generated');
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const fileName = `ai-contacts/${contact_id}.png`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, imageBytes, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[Avatar] Upload error:', uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const avatarUrl = urlData.publicUrl;

    // Update the conversation record
    await supabase
      .from('ycloud_conversations')
      .update({ profile_picture: avatarUrl })
      .eq('id', contact_id);

    // Also update matching ycloud_contacts
    if (contact_phone) {
      const { data: conv } = await supabase
        .from('ycloud_conversations')
        .select('session_id')
        .eq('id', contact_id)
        .maybeSingle();

      if (conv?.session_id) {
        await supabase
          .from('ycloud_contacts')
          .update({ profile_picture: avatarUrl })
          .eq('contact_phone', contact_phone)
          .eq('session_id', conv.session_id);
      }
    }

    console.log(`[Avatar] Generated for "${contact_name}" -> ${avatarUrl}`);

    return new Response(JSON.stringify({ avatar_url: avatarUrl, generated: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Avatar] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
