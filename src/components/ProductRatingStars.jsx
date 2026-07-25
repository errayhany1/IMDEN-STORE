import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import useStore from '../store/useStore';
import {
  fetchProductRating,
  fetchProductRatingSummary,
  submitProductRating,
} from '../services/productRatings';

/**
 * 1–5 star rating for a product.
 * `readOnly` shows the average only — rating is reserved for the detail views
 * (quick view / product page) so a card tap never records a vote by accident.
 */
const ProductRatingStars = ({
  product,
  darkMode = false,
  readOnly = false,
  onRequestRate,
  size = 14,
  className = '',
  emptyHint = 'أضف تقييمك',
}) => {
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
    const load = readOnly
      ? fetchProductRatingSummary(product)
      : fetchProductRating(product, user);
    load.then((data) => {
      if (cancelled) return;
      setAvg(data.avg || 0);
      setCount(data.count || 0);
      setMyRating(data.myRating || 0);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.ref, user?.uid, readOnly]);

  const displayValue = readOnly
    ? Math.round(avg)
    : (hover || myRating || Math.round(avg) || 0);

  const starClass = (filled) => (filled
    ? 'text-amber-400 fill-amber-400'
    : darkMode ? 'text-gray-600' : 'text-slate-300');

  const scoreLabel = count > 0
    ? (
      <span className={`text-[10px] tabular-nums leading-none ${darkMode ? 'text-gray-400' : 'text-slate-400'}`}>
        {avg.toFixed(1)}
        <span className="opacity-70"> ({count})</span>
      </span>
    )
    : null;

  if (readOnly) {
    const Wrapper = onRequestRate ? 'button' : 'div';
    return (
      <Wrapper
        {...(onRequestRate
          ? {
            type: 'button',
            onClick: (e) => { e.stopPropagation(); onRequestRate(); },
            title: 'افتح المنتج لإضافة تقييم',
            'aria-label': 'افتح المنتج لإضافة تقييم',
          }
          : {})}
        className={`flex items-center gap-1.5 flex-row-reverse min-w-0 ${onRequestRate ? 'cursor-pointer' : ''} ${className}`}
      >
        <div className="flex items-center gap-0.5 flex-row-reverse shrink-0" dir="ltr" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={size}
              strokeWidth={1.75}
              className={starClass(star <= displayValue)}
            />
          ))}
        </div>
        {scoreLabel}
      </Wrapper>
    );
  }

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
      className={`flex flex-col items-end gap-0.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="group"
      aria-label="تقييم المنتج"
    >
      <div className="flex items-center gap-1.5 flex-row-reverse">
        <div className="flex items-center gap-0.5 flex-row-reverse" dir="ltr">
          {[1, 2, 3, 4, 5].map((star) => (
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
                size={size}
                strokeWidth={1.75}
                className={starClass(star <= displayValue)}
              />
            </button>
          ))}
        </div>
        {scoreLabel || (emptyHint && (
          <span className={`text-[10px] leading-none ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            {emptyHint}
          </span>
        ))}
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
