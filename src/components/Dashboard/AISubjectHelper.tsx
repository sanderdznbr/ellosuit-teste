import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AISubjectHelperProps {
  currentSubject: string;
  onSelectSubject: (subject: string) => void;
}

interface SubjectSuggestion {
  subject: string;
  estimatedOpenRate: number;
}

const AISubjectHelper: React.FC<AISubjectHelperProps> = ({
  currentSubject,
  onSelectSubject
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SubjectSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const generateSuggestions = async () => {
    if (!currentSubject.trim()) {
      toast({
        title: "Digite um assunto",
        description: "Escreva um assunto primeiro para melhorar com IA",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setSuggestions([]);
    setSelectedIndex(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [
            {
              role: 'system',
              content: `Você é um especialista em email marketing. O usuário vai enviar um assunto de email e você deve gerar 3 variações melhores que aumentem a taxa de abertura. 
              
              Para cada sugestão, retorne um JSON com este formato exato:
              [
                {"subject": "Assunto melhorado 1", "estimatedOpenRate": 45},
                {"subject": "Assunto melhorado 2", "estimatedOpenRate": 52},
                {"subject": "Assunto melhorado 3", "estimatedOpenRate": 38}
              ]
              
              Regras:
              - Mantenha o assunto curto (máx 50 caracteres)
              - Use gatilhos emocionais ou urgência quando apropriado
              - Personalize quando possível
              - Evite palavras de spam
              - O estimatedOpenRate deve ser um número realista entre 20-60
              
              Retorne APENAS o JSON, sem explicações.`
            },
            {
              role: 'user',
              content: `Melhore este assunto de email: "${currentSubject}"`
            }
          ]
        }
      });

      if (error) throw error;

      const responseText = data?.response || data?.message || '';
      
      // Parse JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSuggestions(parsed);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar sugestões. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    onSelectSubject(suggestions[index].subject);
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={generateSuggestions}
        disabled={loading || !currentSubject.trim()}
        className="gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : suggestions.length > 0 ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Gerar novos
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Melhorar com IA
          </>
        )}
      </Button>

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Sugestões da IA (clique para usar):
          </p>
          {suggestions.map((suggestion, index) => (
            <Card 
              key={index}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedIndex === index 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => handleSelect(index)}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate pr-2">
                    {suggestion.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    ~{suggestion.estimatedOpenRate}% abertura
                  </span>
                  {selectedIndex === index && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISubjectHelper;
