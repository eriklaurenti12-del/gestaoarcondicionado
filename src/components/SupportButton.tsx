import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function SupportButton() {
  const handleSupportClick = () => {
    const whatsappUrl = "https://wa.me/5516993729938?text=Olá+Natalia,+tudo+bem?+tenho+interesse+nos+seus+produtos+e+preciso+de+suporte";
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      onClick={handleSupportClick}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 rounded-full shadow-lg z-50"
      title="Suporte via WhatsApp"
    >
      <MessageCircle className="w-5 h-5 mr-2" />
      Suporte
    </Button>
  );
}
