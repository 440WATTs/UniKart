"use client";
import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon } from "@/components/icons";
import { ListingImage } from "@/components/product/ListingImage";

export function Gallery({ images, title }: { images: { url: string }[]; title: string }) {
  const [i, setI] = useState(0);
  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg border border-line bg-paper text-muted">
        <ImageIcon size={56} />
        <span className="sr-only">No photos</span>
      </div>
    );
  }
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);
  return (
    <div>
      <div
        className="relative aspect-square overflow-hidden rounded-lg border border-line bg-white"
        role="region"
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0].clientX))}
        onTouchEnd={(e) => {
          const start = Number((e.currentTarget as HTMLElement).dataset.x);
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <ListingImage
          key={images[i].url}
          src={images[i].url}
          alt={`${title} — photo ${i + 1} of ${images.length}`}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain"
          priority
        />
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full border-2 border-ink bg-white/90 p-2">
              <ChevronLeft />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full border-2 border-ink bg-white/90 p-2">
              <ChevronRight />
            </button>
            <p className="absolute right-2 bottom-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white" aria-live="polite">
              {i + 1} / {images.length}
            </p>
          </>
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, n) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show photo ${n + 1}`}
                aria-current={n === i}
                className={`relative block h-16 w-16 overflow-hidden rounded border-2 ${n === i ? "border-ink" : "border-transparent opacity-70"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
