import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function SupportButton() {
  const handleSupportClick = () => {
    const whatsappUrl = "https://wa.me/5516992600631?text=Olá+Erik,+tudo+bem?+Preciso+de+suporte";
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      onClick={handleSupportClick}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 bg-green-600 hover:bg-green-700 text-white border-green-600"
      title="Suporte via WhatsApp"
    >
      <MessageCircle className="w-5 h-5 mr-2" />
      Suporte
    </Button>
  );
}
