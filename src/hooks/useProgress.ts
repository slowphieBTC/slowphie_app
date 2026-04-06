import { useState, useCallback } from 'react';
import type { UserProgress } from '../types';

const KEY = 'opschool_progress';
const DEF: UserProgress = { completedModules: [], quizScores: {}, lastAccessedModule: null };

function load(): UserProgress {
  try { const r = localStorage.getItem(KEY); return r ? { ...DEF, ...JSON.parse(r) } : { ...DEF }; } catch { return { ...DEF }; }
}
function save(p: UserProgress) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} }

export function useProgress() {
  const [progress, setProgress] = useState<UserProgress>(load);

  const saveQuizScore = useCallback((moduleId: number, score: number) => {
    setProgress(prev => {
      const next: UserProgress = { ...prev, quizScores: { ...prev.quizScores, [moduleId]: score }, completedModules: score >= 50 ? Array.from(new Set([...prev.completedModules, moduleId])) : prev.completedModules.filter(id => id !== moduleId), lastAccessedModule: moduleId };
      save(next); return next;
    });
  }, []);

  const isModuleUnlocked = useCallback((moduleId: number): boolean => {
    if (moduleId === 1) return true;
    const p = load(); const s = p.quizScores[moduleId - 1] ?? null; return s !== null && s >= 50;
  }, []);

  const isModuleCompleted = useCallback((moduleId: number): boolean => {
    const p = load(); const s = p.quizScores[moduleId] ?? null; return s !== null && s >= 50;
  }, []);

  const getQuizScore = useCallback((moduleId: number): number | null => progress.quizScores[moduleId] ?? null, [progress]);

  const getOverallProgress = useCallback((): number => {
    const p = load(); const c = Object.values(p.quizScores).filter(s => s >= 50).length;
    return Math.round((c / 7) * 100);
  }, []);

  return { progress, isModuleUnlocked, isModuleCompleted, saveQuizScore, getQuizScore, getOverallProgress };
}
