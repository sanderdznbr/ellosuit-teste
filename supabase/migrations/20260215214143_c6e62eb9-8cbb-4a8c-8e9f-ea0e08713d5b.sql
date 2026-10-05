UPDATE chatbot_flows 
SET nodes = jsonb_set(
  nodes, 
  '{6,data,config,agentId}', 
  '"15c1550b-0e13-4d58-a2cf-137a68775f2e"'
)
WHERE id = '4a2ecc68-787d-4e94-a5af-9ef5e9dfe5c2';