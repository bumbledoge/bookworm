/**
 * RatingStars — static or interactive SVG star display with half-star support.
 *
 * Rendering logic:
 *  - Each of the 5 star slots is drawn as a 16×16 SVG.
 *  - A <defs><linearGradient> per star fills the precise fractional portion.
 *    e.g. avgRating 3.7 → stars 1–3 full, star 4 is 70% filled, star 5 is empty.
 */

interface RatingStarsProps {
  /** 0–5, supports fractional values (e.g. 4.3). */
  rating: number;
  /** Total number of reviews; shown next to the stars when provided. */
  count?: number;
  /** Size of each star in pixels. Defaults to 16. */
  size?: number;
  /** When true, renders clickable stars and fires onChange. */
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export function RatingStars({ rating, count, size = 16, interactive = false, onChange, className }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(5, rating));

  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-0.5" role={interactive ? 'radiogroup' : 'img'} aria-label={`Rating: ${clamped.toFixed(1)} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i)); // 0, fraction, or 1
          const id = `star-grad-${i}-${Math.round(clamped * 10)}`;

          if (interactive) {
            return (
              <button
                key={i}
                type="button"
                aria-label={`Rate ${i + 1} star${i !== 0 ? 's' : ''}`}
                onClick={() => onChange?.(i + 1)}
                className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
              >
                <StarSvg id={id} fill={i < clamped ? 1 : 0} size={size} />
              </button>
            );
          }

          return <StarSvg key={i} id={id} fill={fill} size={size} />;
        })}
      </span>
      {count !== undefined && (
        <span className="text-xs text-stone-500">({count.toLocaleString()})</span>
      )}
    </span>
  );
}

function StarSvg({ id, fill, size }: { id: string; fill: number; size: number }) {
  // fill 1 → fully amber, fill 0 → fully gray, fraction → gradient
  const startColor = '#f59e0b'; // brand-500
  const emptyColor = '#d1d5db'; // gray-300

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset={`${fill * 100}%`} stopColor={startColor} />
          <stop offset={`${fill * 100}%`} stopColor={emptyColor} />
        </linearGradient>
      </defs>
      <path
        d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L4.4 12.5l.7-4L2.2 5.7l4-.6z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}
