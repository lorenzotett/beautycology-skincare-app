import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ImageReplacerProps {
  messageId: number;
  currentImageBase64?: string;
  isPlaceholder?: boolean;
  onImageReplaced: (newImageBase64: string) => void;
}

export function ImageReplacer({ messageId, currentImageBase64, isPlaceholder, onImageReplaced }: ImageReplacerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`/api/admin/replace-image/${messageId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const result = await response.json();
      onImageReplaced(result.imageBase64);
      setShowUploader(false);
      
      toast({
        title: "Successo",
        description: "Immagine sostituita con successo",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare l'immagine",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      {currentImageBase64 ? (
        <div className="relative group">
          <img 
            src={currentImageBase64} 
            alt="User uploaded image" 
            className="max-w-xs h-auto rounded border"
          />
          {isPlaceholder && (
            <div className="absolute top-0 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded-bl">
              Placeholder
            </div>
          )}
          {(isPlaceholder || showUploader) && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
              <Button
                size="sm"
                onClick={() => setShowUploader(!showUploader)}
                className="bg-white text-black hover:bg-gray-100"
              >
                <Upload className="h-4 w-4 mr-1" />
                Sostituisci
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-48 h-48 bg-gray-100 border border-gray-300 rounded flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 mb-1">📷</div>
            <div className="text-xs text-gray-500">Immagine non disponibile</div>
            <Button
              size="sm"
              onClick={() => setShowUploader(true)}
              className="mt-2"
              variant="outline"
            >
              <Upload className="h-4 w-4 mr-1" />
              Carica
            </Button>
          </div>
        </div>
      )}

      {showUploader && (
        <div className="mt-2 p-3 bg-gray-50 rounded border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Carica nuova immagine</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowUploader(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            disabled={isUploading}
            className="text-xs"
          />
          {isUploading && (
            <div className="text-xs text-gray-500 mt-1">
              Caricamento in corso...
            </div>
          )}
        </div>
      )}
    </div>
  );
}