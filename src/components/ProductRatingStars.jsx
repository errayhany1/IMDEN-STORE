import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import useStore from '../store/useStore';
import {
  fetchProductRating,
  fetchProductRatingSummary,
  hasPurchasedProduct,
  submitProductRating,
} from '../services/productRatings';

/**
 * 1–5 star rating for a product.
 * `readOnly` shows the average only — rating is reserved for the detail views
 * (quick view / product page) so a card tap never records a vote by accident.
 * Interactive rating requires sign-in + a prior purchase of this product.
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
  const setAuthModalOpen = useStore((state) => state.setAuthModalOpen);
  const [avg, setAvg] = useState(0);
  const [count, setCount] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [canRate, setCanRate] = useState(false);
  const [checkingPurchase, setCheckingPurchase] = useState(!readOnly);
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

  useEffect(() => {
    if (readOnly) {
      setCanRate(false);
      setCheckingPurchase(false);
      return undefined;
    }
    let cancelled = false;
    setCheckingPurchase(true);
    if (!user?.uid) {
      setCanRate(false);
      setCheckingPurchase(false);
      return undefined;
    }
    hasPurchasedProduct(product, user).then((ok) => {
      if (cancelled) return;
      setCanRate(Boolean(ok));
      setCheckingPurchase(false);
    }).catch(() => {
      if (cancelled) return;
      setCanRate(false);
      setCheckingPurchase(false);
    });
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.ref, user?.uid, user?.phoneNumber, readOnly]);

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

  const gateMessage = !user?.uid
    ? 'سجّل الدخول بعد الشراء للتقييم'
    : checkingPurchase
      ? 'جاري التحقق…'
      : (!canRate ? 'التقييم بعد شراء المنتج فقط' : '');

  const handleRate = async (stars, event) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy || checkingPurchase) return;

    if (!user?.uid) {
      setAuthModalOpen?.(true);
      setError('سجّل الدخول لتقييم المنتج');
      setTimeout(() => setError(''), 2500);
      return;
    }
    if (!canRate) {
      setError('التقييم متاح فقط بعد شراء هذا المنتج');
      setTimeout(() => setError(''), 2500);
      return;
    }

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
      if (err?.code === 'auth_required') {
        setAuthModalOpen?.(true);
        setError('سجّل الدخول لتقييم المنتج');
      } else if (err?.code === 'purchase_required') {
        setCanRate(false);
        setError('التقييم متاح فقط بعد شراء هذا المنتج');
      } else {
        setError('تعذّر حفظ التقييم');
      }
      setTimeout(() => setError(''), 2500);
    } finally {
      setBusy(false);
      setHover(0);
    }
  };

  const interactive = Boolean(user?.uid && canRate && !checkingPurchase);

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
              disabled={busy || checkingPurchase}
              onMouseEnter={() => interactive && setHover(star)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => interactive && setHover(star)}
              onBlur={() => setHover(0)}
              onClick={(e) => handleRate(star, e)}
              className={`p-0.5 rounded transition-transform active:scale-90 disabled:opacity-60
                  ${busy || checkingPurchase ? 'cursor-wait' : 'cursor-pointer hover:scale-110'}`}
              title={interactive ? `تقييم ${star} من 5` : (gateMessage || `تقييم ${star} من 5`)}
              aria-label={`تقييم ${star} نجوم`}
              aria-pressed={myRating === star}
              aria-disabled={!interactive}
            >
              <Star
                size={size}
                strokeWidth={1.75}
                className={starClass(star <= displayValue)}
              />
            </button>
          ))}
        </div>
        {scoreLabel || ((interactive || myRating) && emptyHint ? (
          <span className={`text-[10px] leading-none ${darkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            {emptyHint}
          </span>
        ) : null)}
      </div>
      {(justRated || error || (!myRating && gateMessage && !checkingPurchase)) && (
        <span
          className={`text-[10px] leading-none ${
            error
              ? 'text-red-500'
              : justRated
                ? (darkMode ? 'text-emerald-400' : 'text-emerald-600')
                : (darkMode ? 'text-gray-500' : 'text-slate-400')
          }`}
        >
          {error || (justRated ? 'شكراً على تقييمك' : gateMessage)}
        </span>
      )}
    </div>
  );
};

export default ProductRatingStars;
