import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { creatorToCharacter } from '../lib/creatorLibrary';
import type { CreatorRecord } from '../types/domain';

export function useCreatorLibrary(projectId: string) {
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const active = useRef(false);
  const request = useRef<Promise<void> | null>(null);

  const refresh = useCallback((): Promise<void> => {
    if (request.current) return request.current;
    const pending = api<{ creators: CreatorRecord[] }>('/creators')
      .then((response) => {
        if (!active.current) return;
        setCreators(response.creators.map((creator) => ({
          ...creator,
          character: creatorToCharacter(creator),
        })));
        setError('');
      })
      .catch(() => {
        if (active.current) setError('Unable to refresh creator clips. Please retry.');
      })
      .finally(() => {
        request.current = null;
        if (active.current) setLoading(false);
      });
    request.current = pending;
    return pending;
  }, []);

  useEffect(() => {
    active.current = true;
    void refresh();
    const onFocus = () => { void refresh(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [projectId, refresh]);

  return { creators, loading, error, refresh };
}
