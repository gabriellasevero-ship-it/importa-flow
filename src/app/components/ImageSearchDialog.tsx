import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Upload, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { toast } from 'sonner';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const narrow = window.matchMedia('(max-width: 768px)').matches;
      const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(narrow || touch);
    };
    check();
    window.matchMedia('(max-width: 768px)').addEventListener('change', check);
    return () => window.matchMedia('(max-width: 768px)').removeEventListener('change', check);
  }, []);
  return isMobile;
}

interface ImageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (searchText: string) => void;
}

export const ImageSearchDialog: React.FC<ImageSearchDialogProps> = ({
  open,
  onOpenChange,
  onSearch,
}) => {
  const isMobile = useIsMobile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsProcessing(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (JPG, PNG, etc.)');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSearchByImage = async () => {
    if (!selectedFile) {
      toast.error('Selecione uma imagem primeiro');
      return;
    }

    setIsProcessing(true);
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(selectedFile, 'por+eng', {
        logger: () => {}, // silenciar logs no console
      });
      const text = (result.data.text || '').trim().replace(/\s+/g, ' ');
      if (!text) {
        toast.error('Nenhum texto encontrado na imagem. Tente uma foto mais nítida ou com código/nome visível.');
        setIsProcessing(false);
        return;
      }
      // Usar as primeiras palavras como termo de busca (evitar textos longos)
      const searchTerm = text.split(/\s+/).slice(0, 6).join(' ').trim();
      onSearch(searchTerm);
      toast.success('Texto da imagem reconhecido. Buscando no catálogo...');
      handleClose(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a imagem. Tente outra imagem.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Buscar por imagem
          </DialogTitle>
          <DialogDescription>
            Envie uma foto do produto, etiqueta ou código. O texto será reconhecido e usado na busca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Input para galeria / arquivo */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="image-search-input"
          />
          {/* Input com capture: no mobile abre a câmera */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
            id="image-search-camera"
          />

          {!selectedFile ? (
            <div className="flex flex-col gap-3">
              {isMobile ? (
                <>
                  <label
                    htmlFor="image-search-camera"
                    className="flex flex-col items-center justify-center w-full min-h-[140px] border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors py-6 px-4"
                  >
                    <Camera className="w-10 h-10 text-primary mb-2" />
                    <span className="text-sm font-medium text-foreground text-center">
                      Tirar foto
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Abre a câmera do aparelho
                    </span>
                  </label>
                  <label
                    htmlFor="image-search-input"
                    className="flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors py-4 px-4"
                  >
                    <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-muted-foreground text-center">
                      Escolher da galeria
                    </span>
                  </label>
                </>
              ) : (
                <label
                  htmlFor="image-search-input"
                  className="flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <Upload className="w-12 h-12 text-muted-foreground mb-3" />
                  <span className="text-sm font-medium text-muted-foreground text-center px-4">
                    Clique para selecionar uma imagem
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    JPG, PNG ou WebP
                  </span>
                </label>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                <img
                  src={previewUrl!}
                  alt="Preview"
                  className="w-full max-h-[280px] object-contain"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemoveImage}
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dica: fotos de códigos de barras ou etiquetas com nome do produto funcionam melhor.
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              onClick={handleSearchByImage}
              disabled={!selectedFile || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reconhecendo...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Buscar no catálogo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
