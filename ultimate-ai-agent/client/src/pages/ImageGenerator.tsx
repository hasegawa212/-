import { useState, useCallback } from "react";
import {
  Image,
  Wand2,
  Download,
  RefreshCw,
  Trash2,
  Loader2,
  X,
  Maximize2,
  Sparkles,
  Copy,
  Check,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  enhancedPrompt?: string;
  style: string;
  size: string;
  quality: string;
  timestamp: Date;
  isMock: boolean;
}

const STYLES = [
  { id: "photorealistic", label: "Photorealistic", color: "from-gray-700 to-gray-900" },
  { id: "anime", label: "Anime", color: "from-pink-400 to-purple-600" },
  { id: "oil-painting", label: "Oil Painting", color: "from-amber-600 to-orange-800" },
  { id: "watercolor", label: "Watercolor", color: "from-cyan-300 to-blue-500" },
  { id: "pixel-art", label: "Pixel Art", color: "from-green-400 to-emerald-600" },
  { id: "3d-render", label: "3D Render", color: "from-indigo-400 to-violet-700" },
  { id: "sketch", label: "Sketch", color: "from-stone-400 to-stone-700" },
  { id: "minimalist", label: "Minimalist", color: "from-slate-100 to-slate-400" },
  { id: "cyberpunk", label: "Cyberpunk", color: "from-fuchsia-500 to-cyan-500" },
  { id: "studio-ghibli", label: "Studio Ghibli", color: "from-emerald-300 to-sky-400" },
];

const SIZES = [
  { id: "1024x1024", label: "1024 x 1024", aspect: "Square" },
  { id: "1024x1792", label: "1024 x 1792", aspect: "Portrait" },
  { id: "1792x1024", label: "1792 x 1024", aspect: "Landscape" },
];

function createMockGradientUrl(prompt: string, style: string, size: string): string {
  const styleObj = STYLES.find((s) => s.id === style);
  const colors = styleObj?.color || "from-gray-400 to-gray-600";
  return `mock://${style}/${size}/${encodeURIComponent(prompt)}`;
}

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("photorealistic");
  const [selectedSize, setSelectedSize] = useState("1024x1024");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [generatingVariations, setGeneratingVariations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [lightboxImage, setLightboxImage] = useState<GeneratedImage | null>(null);
  const [copied, setCopied] = useState(false);

  const generateImage = useCallback(
    async (promptText: string, isMock = false) => {
      setLoading(true);
      setError(null);

      const styleLabel = STYLES.find((s) => s.id === selectedStyle)?.label || selectedStyle;
      const fullPrompt = `${promptText}, ${styleLabel} style`;

      try {
        if (isMock) {
          await new Promise((r) => setTimeout(r, 1500));
          const newImage: GeneratedImage = {
            id: Date.now().toString(),
            url: createMockGradientUrl(promptText, selectedStyle, selectedSize),
            prompt: promptText,
            style: styleLabel,
            size: selectedSize,
            quality,
            timestamp: new Date(),
            isMock: true,
          };
          setImages((prev) => [newImage, ...prev]);
          return;
        }

        const res = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: fullPrompt,
            size: selectedSize,
            quality,
            style: selectedStyle,
          }),
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            // No API key - generate mock
            await new Promise((r) => setTimeout(r, 1000));
            const newImage: GeneratedImage = {
              id: Date.now().toString(),
              url: createMockGradientUrl(promptText, selectedStyle, selectedSize),
              prompt: promptText,
              style: styleLabel,
              size: selectedSize,
              quality,
              timestamp: new Date(),
              isMock: true,
            };
            setImages((prev) => [newImage, ...prev]);
            return;
          }
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        const newImage: GeneratedImage = {
          id: Date.now().toString(),
          url: data.url || data.data?.[0]?.url || "",
          prompt: promptText,
          enhancedPrompt: data.revised_prompt,
          style: styleLabel,
          size: selectedSize,
          quality,
          timestamp: new Date(),
          isMock: false,
        };
        setImages((prev) => [newImage, ...prev]);
      } catch (err) {
        // Fallback to mock
        const newImage: GeneratedImage = {
          id: Date.now().toString(),
          url: createMockGradientUrl(promptText, selectedStyle, selectedSize),
          prompt: promptText,
          style: styleLabel,
          size: selectedSize,
          quality,
          timestamp: new Date(),
          isMock: true,
        };
        setImages((prev) => [newImage, ...prev]);
      } finally {
        setLoading(false);
      }
    },
    [selectedStyle, selectedSize, quality]
  );

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generateImage(prompt, true);
  };

  const enhancePrompt = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);

    try {
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert at writing image generation prompts. Take the user's simple description and enhance it into a detailed, vivid prompt that will produce a high-quality image. Include details about lighting, composition, mood, and artistic elements. Return ONLY the enhanced prompt, nothing else.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 300,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const enhanced = data.choices?.[0]?.message?.content || data.content || prompt;
      setPrompt(enhanced);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enhance prompt");
    } finally {
      setEnhancing(false);
    }
  };

  const generateVariations = async () => {
    if (!prompt.trim()) return;
    setGeneratingVariations(true);
    setError(null);

    try {
      const res = await fetch("/api/playground/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Generate 4 creative variations of the given image prompt. Each variation should have a different perspective, mood, or approach while keeping the core concept. Return ONLY the 4 prompts, one per line, numbered 1-4.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 1.0,
          max_tokens: 500,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || data.content || "";
      const variations = content
        .split("\n")
        .filter((l: string) => l.trim())
        .map((l: string) => l.replace(/^\d+[\.\)]\s*/, "").trim())
        .filter((l: string) => l.length > 0)
        .slice(0, 4);

      for (const variation of variations) {
        await generateImage(variation, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate variations");
    } finally {
      setGeneratingVariations(false);
    }
  };

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    if (lightboxImage?.id === id) setLightboxImage(null);
  };

  const downloadImage = (image: GeneratedImage) => {
    if (image.isMock) return;
    const a = document.createElement("a");
    a.href = image.url;
    a.download = `ai-image-${image.id}.png`;
    a.click();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStyleGradient = (styleId: string) => {
    return STYLES.find((s) => s.id === styleId)?.color || "from-gray-400 to-gray-600";
  };

  const renderMockImage = (image: GeneratedImage) => {
    const gradient = getStyleGradient(
      STYLES.find((s) => s.label === image.style)?.id || "photorealistic"
    );
    const [w, h] = image.size.split("x").map(Number);
    const aspectRatio = w / h;

    return (
      <div
        className={`w-full bg-gradient-to-br ${gradient} flex items-center justify-center p-4 rounded-md`}
        style={{ aspectRatio }}
      >
        <div className="text-center text-white/90 max-w-[90%]">
          <Image className="h-8 w-8 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-medium line-clamp-3 break-words">{image.prompt}</p>
          <p className="text-xs opacity-60 mt-1">{image.style}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <Image className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold">Image Generator</h1>
        <Badge variant="secondary" className="text-xs ml-2">{images.length} images</Badge>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Controls */}
        <div className="lg:w-96 border-r overflow-y-auto p-4 space-y-5 flex-shrink-0">
          {/* Prompt Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Image Description</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="min-h-[100px]"
              rows={4}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={enhancePrompt}
                disabled={enhancing || !prompt.trim()}
                className="gap-1.5"
              >
                {enhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Enhance
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateVariations}
                disabled={generatingVariations || !prompt.trim()}
                className="gap-1.5"
              >
                {generatingVariations ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Grid3X3 className="h-3.5 w-3.5" />
                )}
                4 Variations
              </Button>
            </div>
          </div>

          {/* Style Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Style</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id)}
                  className={`relative p-3 rounded-lg border text-left transition-all ${
                    selectedStyle === style.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className={`w-full h-6 rounded bg-gradient-to-r ${style.color} mb-2`} />
                  <p className="text-xs font-medium">{style.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Size Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Size</label>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSize(size.id)}
                  className={`p-2 rounded-md border text-center transition-all ${
                    selectedSize === size.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <p className="text-xs font-medium">{size.aspect}</p>
                  <p className="text-xs text-muted-foreground">{size.id}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Quality</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuality("standard")}
                className={`p-2 rounded-md border text-center transition-all ${
                  quality === "standard"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <p className="text-sm font-medium">Standard</p>
              </button>
              <button
                onClick={() => setQuality("hd")}
                className={`p-2 rounded-md border text-center transition-all ${
                  quality === "hd"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <p className="text-sm font-medium">HD</p>
                <Sparkles className="h-3 w-3 inline text-primary" />
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            Generate Image
          </Button>
        </div>

        {/* Right: Image Gallery */}
        <div className="flex-1 overflow-y-auto p-4">
          {images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Image className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No images generated yet</p>
              <p className="text-sm">Describe an image and click Generate</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden group">
                  <div className="relative">
                    {image.isMock ? (
                      renderMockImage(image)
                    ) : (
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full object-cover cursor-pointer"
                        onClick={() => setLightboxImage(image)}
                      />
                    )}
                    {/* Overlay actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setLightboxImage(image)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                      {!image.isMock && (
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => downloadImage(image)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setPrompt(image.prompt);
                          setSelectedStyle(
                            STYLES.find((s) => s.label === image.style)?.id || "photorealistic"
                          );
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteImage(image.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {image.isMock && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-xs opacity-80">Mock</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm line-clamp-2">{image.prompt}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{image.style}</Badge>
                      <span>{image.size}</span>
                      <span>{image.quality.toUpperCase()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {image.timestamp.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="secondary"
              size="icon"
              className="absolute -top-12 right-0 z-10"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="bg-card rounded-lg overflow-hidden">
              {lightboxImage.isMock ? (
                <div className="p-8">{renderMockImage(lightboxImage)}</div>
              ) : (
                <img
                  src={lightboxImage.url}
                  alt={lightboxImage.prompt}
                  className="w-full max-h-[70vh] object-contain"
                />
              )}
              <div className="p-4 border-t">
                <p className="text-sm">{lightboxImage.prompt}</p>
                {lightboxImage.enhancedPrompt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Enhanced: {lightboxImage.enhancedPrompt}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="outline">{lightboxImage.style}</Badge>
                  <span className="text-xs text-muted-foreground">{lightboxImage.size}</span>
                  <span className="text-xs text-muted-foreground">{lightboxImage.quality.toUpperCase()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(lightboxImage.prompt)}
                    className="ml-auto gap-1"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy Prompt
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
