import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareId } = await req.json();
    if (!shareId) {
      return new Response(JSON.stringify({ error: "shareId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dashIndex = shareId.indexOf("-");
    const type = shareId.substring(0, dashIndex);
    const id = shareId.substring(dashIndex + 1);
    if (!type || !id || !["file", "folder"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid shareId format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (type === "file") {
      const { data, error } = await supabaseAdmin
        .from("documents")
        .select("id, name, file_type, file_size, file_url, created_at")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "File not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ type: "file", data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // folder
    const { data: folderData, error: folderError } = await supabaseAdmin
      .from("document_folders")
      .select("id, name, description, color, created_at")
      .eq("id", id)
      .maybeSingle();

    if (folderError) throw folderError;
    if (!folderData) {
      return new Response(JSON.stringify({ error: "Folder not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: filesData, error: filesError } = await supabaseAdmin
      .from("documents")
      .select("id, name, file_type, file_size, file_url, created_at")
      .eq("folder_id", id);

    if (filesError) throw filesError;

    return new Response(
      JSON.stringify({
        type: "folder",
        data: { ...folderData, files: filesData || [] },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
