
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, Info } from "lucide-react";

interface GoogleAuthInstructionsProps {
  isVisible: boolean;
  onClose: () => void;
}

export const GoogleAuthInstructions = ({ isVisible, onClose }: GoogleAuthInstructionsProps) => {
  if (!isVisible) return null;

  return (
    <Alert className="mb-4 border-[#DFE4FB] bg-[#F0F2FE]">
      <Info className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        Configuração Necessária no Google Console
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          Para conectar o Google Meet, você precisa adicionar a URL de redirecionamento no Google Console:
        </p>
        
        <div className="bg-white p-3 rounded border border-[#DFE4FB]">
          <strong>URL para adicionar:</strong>
          <code className="block mt-1 p-2 bg-gray-100 rounded text-sm">
            https://ellosuit.online/dashboard
          </code>
        </div>

        <div className="space-y-2">
          <p><strong>Passos:</strong></p>
          <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
            <li>Vá para o Google Cloud Console</li>
            <li>Acesse: APIs & Services → Credentials</li>
            <li>Clique no seu OAuth 2.0 Client ID</li>
            <li>Em "Authorized redirect URIs", adicione a URL acima</li>
            <li>Salve as alterações</li>
            <li>Tente conectar novamente</li>
          </ol>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
          className="mt-3"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Abrir Google Console
        </Button>
      </AlertDescription>
    </Alert>
  );
};
