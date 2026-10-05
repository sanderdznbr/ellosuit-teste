
-- Update credit packages with fairer pricing
UPDATE ai_credit_packages SET name = 'Básico', credits = 100, price_brl = 19.90, description = 'Ideal para começar', is_popular = false, sort_order = 1 WHERE sort_order = 1;
UPDATE ai_credit_packages SET name = 'Popular', credits = 500, price_brl = 79.90, description = 'Melhor custo-benefício', is_popular = true, sort_order = 2 WHERE sort_order = 2;
UPDATE ai_credit_packages SET name = 'Profissional', credits = 1500, price_brl = 199.90, description = 'Para uso intensivo', is_popular = false, sort_order = 3 WHERE sort_order = 3;
UPDATE ai_credit_packages SET name = 'Empresarial', credits = 5000, price_brl = 499.90, description = 'Máximo desempenho', is_popular = false, sort_order = 4 WHERE sort_order = 4;
