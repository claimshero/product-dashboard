import { useState, useEffect, useCallback } from "react";
import type { ClientPartnerSummary } from "~/types/navigation";

const API_BASE = "http://localhost:4001";

export function useClientsPartners() {
  const [clients, setClients] = useState<ClientPartnerSummary[]>([]);
  const [partners, setPartners] = useState<ClientPartnerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API_BASE}/api/clients`),
        fetch(`${API_BASE}/api/partners`),
      ]);
      if (cRes.ok) {
        const data = await cRes.json();
        setClients(data.clients ?? []);
      }
      if (pRes.ok) {
        const data = await pRes.json();
        setPartners(data.partners ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch clients/partners:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { clients, partners, loading, refresh: fetchAll };
}

export function useClientPartnerContent(
  kind: "clients" | "partners",
  slug: string | null,
  filePath: string | null
) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug || !filePath) {
      setContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`${API_BASE}/api/${kind}/${slug}/content?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setContent(data.content ?? null);
      })
      .catch((err) => {
        console.error("Failed to fetch content:", err);
        if (!cancelled) setContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, slug, filePath]);

  return { content, loading };
}
