import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function SupportButton() {
  const handleSupportClick = () => {
    const whatsappUrl = "https://wa.me/5516992600631?text=Olá%2C+vim+do+sistema+Gestão+de+Negócios+e+preciso+de+suporte";
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Button
      onClick={handleSupportClick}
      variant="outline"
      size="sm"
      className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all duration-300"
      title="Suporte via WhatsApp"
    >
      <MessageCircle className="w-5 h-5 mr-2" />
      Suporte
    </Button>
  );
}
