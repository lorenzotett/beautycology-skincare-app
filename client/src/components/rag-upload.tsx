import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Database, CheckCircle } from "lucide-react";

interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  sources: string[];
}

interface UploadResponse {
  message: string;
  filename: string;
  size: number;
}

export function RAGUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get knowledge base stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/rag/stats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/rag/stats");
      return response.json() as Promise<KnowledgeBaseStats>;
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return response.json() as Promise<UploadResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Documento caricato",
        description: `${data.filename} è stato aggiunto alla knowledge base.`,
      });
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['/api/rag/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nel caricamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear knowledge base mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/rag/clear");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Knowledge Base pulita",
        description: "Tutti i documenti sono stati rimossi.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/rag/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: "Impossibile pulire la knowledge base.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Tipo file non supportato",
          description: "Solo PDF, DOCX e TXT sono supportati.",
          variant: "destructive",
        });
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File troppo grande",
          description: "Il file deve essere inferiore a 10MB.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Knowledge Base Stats */}
      <Card className="bg-dark-secondary border-dark-accent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Database className="w-5 h-5" />
            Knowledge Base Status
          </CardTitle>
          <CardDescription className="text-text-muted">
            Stato attuale della knowledge base per Bonnie
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="text-text-muted">Caricamento...</div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.totalDocuments}</div>
                <div className="text-sm text-text-muted">Documenti</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{stats.totalChunks}</div>
                <div className="text-sm text-text-muted">Frammenti</div>
              </div>
              <div className="text-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending || stats.totalDocuments === 0}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Pulisci
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-text-muted">Errore nel caricamento delle statistiche</div>
          )}
          
          {stats && stats.sources.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-white mb-2">Documenti caricati:</h4>
              <div className="space-y-1">
                {stats.sources.map((source, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-text-muted">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="bg-dark-secondary border-dark-accent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5" />
            Carica Documento
          </CardTitle>
          <CardDescription className="text-text-muted">
            Aggiungi documenti dermocosmetici per migliorare le risposte di Bonnie
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileSelect}
              className="bg-dark-accent border-gray-600 text-white file:bg-assistant-msg file:text-white file:border-0 file:rounded file:px-3 file:py-2"
            />
            <div className="text-xs text-text-muted mt-2">
              Formati supportati: PDF, DOCX, TXT (max 10MB)
            </div>
          </div>

          {selectedFile && (
            <div className="p-3 bg-dark-accent rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{selectedFile.name}</div>
                  <div className="text-xs text-text-muted">{formatFileSize(selectedFile.size)}</div>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
            className="w-full bg-assistant-msg hover:bg-green-600 text-white"
          >
            {uploadMutation.isPending ? (
              "Caricamento..."
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Carica Documento
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}