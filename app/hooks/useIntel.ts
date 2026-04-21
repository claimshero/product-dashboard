import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:4001";

// --- Types ---

export interface CompetitorSummary {
  slug: string;
  name: string;
  category: string;
  threatLevel: string;
  lastUpdated: string;
  signalCount: number;
}

export interface IntelSignal {
  slug: string;
  date: string;
  source: string;
  competitor: string;
  signalType: string;
  relevance: string;
  relatedBets: string[];
  title: string;
}

export interface BriefingSummary {
  date: string;
  signalsCount: number;
  criticalSignals: number;
  sourcesChecked: number;
}

export interface WeeklyBriefingSummary {
  week: string;
  dates: string;
  signalsCount: number;
  criticalSignals: number;
}

export interface PartnershipSummary {
  slug: string;
  name: string;
  status: string;
  type: string;
  counterpart: string;
  firstContact: string;
  lastUpdated: string;
}

// --- Hooks ---

export function useCompetitors() {
  const [competitors, setCompetitors] = useState<CompetitorSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API_BASE}/api/intel/competitors`)
      .then((r) => r.json())
      .then((data) => setCompetitors(data.competitors ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { competitors, loading, refresh };
}

export function useCompetitorProfile(slug: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) { setContent(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/competitors/${slug}/profile`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  return { content, loading };
}

export function useCompetitorSignals(slug: string | null) {
  const [signals, setSignals] = useState<IntelSignal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) { setSignals([]); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/competitors/${slug}/signals`)
      .then((r) => r.json())
      .then((data) => setSignals(data.signals ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  return { signals, loading };
}

export function useSignalContent(type: string | null, slug: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type || !slug) { setContent(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/signals/${type}/${slug}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type, slug]);

  return { content, loading };
}

export function useBriefings() {
  const [briefings, setBriefings] = useState<BriefingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API_BASE}/api/intel/briefings`)
      .then((r) => r.json())
      .then((data) => setBriefings(data.briefings ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { briefings, loading, refresh };
}

export function useBriefingContent(date: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) { setContent(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/briefings/${date}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [date]);

  return { content, loading };
}

export function useWeeklyBriefings() {
  const [briefings, setBriefings] = useState<WeeklyBriefingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API_BASE}/api/intel/briefings/weekly`)
      .then((r) => r.json())
      .then((data) => setBriefings(data.briefings ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { briefings, loading, refresh };
}

export function useWeeklyBriefingContent(week: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!week) { setContent(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/briefings/weekly/${week}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [week]);

  return { content, loading };
}

export function useIntelPartnerships() {
  const [partnerships, setPartnerships] = useState<PartnershipSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API_BASE}/api/intel/partnerships`)
      .then((r) => r.json())
      .then((data) => setPartnerships(data.partnerships ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { partnerships, loading, refresh };
}

export function usePartnershipContent(slug: string | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!slug) { setContent(null); return; }
    setLoading(true);
    fetch(`${API_BASE}/api/intel/partnerships/${slug}`)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  return { content, loading };
}

export function useStrategyDoc(docType: "strategic-context" | "watch-list" | "sources" | null) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docType) { setContent(null); return; }

    const endpoint = docType === "strategic-context"
      ? `${API_BASE}/api/intel/strategy`
      : docType === "watch-list"
        ? `${API_BASE}/api/intel/watch-list`
        : `${API_BASE}/api/intel/sources`;

    setLoading(true);
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => setContent(data.content ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [docType]);

  return { content, loading };
}

export function useMarketSignals() {
  const [signals, setSignals] = useState<IntelSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    fetch(`${API_BASE}/api/intel/market-signals`)
      .then((r) => r.json())
      .then((data) => setSignals(data.signals ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { signals, loading, refresh };
}
