"use client";

import { useState } from "react";

function hueFromSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
}

function identiconCells(seed: string): boolean[] {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = (hash >>> 0) || 1;
  const nextBit = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return (state & 1) === 1;
  };

  const cells = new Array<boolean>(25).fill(false);
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const enabled = nextBit();
      cells[row * 5 + column] = enabled;
      cells[row * 5 + (4 - column)] = enabled;
    }
  }
  return cells;
}

interface UserAvatarProps {
  seed: string;
  name: string;
  url?: string | null;
  size?: "nav" | "profile";
  busy?: boolean;
  className?: string;
}

export function UserAvatar({
  seed,
  name,
  url,
  size = "nav",
  busy = false,
  className = "",
}: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const hue = hueFromSeed(seed);
  const showImage = Boolean(url && failedUrl !== url);

  return (
    <span
      className={`user-avatar user-avatar-${size}${busy ? " is-busy" : ""}${className ? ` ${className}` : ""}`}
      aria-busy={busy || undefined}
    >
      {showImage ? (
        // The URL is user-controlled storage and may be remote, so next/image cannot safely infer its host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url || undefined} alt={`${name}'s profile photo`} onError={() => setFailedUrl(url || null)} />
      ) : (
        <span className="user-avatar-identicon" aria-hidden="true" style={{ background: `hsl(${hue} 70% 94%)` }}>
          <svg viewBox="0 0 5 5" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {identiconCells(seed).map((enabled, index) =>
              enabled ? (
                <rect
                  key={index}
                  x={index % 5}
                  y={Math.floor(index / 5)}
                  width="1"
                  height="1"
                  fill={`hsl(${hue} 52% 42%)`}
                />
              ) : null,
            )}
          </svg>
        </span>
      )}
      {busy ? <span className="user-avatar-spinner" aria-hidden="true" /> : null}
    </span>
  );
}
