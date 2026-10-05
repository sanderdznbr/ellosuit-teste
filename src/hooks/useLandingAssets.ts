import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useLandingAssets = () => {
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('landing_page_assets')
          .select('key, url');

        if (!error && data) {
          const assetMap = data.reduce((acc: Record<string, string>, item: any) => {
            acc[item.key] = item.url;
            return acc;
          }, {});
          setAssets(assetMap);
        }
      } catch (err) {
        console.error('Error loading landing assets:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, []);

  return { assets, loading };
};
