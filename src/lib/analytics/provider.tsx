// SPDX-License-Identifier: AGPL-3.0-only
"use client";

import { useEffect, createContext, useContext } from "react";
import { initAnalytics, type AnalyticsConfig } from "./client";

const AnalyticsContext = createContext<AnalyticsConfig>({ enabled: false });

export function AnalyticsProvider({
  config,
  children,
}: {
  config: AnalyticsConfig;
  children: React.ReactNode;
}) {
  useEffect(() => {
    initAnalytics(config);
  }, [config]);

  return (
    <AnalyticsContext.Provider value={config}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsConfig() {
  return useContext(AnalyticsContext);
}
