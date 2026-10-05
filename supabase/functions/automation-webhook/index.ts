import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ExecutionContext,
  executeCreateClient,
  executeSendEmail,
  executeSendWhatsApp,
  executeUpdateClient,
  executeCreateTask,
  executeHttpRequest,
  executeCreateProposal,
  executeCreateReceipt,
  evaluateCondition,
  evaluateFilter,
} from "./actions.ts";
import { isWithinActiveHours, normalizeActiveHours } from "../_shared/active-hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const automationId = pathParts[pathParts.length - 1];

  if (!automationId || automationId === "automation-webhook") {
    return new Response(
      JSON.stringify({ error: "Missing automation ID in URL path" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: automation, error: autoErr } = await supabase
      .from("automations")
      .select("id, name, is_active, nodes, edges, company_id, created_by, execution_count, trigger_config")
      .eq("id", automationId)
      .single();

    if (autoErr || !automation) {
      return new Response(
        JSON.stringify({ error: "Automation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse incoming data
    let incomingData: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PUT") {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        incomingData = await req.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        formData.forEach((value, key) => { incomingData[key] = value; });
      } else {
        try { incomingData = await req.json(); } catch { /* ignore */ }
      }
    } else if (req.method === "GET") {
      url.searchParams.forEach((value, key) => { incomingData[key] = value; });
    }

    const detectedFields = Object.keys(incomingData);

    // Update webhook node with detected fields
    const nodes = Array.isArray(automation.nodes) ? automation.nodes : [];
    const updatedNodes = nodes.map((node: any) => {
      if (node.type === "webhook") {
        return {
          ...node,
          config: {
            ...node.config,
            detectedFields,
            lastPayload: incomingData,
            lastReceivedAt: new Date().toISOString(),
          },
        };
      }
      return node;
    });

    await supabase.from("automations").update({ nodes: updatedNodes }).eq("id", automationId);

    // If automation is not active, just detect fields and return
    if (!automation.is_active) {
      return new Response(
        JSON.stringify({ success: true, message: "Fields detected (automation inactive)", fields_detected: detectedFields }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Active-hours gate
    const activeHoursRaw = (automation as any).trigger_config?.active_hours;
    if (activeHoursRaw && !isWithinActiveHours(activeHoursRaw)) {
      const cfg = normalizeActiveHours(activeHoursRaw);
      console.log(`[ACTIVE-HOURS] Automation ${automationId} skipped (outside hours)`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "outside_active_hours",
          message: cfg.outOfHoursMessage,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === EXECUTION ENGINE ===
    const edges = Array.isArray(automation.edges) ? automation.edges : [];
    const executionLog: any[] = [];

    // Helper: resolve a value from incoming data using nested path
    const resolveValue = (path: string): unknown => {
      if (!path) return null;
      const templateMatch = path.match(/\{\{data\.(.+?)\}\}/);
      const fieldPath = templateMatch ? templateMatch[1] : path;
      const parts = fieldPath.split(".");
      let current: any = incomingData;
      for (const part of parts) {
        if (current == null || typeof current !== "object") return null;
        current = current[part];
      }
      return current;
    };

    // Helper: resolve template strings like "Hello {{data.name}}"
    const resolveTemplate = (text: string): string => {
      if (!text) return "";
      return text.replace(/\{\{data\.(.+?)\}\}/g, (_: string, field: string) => {
        return String(resolveValue(field) ?? "");
      }).replace(/\{\{client\.(.+?)\}\}/g, (_: string, field: string) => {
        // Resolve from created client data if available
        return String(ctx.createdClientData?.[field] ?? resolveValue(field) ?? "");
      });
    };

    const ctx: ExecutionContext = {
      supabase,
      automation,
      incomingData,
      resolveValue,
      resolveTemplate,
    };

    // Recursive graph traversal - execute node and all its downstream nodes
    const executedNodes = new Set<string>();

    async function executeNode(nodeId: string, incomingEdges: any[]) {
      if (executedNodes.has(nodeId)) return; // prevent cycles
      executedNodes.add(nodeId);

      const node = updatedNodes.find((n: any) => n.id === nodeId);
      if (!node) return;

      try {
        let result: any = null;
        let shouldContinue = true;

        switch (node.type) {
          case "webhook":
            // Trigger node - just pass through
            result = { fields_detected: detectedFields };
            break;

          case "create_client":
            result = await executeCreateClient(ctx, node, incomingEdges);
            executionLog.push({ node: nodeId, type: "create_client", status: "success", result });
            break;

          case "send_email":
            result = await executeSendEmail(ctx, node);
            executionLog.push({ node: nodeId, type: "send_email", status: "success", result });
            break;

          case "send_whatsapp":
            result = await executeSendWhatsApp(ctx, node);
            executionLog.push({ node: nodeId, type: "send_whatsapp", status: "success", result });
            break;

          case "update_client":
            result = await executeUpdateClient(ctx, node);
            executionLog.push({ node: nodeId, type: "update_client", status: "success", result });
            break;

          case "create_task":
            result = await executeCreateTask(ctx, node);
            executionLog.push({ node: nodeId, type: "create_task", status: "success", result });
            break;

          case "http_request":
            result = await executeHttpRequest(ctx, node);
            executionLog.push({ node: nodeId, type: "http_request", status: "success", result });
            break;

          case "create_proposal":
            result = await executeCreateProposal(ctx, node);
            executionLog.push({ node: nodeId, type: "create_proposal", status: "success", result });
            break;

          case "create_receipt":
            result = await executeCreateReceipt(ctx, node);
            executionLog.push({ node: nodeId, type: "create_receipt", status: "success", result });
            break;

          case "condition":
            shouldContinue = evaluateCondition(ctx, node);
            executionLog.push({ node: nodeId, type: "condition", status: shouldContinue ? "passed" : "blocked", result: { condition: shouldContinue } });
            break;

          case "filter":
            shouldContinue = evaluateFilter(ctx, node);
            executionLog.push({ node: nodeId, type: "filter", status: shouldContinue ? "passed" : "blocked", result: { filter: shouldContinue } });
            break;

          case "delay":
            // In webhook context, we can't truly delay, just log it
            executionLog.push({ node: nodeId, type: "delay", status: "skipped", message: "Delay não aplicável em webhook síncrono" });
            break;

          case "transform_data":
            executionLog.push({ node: nodeId, type: "transform_data", status: "success" });
            break;

          default:
            executionLog.push({ node: nodeId, type: node.type, status: "skipped" });
        }

        // If condition/filter blocked, don't continue downstream
        if (!shouldContinue) return;

        // Find downstream nodes and execute them
        const outEdges = edges.filter((e: any) => e.source === nodeId);
        const targetIds = [...new Set(outEdges.map((e: any) => e.target))];

        for (const targetId of targetIds) {
          const targetEdges = outEdges.filter((e: any) => e.target === targetId);
          await executeNode(targetId, targetEdges);
        }
      } catch (err: any) {
        console.error(`Error executing node ${nodeId} (${node.type}):`, err.message);
        executionLog.push({ node: nodeId, type: node.type, status: "error", error: err.message });
      }
    }

    // Start from trigger nodes (webhook, new_client, etc.)
    const triggerTypes = ["webhook", "new_client", "client_updated", "schedule", "proposal_status"];
    const triggerNodes = updatedNodes.filter((n: any) => triggerTypes.includes(n.type));

    for (const trigger of triggerNodes) {
      await executeNode(trigger.id, []);
    }

    // Log execution
    await supabase.from("automation_executions").insert({
      automation_id: automationId,
      status: executionLog.some((l: any) => l.status === "error") ? "error" : "completed",
      trigger_data: incomingData,
      execution_log: { trigger: "webhook", fields_detected: detectedFields, actions: executionLog, timestamp: new Date().toISOString() },
      completed_at: new Date().toISOString(),
    });

    // Update execution count
    await supabase.from("automations").update({
      execution_count: (automation.execution_count || 0) + 1,
      last_executed_at: new Date().toISOString(),
    }).eq("id", automationId);

    return new Response(
      JSON.stringify({ success: true, message: "Webhook received and processed", fields_detected: detectedFields, execution: executionLog }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: "Internal processing error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
