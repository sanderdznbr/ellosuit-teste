import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Buscar endereço...',
  className,
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        console.log('[AddressAutocomplete] Searching:', text);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ', Brasil')}&countrycodes=br&limit=5&addressdetails=1&bounded=1`,
          { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'ElloSuit/1.0' } }
        );
        console.log('[AddressAutocomplete] Response status:', res.status);
        const data: AddressResult[] = await res.json();
        console.log('[AddressAutocomplete] Results:', data.length);
        setResults(data);
        setShowResults(data.length > 0);
      } catch (err) {
        console.error('[AddressAutocomplete] Error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    searchAddress(val);
  };

  const selectAddress = (address: AddressResult) => {
    setQuery(address.display_name);
    onChange(address.display_name);
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder={placeholder}
          className={cn('pl-9 pr-9 rounded-xl', className)}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {showResults && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => selectAddress(r)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-start gap-2 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="line-clamp-2">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
