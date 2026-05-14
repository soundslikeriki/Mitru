import { type ImgHTMLAttributes, useEffect, useState } from "react";
import { loadImageAsset } from "@/lib/image-storage";

type ImageAssetProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

export function ImageAsset({ src, alt, ...props }: ImageAssetProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    setResolvedSrc(src);
    if (!src) return;

    void loadImageAsset(src)
      .then((asset) => {
        if (!cancelled) setResolvedSrc(asset || src);
      })
      .catch(() => {
        if (!cancelled) setResolvedSrc(src);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src) return null;
  return <img src={resolvedSrc} alt={alt} {...props} />;
}
