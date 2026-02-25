
-- Table for raffle history with winner notifications
CREATE TABLE IF NOT EXISTS public.raffle_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  winner_email TEXT NOT NULL,
  winner_user_id UUID,
  prize TEXT NOT NULL,
  is_claimed BOOLEAN DEFAULT false,
  winner_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.raffle_history ENABLE ROW LEVEL SECURITY;

-- Super admin can manage all
CREATE POLICY "Super admin full access" ON public.raffle_history
  FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- Users can see their own wins
CREATE POLICY "Users can see own wins" ON public.raffle_history
  FOR SELECT USING (auth.uid() = winner_user_id);

-- Enable realtime for raffle
ALTER PUBLICATION supabase_realtime ADD TABLE public.raffle_history;
