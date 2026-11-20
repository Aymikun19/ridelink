import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

interface Props {
  file: File | null;
  title: string;
  /** width / height of the result */
  aspect?: number;
  round?: boolean;
  /** Long side of the exported image in pixels */
  outputSize?: number;
  saving?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}

const VIEW_W = 288;

/** Drag to position, slide or pinch-free buttons to zoom, then export a JPEG of the framed area. */
export function PhotoEditor({ file, title, aspect = 1, round, outputSize = 640, saving, onCancel, onSave }: Props) {
  const viewW = VIEW_W;
  const viewH = Math.round(VIEW_W / aspect);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setError(null);
    };
    image.onerror = () => setError("This file could not be opened as an image.");
    image.src = u;
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const base = img ? Math.max(viewW / img.naturalWidth, viewH / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dispW = img ? img.naturalWidth * scale : viewW;
  const dispH = img ? img.naturalHeight * scale : viewH;

  const clamp = (x: number, y: number, w = dispW, h = dispH) => ({
    x: Math.max(-(w - viewW) / 2, Math.min((w - viewW) / 2, x)),
    y: Math.max(-(h - viewH) / 2, Math.min((h - viewH) / 2, y)),
  });

  const setZoomClamped = (z: number) => {
    const nz = Math.max(1, Math.min(4, z));
    if (!img) return setZoom(nz);
    const s = base * nz;
    setZoom(nz);
    setPos((p) => clamp(p.x, p.y, img.naturalWidth * s, img.naturalHeight * s));
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos(clamp(drag.current.x + e.clientX - drag.current.px, drag.current.y + e.clientY - drag.current.py));
  };
  const onUp = () => {
    drag.current = null;
  };

  const save = () => {
    if (!img) return;
    const outW = aspect >= 1 ? outputSize : Math.round(outputSize * aspect);
    const outH = Math.round(outW / aspect);
    const r = outW / viewW;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (viewW / 2 + pos.x - dispW / 2) * r, (viewH / 2 + pos.y - dispH / 2) * r, dispW * r, dispH * r);
    canvas.toBlob((b) => (b ? onSave(b) : setError("Could not process the image")), "image/jpeg", 0.88);
  };

  return (
    <Modal open={Boolean(file)} onClose={saving ? undefined : onCancel} title={title} dismissible={!saving}>
      <div className="space-y-5">
        <div
          className={cn(
            "relative mx-auto touch-none select-none overflow-hidden bg-bg",
            round ? "rounded-full" : "rounded-2xl",
            img ? "cursor-grab active:cursor-grabbing" : "",
          )}
          style={{ width: viewW, height: viewH }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {url && img && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{ width: dispW, height: dispH, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
            />
          )}
          <div className={cn("pointer-events-none absolute inset-0 ring-2 ring-inset ring-gold/60", round ? "rounded-full" : "rounded-2xl")} />
        </div>
        {error ? (
          <p className="text-center text-sm text-danger">{error}</p>
        ) : (
          <p className="text-center text-xs text-subtle">Drag to position. Use the slider to zoom.</p>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setZoomClamped(zoom - 0.25)} className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg" aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoomClamped(Number(e.target.value))}
            className="flex-1 accent-[#c9a84c]"
            aria-label="Zoom"
          />
          <button type="button" onClick={() => setZoomClamped(zoom + 0.25)} className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg" aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPos({ x: 0, y: 0 });
            }}
            className="rounded-full p-2 text-muted hover:bg-fg/5 hover:text-fg"
            aria-label="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gold" onClick={save} loading={saving} disabled={!img}>
            Save photo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
