import { useEffect, useState } from 'react';
import { checkoutApi, getErrorMessage } from '@/services/api';
import type { CheckoutSummary, CheckoutSummaryInput } from '@/types';

interface State {
  summary: CheckoutSummary | null;
  error: string | null;
  loading: boolean;
}

/**
 * Fetches the server-calculated order summary and refetches when the inputs or
 * `cartKey` (any value that changes when the cart changes) change.
 */
export function useCheckoutSummary(input: CheckoutSummaryInput, cartKey: string, enabled = true): State {
  const { couponCode, pointsToRedeem, deliverySpeed } = input;
  const [state, setState] = useState<State>({ summary: null, error: null, loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setState({ summary: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    checkoutApi
      .summary({ couponCode, pointsToRedeem, deliverySpeed }, true)
      .then((summary) => {
        if (!cancelled) setState({ summary, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState((s) => ({ summary: s.summary, error: getErrorMessage(err), loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [couponCode, pointsToRedeem, deliverySpeed, cartKey, enabled]);

  return state;
}
