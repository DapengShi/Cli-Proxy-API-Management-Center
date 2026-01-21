import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CollapsibleContent.module.scss';

interface CollapsibleContentProps {
  content: string;
  maxPreviewLength?: number;
  className?: string;
}

export function CollapsibleContent({
  content,
  maxPreviewLength = 200,
  className = '',
}: CollapsibleContentProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // 不需要折叠的情况
  if (content.length <= maxPreviewLength) {
    return <span className={className}>{content}</span>;
  }

  // 尝试美化 JSON 内容
  const formatContent = (text: string): string => {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return text;
    }
  };

  const formattedContent = formatContent(content);
  const preview = content.substring(0, maxPreviewLength);

  return (
    <span className={`${styles.collapsibleWrapper} ${className}`}>
      {isExpanded ? (
        <span className={styles.expandedContent}>
          <pre className={styles.contentBlock}>{formattedContent}</pre>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
            title={t('logs.collapse')}
          >
            {t('logs.collapse')}
          </button>
        </span>
      ) : (
        <span className={styles.collapsedContent}>
          <span className={styles.preview}>{preview}...</span>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(true);
            }}
            title={t('logs.expand')}
          >
            {t('logs.expand')} ({Math.ceil(content.length / 1024)}KB)
          </button>
        </span>
      )}
    </span>
  );
}
