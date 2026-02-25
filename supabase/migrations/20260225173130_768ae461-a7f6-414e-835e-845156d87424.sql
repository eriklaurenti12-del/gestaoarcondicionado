-- Insert new landing page settings for WhatsApp, FAQ, Video, Template
INSERT INTO admin_settings (key, value, description) VALUES
  ('landing_whatsapp_flutuante', 'true', 'WhatsApp floating button active'),
  ('landing_whatsapp_link', 'https://wa.me/5511999999999', 'WhatsApp floating button link'),
  ('landing_whatsapp_mensagem', 'Olá! Vim pela landing page e gostaria de saber mais!', 'WhatsApp default message'),
  ('landing_template', 'persuasao', 'Active template: persuasao, vsl, minimalista'),
  ('landing_vsl_url', '', 'VSL video URL'),
  ('landing_vsl_trava', 'false', 'Lock system behind video'),
  ('landing_faq1_pergunta', 'O sistema é difícil de usar?', 'FAQ 1 question'),
  ('landing_faq1_resposta', 'Não! É mais simples que WhatsApp. Em 2 minutos você já está usando.', 'FAQ 1 answer'),
  ('landing_faq1_ativa', 'true', 'FAQ 1 active'),
  ('landing_faq2_pergunta', 'Funciona no celular?', 'FAQ 2 question'),
  ('landing_faq2_resposta', 'Sim! 100% responsivo, funciona em qualquer celular, tablet ou computador.', 'FAQ 2 answer'),
  ('landing_faq2_ativa', 'true', 'FAQ 2 active'),
  ('landing_faq3_pergunta', 'Posso cancelar a qualquer momento?', 'FAQ 3 question'),
  ('landing_faq3_resposta', 'Sim! Sem multa, sem burocracia. Cancele quando quiser pelo WhatsApp.', 'FAQ 3 answer'),
  ('landing_faq3_ativa', 'true', 'FAQ 3 active'),
  ('landing_faq4_pergunta', 'E se eu não gostar?', 'FAQ 4 question'),
  ('landing_faq4_resposta', 'Você tem 7 dias de garantia total. Se não gostar, devolvemos 100% do valor.', 'FAQ 4 answer'),
  ('landing_faq4_ativa', 'true', 'FAQ 4 active'),
  ('landing_faq5_pergunta', 'Meus dados ficam seguros?', 'FAQ 5 question'),
  ('landing_faq5_resposta', 'Sim! Usamos criptografia de nível bancário. Seus dados estão 100% protegidos na nuvem.', 'FAQ 5 answer'),
  ('landing_faq5_ativa', 'true', 'FAQ 5 active'),
  ('landing_faq6_pergunta', 'Preciso instalar alguma coisa?', 'FAQ 6 question'),
  ('landing_faq6_resposta', 'Não! Funciona direto no navegador. Basta abrir e usar. Também pode instalar como app no celular.', 'FAQ 6 answer'),
  ('landing_faq6_ativa', 'true', 'FAQ 6 active')
ON CONFLICT (key) DO NOTHING;

-- Create storage bucket for landing videos
INSERT INTO storage.buckets (id, name, public) VALUES ('landing-media', 'landing-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for landing-media
CREATE POLICY "Super admin can upload landing media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'landing-media' AND 
    (auth.jwt() ->> 'email') = 'eriklaurenti09@gmail.com'
  );

CREATE POLICY "Super admin can update landing media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'landing-media' AND 
    (auth.jwt() ->> 'email') = 'eriklaurenti09@gmail.com'
  );

CREATE POLICY "Super admin can delete landing media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'landing-media' AND 
    (auth.jwt() ->> 'email') = 'eriklaurenti09@gmail.com'
  );

CREATE POLICY "Anyone can view landing media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'landing-media');