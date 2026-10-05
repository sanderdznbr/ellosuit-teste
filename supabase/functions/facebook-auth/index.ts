import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fbAppId = Deno.env.get("FACEBOOK_APP_ID")!;
  const fbAppSecret = Deno.env.get("FACEBOOK_APP_SECRET")!;

  if (!fbAppId || !fbAppSecret) {
    return new Response(JSON.stringify({ error: "Facebook App not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, ...params } = await req.json();

    // === GET LOGIN URL ===
    if (action === "get_login_url") {
      const { redirectUri } = params;
      const scopes = [
        "pages_manage_posts",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "public_profile",
      ].join(",");

      const loginUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;

      return new Response(JSON.stringify({ loginUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === EXCHANGE CODE FOR TOKEN ===
    if (action === "exchange_code") {
      const { code, redirectUri, userId, companyId } = params;

      // 1. Exchange code for short-lived token
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${fbAppSecret}&code=${code}`
      );
      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(tokenData.error.message);

      // 2. Exchange for long-lived token
      const longRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${fbAppId}&client_secret=${fbAppSecret}&fb_exchange_token=${tokenData.access_token}`
      );
      const longData = await longRes.json();
      if (longData.error) throw new Error(longData.error.message);
      const longToken = longData.access_token;
      const expiresIn = longData.expires_in || 5184000; // ~60 days

      // 3. Get user pages
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`);
      const pagesData = await pagesRes.json();
      const pages = pagesData.data || [];

      // 4. For each page, get Instagram business account
      const connections: any[] = [];

      for (const page of pages) {
        // Save Facebook page connection
        const fbConn = {
          company_id: companyId,
          user_id: userId,
          platform: "facebook",
          access_token: longToken,
          long_lived_token: longToken,
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          is_active: true,
        };

        // Check for Instagram account linked to page
        const igRes = await fetch(
          `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
        );
        const igData = await igRes.json();

        if (igData.instagram_business_account) {
          const igId = igData.instagram_business_account.id;
          // Get IG username
          const igInfoRes = await fetch(
            `https://graph.facebook.com/v21.0/${igId}?fields=username,name,profile_picture_url&access_token=${page.access_token}`
          );
          const igInfo = await igInfoRes.json();

          // Save Instagram connection
          const igConn = {
            company_id: companyId,
            user_id: userId,
            platform: "instagram",
            access_token: page.access_token,
            long_lived_token: longToken,
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            instagram_account_id: igId,
            instagram_username: igInfo.username || "",
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            is_active: true,
            metadata: { profile_picture: igInfo.profile_picture_url },
          };
          connections.push(igConn);
        }

        connections.push(fbConn);
      }

      // Upsert connections (remove old ones first)
      await supabase.from("social_connections").delete().eq("company_id", companyId).eq("user_id", userId);
      
      if (connections.length > 0) {
        const { error: insertErr } = await supabase.from("social_connections").insert(connections);
        if (insertErr) throw insertErr;
      }

      return new Response(JSON.stringify({ success: true, connections: connections.length, pages: pages.map((p: any) => p.name) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === PUBLISH CAROUSEL TO INSTAGRAM ===
    if (action === "publish_instagram") {
      const { connectionId, imageUrls, caption, companyId } = params;

      const { data: conn } = await supabase.from("social_connections").select("*").eq("id", connectionId).single();
      if (!conn) throw new Error("Connection not found");

      const igId = conn.instagram_account_id;
      const token = conn.page_access_token;

      if (!igId) throw new Error("No Instagram account linked");

      // For carousel (multiple images), use container approach
      if (imageUrls.length > 1) {
        // 1. Create individual media containers
        const childIds: string[] = [];
        for (const url of imageUrls) {
          const res = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: url,
              is_carousel_item: true,
              access_token: token,
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(`Media upload failed: ${data.error.message}`);
          childIds.push(data.id);
        }

        // 2. Create carousel container
        const carouselRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: "CAROUSEL",
            children: childIds.join(","),
            caption: caption || "",
            access_token: token,
          }),
        });
        const carouselData = await carouselRes.json();
        if (carouselData.error) throw new Error(`Carousel creation failed: ${carouselData.error.message}`);

        // 3. Publish
        const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: carouselData.id,
            access_token: token,
          }),
        });
        const publishData = await publishRes.json();
        if (publishData.error) throw new Error(`Publish failed: ${publishData.error.message}`);

        return new Response(JSON.stringify({ success: true, postId: publishData.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Single image post
        const createRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrls[0],
            caption: caption || "",
            access_token: token,
          }),
        });
        const createData = await createRes.json();
        if (createData.error) throw new Error(createData.error.message);

        const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: token,
          }),
        });
        const publishData = await publishRes.json();
        if (publishData.error) throw new Error(publishData.error.message);

        return new Response(JSON.stringify({ success: true, postId: publishData.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === PUBLISH TO FACEBOOK PAGE ===
    if (action === "publish_facebook") {
      const { connectionId, imageUrls, caption } = params;

      const { data: conn } = await supabase.from("social_connections").select("*").eq("id", connectionId).single();
      if (!conn) throw new Error("Connection not found");

      const pageId = conn.page_id;
      const token = conn.page_access_token;

      if (imageUrls.length > 1) {
        // Multi-photo post
        const photoIds: string[] = [];
        for (const url of imageUrls) {
          const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url,
              published: false,
              access_token: token,
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          photoIds.push(data.id);
        }

        const attachments = photoIds.map((id) => ({ media_fbid: id }));
        const feedRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: caption || "",
            attached_media: attachments,
            access_token: token,
          }),
        });
        const feedData = await feedRes.json();
        if (feedData.error) throw new Error(feedData.error.message);

        return new Response(JSON.stringify({ success: true, postId: feedData.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: imageUrls[0],
            message: caption || "",
            access_token: token,
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        return new Response(JSON.stringify({ success: true, postId: data.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // === GENERATE CAPTION ===
    if (action === "generate_caption") {
      const { topic, platform, tone, language } = params;
      const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
      if (!perplexityKey) throw new Error("Perplexity API key not configured");

      const prompt = `Gere uma legenda ${tone || 'profissional'} para ${platform || 'Instagram'} sobre: "${topic}".
A legenda deve:
- Ter no máximo 2200 caracteres
- Incluir 5-10 hashtags relevantes no final
- Usar emojis estratégicos
- Ter um call-to-action engajador
- Estar em ${language || 'português brasileiro'}
- Ser criativa e gerar engajamento

Retorne APENAS a legenda pronta, sem explicações.`;

      const aiRes = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      });
      const aiData = await aiRes.json();
      const caption = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ success: true, caption }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LIST CONNECTIONS ===
    if (action === "list_connections") {
      const { companyId } = params;
      const { data, error } = await supabase
        .from("social_connections")
        .select("id, platform, page_name, instagram_username, instagram_account_id, is_active, token_expires_at, metadata")
        .eq("company_id", companyId)
        .eq("is_active", true);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, connections: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DISCONNECT ===
    if (action === "disconnect") {
      const { connectionId } = params;
      await supabase.from("social_connections").update({ is_active: false }).eq("id", connectionId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Facebook auth error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
