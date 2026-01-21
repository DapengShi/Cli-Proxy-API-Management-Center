/**
 * Quota management page - coordinates the three quota sections.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useAuthStore, useQuotaStore } from '@/stores';
import { authFilesApi, configFileApi } from '@/services/api';
import {
  QuotaSection,
  ANTIGRAVITY_CONFIG,
  CODEX_CONFIG,
  GEMINI_CLI_CONFIG,
  CLAUDE_CONFIG,
} from '@/components/quota';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import type { AuthFileItem } from '@/types';
import styles from './QuotaPage.module.scss';

export function QuotaPage() {
  const { t } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);

  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshingAll, setRefreshingAll] = useState(false);
  const refreshAllAbortRef = useRef<(() => void) | null>(null);

  const disableControls = connectionStatus !== 'connected';

  const loadConfig = useCallback(async () => {
    try {
      await configFileApi.fetchConfigYaml();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError((prev) => prev || errorMessage);
    }
  }, [t]);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await authFilesApi.list();
      setFiles(data?.files || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleHeaderRefresh = useCallback(async () => {
    await Promise.all([loadConfig(), loadFiles()]);
  }, [loadConfig, loadFiles]);

  useHeaderRefresh(handleHeaderRefresh);

  const refreshAllQuotas = useCallback(async () => {
    if (refreshingAll || disableControls) return;

    setRefreshingAll(true);
    setError('');
    let aborted = false;
    refreshAllAbortRef.current = () => {
      aborted = true;
    };

    try {
      // Step 1: Refresh config and fetch latest files
      await loadConfig();
      if (aborted) return;

      const latestFiles = await authFilesApi.list();
      const filesList = latestFiles?.files || [];

      if (aborted) return;

      // Update files state
      setFiles(filesList);

      // Step 2: Get all quota stores
      const quotaStore = useQuotaStore.getState();

      // Step 3: Collect all files by type
      const configs = [
        ANTIGRAVITY_CONFIG,
        CODEX_CONFIG,
        GEMINI_CLI_CONFIG,
        CLAUDE_CONFIG,
      ];

      // Step 4: Fetch quota for all files
      for (const config of configs) {
        if (aborted) break;

        const filteredFiles = filesList.filter((file) => config.filterFn(file));
        if (filteredFiles.length === 0) continue;

        // Set loading state for all files in this section
        const setter = quotaStore[config.storeSetter] as (updater: any) => void;
        setter((prev: any) => {
          const nextState = { ...prev };
          filteredFiles.forEach((file) => {
            nextState[file.name] = config.buildLoadingState();
          });
          return nextState;
        });

        // Fetch all quotas in parallel
        const results = await Promise.all(
          filteredFiles.map(async (file) => {
            try {
              const data = await config.fetchQuota(file, t);
              return { name: file.name, status: 'success' as const, data };
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : t('common.unknown_error');
              const errorStatus = (err as any)?.status;
              return { name: file.name, status: 'error' as const, error: message, errorStatus };
            }
          })
        );

        if (aborted) break;

        // Update quota states
        setter((prev: any) => {
          const nextState = { ...prev };
          results.forEach((result) => {
            if (result.status === 'success') {
              nextState[result.name] = config.buildSuccessState(result.data as any);
            } else {
              nextState[result.name] = config.buildErrorState(
                result.error || t('common.unknown_error'),
                result.errorStatus
              );
            }
          });
          return nextState;
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t('notification.refresh_failed');
      setError(errorMessage);
    } finally {
      if (!aborted) {
        setRefreshingAll(false);
        refreshAllAbortRef.current = null;
      }
    }
  }, [refreshingAll, disableControls, loadConfig, t]);

  useEffect(() => {
    loadFiles();
    loadConfig();
  }, [loadFiles, loadConfig]);

  useEffect(() => {
    return () => {
      if (refreshAllAbortRef.current) {
        refreshAllAbortRef.current();
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.pageTitle}>{t('quota_management.title')}</h1>
            <p className={styles.description}>{t('quota_management.description')}</p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={refreshAllQuotas}
            disabled={disableControls || refreshingAll || loading}
            loading={refreshingAll}
            title={t('quota_management.refresh_all_quotas')}
          >
            {!refreshingAll && <IconRefreshCw size={18} />}
            {t('quota_management.refresh_all_quotas')}
          </Button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <QuotaSection
        config={ANTIGRAVITY_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={CODEX_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={GEMINI_CLI_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
      <QuotaSection
        config={CLAUDE_CONFIG}
        files={files}
        loading={loading}
        disabled={disableControls}
      />
    </div>
  );
}
