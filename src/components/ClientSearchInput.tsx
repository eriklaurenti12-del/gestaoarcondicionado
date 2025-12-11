import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, User } from "lucide-react";

interface Client {
  id: number;
  name: string;
  telefone?: string | null;
}

interface ClientSearchInputProps {
  clients: Client[] | undefined;
  value: string;
  onSelect: (client: Client) => void;
  onClear: () => void;
  selectedClient?: Client | null;
  placeholder?: string;
  className?: string;
}

export default function ClientSearchInput({
  clients,
  value,
  onSelect,
  onClear,
  selectedClient,
  placeholder = "Buscar cliente por nome ou telefone...",
  className = ""
}: ClientSearchInputProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clients || !search.trim()) return [];
    const term = search.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(term) ||
      (c.telefone && c.telefone.includes(term))
    ).slice(0, 8);
  }, [clients, search]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setSearch('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setSearch('');
  };

  if (selectedClient) {
    return (
      <div className={`flex items-center justify-between p-3 bg-muted rounded-md ${className}`}>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{selectedClient.name}</p>
            {selectedClient.telefone && (
              <p className="text-xs text-muted-foreground">{selectedClient.telefone}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 min-h-[44px]"
        />
      </div>
      
      {isOpen && filteredClients.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg mt-1 py-1 max-h-[200px] overflow-y-auto">
          {filteredClients.map((client) => (
            <button
              key={client.id}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2"
              onClick={() => handleSelect(client)}
            >
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{client.name}</p>
                {client.telefone && (
                  <p className="text-xs text-muted-foreground">{client.telefone}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {isOpen && search.trim() && filteredClients.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg mt-1 p-3 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado
        </div>
      )}
    </div>
  );
}
