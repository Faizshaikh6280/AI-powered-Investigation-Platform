'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient, Case, CaseCreatePayload, CaseDetail } from '../services/apiClient';

interface CaseContextType {
  cases: Case[];
  activeCase: Case | null;
  activeCaseDetail: CaseDetail | null;
  isLoading: boolean;
  error: string | null;
  setActiveCaseId: (id: string) => void;
  refreshCases: () => Promise<void>;
  createCase: (payload: CaseCreatePayload) => Promise<Case>;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

export function CaseProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCaseId, setActiveCaseIdState] = useState<string | null>(null);
  const [activeCaseDetail, setActiveCaseDetail] = useState<CaseDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.listCases();
      setCases(data);
      if (data.length > 0) {
        // If no active case selected, select the first/latest one
        setActiveCaseIdState((prev) => (prev && data.some(c => c.case_id === prev) ? prev : data[0].case_id));
      } else {
        setActiveCaseIdState(null);
        setActiveCaseDetail(null);
      }
    } catch (err: any) {
      console.error('Failed to load cases:', err);
      setError(err.message || 'Failed to connect to investigation backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Load detailed case info whenever activeCaseId changes
  useEffect(() => {
    if (!activeCaseId) {
      setActiveCaseDetail(null);
      return;
    }
    apiClient.getCaseDetails(activeCaseId)
      .then(detail => setActiveCaseDetail(detail))
      .catch(err => {
        console.warn(`Could not load details for case ${activeCaseId}:`, err);
      });
  }, [activeCaseId]);

  const setActiveCaseId = useCallback((id: string) => {
    setActiveCaseIdState(id);
  }, []);

  const createCase = useCallback(async (payload: CaseCreatePayload): Promise<Case> => {
    const newCase = await apiClient.createCase(payload);
    await fetchCases();
    setActiveCaseIdState(newCase.case_id);
    return newCase;
  }, [fetchCases]);

  const activeCase = cases.find(c => c.case_id === activeCaseId) || null;

  return (
    <CaseContext.Provider
      value={{
        cases,
        activeCase,
        activeCaseDetail,
        isLoading,
        error,
        setActiveCaseId,
        refreshCases: fetchCases,
        createCase,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useCase() {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCase must be used within a CaseProvider');
  }
  return context;
}
