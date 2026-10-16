import { useCallback, useEffect, useState } from 'react';
import { gas } from '../lib/gas.js';

/** Ejecuta una función de COI V1 al montar (y cuando cambian los argumentos). */
export function useGas(fn, ...args) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(args);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    gas(fn, ...JSON.parse(key))
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => { alive = false; };
  }, [fn, key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
