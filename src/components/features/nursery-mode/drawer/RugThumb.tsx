'use client';

import type { CSSProperties, ReactElement } from 'react';
import { useRecoloredAsset } from '../engine/useRecoloredAsset';
import { useDebouncedValue } from '../engine/useDebouncedValue';

export interface RugPreviewDivProps {
  file: string;
  base: string;
  colors: string[];
  className?: string;
}

/**
 * Cover-fit recolored rug preview div (no button chrome). Used both for the
 * Tapestry backdrop swatch grid and the Scene picker's Tapestry tile.
 * Ported from nursery.jsx's RugPrev (514) + coverStyle (104).
 */
export function RugPreviewDiv({ file, base, colors, className }: RugPreviewDivProps): ReactElement {
  // Debounced: avoids re-recoloring/re-caching the rug SVG on every color-drag input event.
  // The rug is the backdrop, so base is included in its literal palette alongside colors.
  const debouncedBase = useDebouncedValue(base, 200);
  const debouncedColors = useDebouncedValue(colors, 200);
  const asset = useRecoloredAsset(file, [debouncedBase, ...debouncedColors]);
  const style: CSSProperties = {
    backgroundImage: asset ? `url(${asset.objectUrl})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#1c1f2b',
  };
  return <div className={className} style={style} />;
}

export interface RugThumbProps {
  file: string;
  base: string;
  colors: string[];
  selected: boolean;
  onClick: () => void;
  label: string;
}

/** Rug swatch button for the Tapestry backdrop picker. Ported from nursery.jsx:600-603. */
export function RugThumb({ file, base, colors, selected, onClick, label }: RugThumbProps): ReactElement {
  return (
    <button type="button" className={'nursery-patt' + (selected ? ' on' : '')} onClick={onClick}>
      <RugPreviewDiv file={file} base={base} colors={colors} className="pp" />
      <div className="pl">{label}</div>
    </button>
  );
}
