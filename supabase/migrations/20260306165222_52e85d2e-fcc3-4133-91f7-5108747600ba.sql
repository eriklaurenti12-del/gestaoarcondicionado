
CREATE TABLE public.page_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_url text NOT NULL,
  event_type text NOT NULL DEFAULT 'pageview',
  visitor_id text,
  referrer text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.page_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics" ON public.page_analytics
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Super admin can read analytics" ON public.page_analytics
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_page_analytics_created ON public.page_analytics(created_at DESC);
CREATE INDEX idx_page_analytics_event ON public.page_analytics(event_type);
