-- Create tracked_links table for link tracking feature
CREATE TABLE public.tracked_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  original_url TEXT NOT NULL,
  short_code VARCHAR(20) NOT NULL UNIQUE,
  title TEXT,
  clicks INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create link_clicks table for tracking individual clicks
CREATE TABLE public.link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID NOT NULL REFERENCES public.tracked_links(id) ON DELETE CASCADE,
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  country VARCHAR(100),
  city VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  os VARCHAR(100),
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tracked_links
CREATE POLICY "Users can view their own links" 
ON public.tracked_links 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own links" 
ON public.tracked_links 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own links" 
ON public.tracked_links 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own links" 
ON public.tracked_links 
FOR DELETE 
USING (auth.uid() = user_id);

-- Public read policy for redirect (anyone can read a link by short_code for redirect purposes)
CREATE POLICY "Anyone can read links for redirect" 
ON public.tracked_links 
FOR SELECT 
USING (is_active = true);

-- Create RLS policies for link_clicks
CREATE POLICY "Users can view clicks on their links" 
ON public.link_clicks 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tracked_links 
    WHERE tracked_links.id = link_clicks.link_id 
    AND tracked_links.user_id = auth.uid()
  )
);

-- Anyone can insert clicks (for tracking purposes)
CREATE POLICY "Anyone can insert clicks" 
ON public.link_clicks 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_tracked_links_short_code ON public.tracked_links(short_code);
CREATE INDEX idx_tracked_links_user_id ON public.tracked_links(user_id);
CREATE INDEX idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX idx_link_clicks_clicked_at ON public.link_clicks(clicked_at);