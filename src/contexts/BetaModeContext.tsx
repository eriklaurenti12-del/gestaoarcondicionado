import React, { createContext, useContext, useState, useEffect } from 'react';

interface BetaModeContextType {
  isBeta: boolean;
  toggleBeta: () => void;
}

const BetaModeContext = createContext<BetaModeContextType | undefined>(undefined);

export const BetaModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isBeta, setIsBeta] = useState(() => {
    return localStorage.getItem('ac_beta_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ac_beta_mode', String(isBeta));
  }, [isBeta]);

  const toggleBeta = () => setIsBeta(prev => !prev);

  return (
    <BetaModeContext.Provider value={{ isBeta, toggleBeta }}>
      {children}
    </BetaModeContext.Provider>
  );
};

export const useBetaMode = () => {
  const context = useContext(BetaModeContext);
  if (!context) throw new Error('useBetaMode must be used within BetaModeProvider');
  return context;
};
