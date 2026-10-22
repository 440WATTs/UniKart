"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageIcon } from "@/components/icons";

/** next/image with a visible placeholder when the file is missing or fails to load. */
export function ListingImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-paper text-xs text-muted" role="img" aria-label={`${props.alt} (photo unavailable)`}>
        <ImageIcon size={32} />
        Photo unavailable
      </div>
    );
  }
  // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed through props
  return <Image {...props} onError={() => setFailed(true)} />;
}
