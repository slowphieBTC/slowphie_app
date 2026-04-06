import { useCallback } from 'react';

const KEY = 'opschool_exercises';
function loadAll(): Record<string, string> { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } }

export function useExercises() {
  const getExercise = useCallback((mId: number, eId: string): string => loadAll()[`${mId}_${eId}`] ?? '', []);
  const saveExercise = useCallback((mId: number, eId: string, text: string) => {
    try { const a = loadAll(); a[`${mId}_${eId}`] = text; localStorage.setItem(KEY, JSON.stringify(a)); } catch {}
  }, []);
  return { getExercise, saveExercise };
}
