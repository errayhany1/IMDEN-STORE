import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import useStore from '../store/useStore';
import { fetchProductRating, submitProductRating } from '../services/productRatings';

/**
 * Interactive 1–5 star rating for a product card.
 * Shows average + vote count; click a star to submit/update your rating.
 */
const ProductRatingStars = ({ product, darkMode = false }) => {
  const user = useStore((state) => state.user);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const [justRated, setJustRated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchProductRating(product, user).then((data) => {
      if (cancelled) return;
      setAvg(data.avg || 0);
      setCount(data.count || 0);
      setMyRating(data.myRating || 0);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.ref, user?.uid]);

  const displayValue = hover || myRating || Math.round(avg) || 0;

  const handleRate = async (stars, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await submitProductRating(product, stars, user);
      setAvg(result.avg);
      setCount(result.count);
      setMyRating(result.myRating);
      setJustRated(true);
      setTimeout(() => setJustRated(false), 1600);
    } catch (err) {
      console.warn('submitProductRating failed:', err?.message || err);
      setError('تعذّر حفظ التقييم');
      setTimeout(() => setError(''), 2500);
    } finally {
      setBusy(false);
      setHover(0);
    }
  };

  return (
    <div
      className="flex flex-col items-end gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="تقييم المنتج"
    >
      <div className="flex items-center gap-1.5 flex-row-reverse">
        <div className="flex items-center gap-0.5 flex-row-reverse" dir="ltr">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= displayValue;
            return (
              <button
                key={star}
                type="button"
                disabled={busy}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onFocus={() => setHover(star)}
                onBlur={() => setHover(0)}
                onClick={(e) => handleRate(star, e)}
                className={`p-0.5 rounded transition-transform active:scale-90 disabled:opacity-60
                  ${busy ? 'cursor-wait' : 'cursor-pointer hover:scale-110'}`}
                title={`تقييم ${star} من 5`}
                aria-label={`تقييم ${star} نجوم`}
                aria-pressed={myRating === star}
              >
                <Star
                  size={14}
                  strokeWidth={1.75}
                  className={
                    filled
                      ? 'text-amber-400 fill-amber-400'
                      : darkMode
                        ? 'text-gray-600'
                        : 'text-slate-300'
                  }
                />
              </button>
            );
          })}
        </div>
        {count > 0 ? (
          <span
            className={`text-[10px] tabular-nums leading-none ${
              darkMode ? 'text-gray-400' : 'text-slate-400'
            }`}
          >
            {avg.toFixed(1)}
            <span className="opacity-70"> ({count})</span>
          </span>
        ) : (
          <span
            className={`text-[10px] leading-none ${
              darkMode ? 'text-gray-500' : 'text-slate-400'
            }`}
          >
            قيّم
          </span>
        )}
      </div>
      {(justRated || error) && (
        <span
          className={`text-[10px] leading-none ${
            error ? 'text-red-500' : darkMode ? 'text-emerald-400' : 'text-emerald-600'
          }`}
        >
          {error || 'شكراً على تقييمك'}
        </span>
      )}
    </div>
  );
};

export default ProductRatingStars;
