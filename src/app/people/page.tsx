'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";

const leadStages = ["All", "New", "Follow Up", "Proposal", "Won", "Lost"] as const;
type LeadStage = (typeof leadStages)[number];

const sourceFilters = ["All Sources", "Glofox", "Trainerize", "Stripe", "Starling", "Ads"] as const;
type SourceFilter = (typeof sourceFilters)[number];

const defaultCsvColumns = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "channel",
  "stage",
  "owner",
  "next_step",
  "value",
  "notes",
  "membership_name",
  "membership_plan",
  "total_bookings",
  "last_booking",
  "total_attendances",
  "credits_remaining",
  "custom_ref",
] as const;

const csvColumns = defaultCsvColumns as unknown as string[];

const DONT_IMPORT = "__DONT_IMPORT__";

const searchHints = [
  "Name",
  "Email",
  "Phone",
  "Stripe customer id",
  "Glofox member id",
  "Bank reference name",
];

type LeadRow = {
  id: string;
  name: string;
  statusLabel?: string;
  statusTone?: "lead" | "client" | string;
  source?: string | null;
  channel: string;
  stage: string;
  owner: string;
  next: string;
  value: string;
};

type LeadProfile = {
  name: string;
  initials: string;
  title: string;
  email: string;
  phone: string;
  status?: string;
  statusTone?: "lead" | "client" | string;
  source?: string;
  tags: string[];
  identities: { label: string; value: string }[];
  stats: {
    lifetimeSpend: string;
    memberships: string;
    lastPayment: string;
    lastAttendance: string;
  };
  payments: {
    date: string;
    source: string;
    amount: string;
    product: string;
    status: string;
  }[];
  history: {
    date: string;
    timestamp: string;
    source: string;
    amount: string;
    product: string;
    status: string;
    reference?: string | null;
  }[];
  manualMatches: {
    reference: string;
    amount: string;
    date: string;
    note: string;
  }[];
  notes: { author: string; content: string; timestamp: string }[];
};

function createDefaultStats() {
  return {
    lifetimeSpend: "€0",
    memberships: "Unassigned",
    lastPayment: "—",
    lastAttendance: "—",
  };
}

function createProfileTemplate(name: string): LeadProfile {
  const trimmedName = name.trim() || "Imported Lead";
  const parts = trimmedName.split(/\s+/).filter(Boolean);
  const initials = (
    (parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? parts[0]?.charAt(1) ?? "")
  ).toUpperCase();

  return {
    name: trimmedName,
    initials: initials || "BG",
    title: "Lead",
    email: "",
    phone: "",
    tags: [],
    identities: [],
    stats: createDefaultStats(),
    payments: [],
    history: [],
    manualMatches: [],
    notes: [],
  };
}

const defaultMapping = {
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  phone: "phone",
  channel: "channel",
  value: "value",
  membership_name: "membership_name",
  total_bookings: "total_bookings",
  last_booking: "last_booking",
  credits_remaining: "credits_remaining",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(current);
      rows.push([...row]);
      row.length = 0;
      current = "";
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push([...row]);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

const membershipOptions = [
  "Barn Gym Membership",
  "6 Week Transformation",
  "Personal Training",
  "Pay As You Go Classes",
  "Online Coaching",
] as const;

type ApiLead = {
  id: string;
  externalId: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName?: string | null;
  email: string | null;
  phone: string | null;
  channel: string | null;
  stage: string | null;
  owner: string | null;
  nextStep: string | null;
  valueMinor: number | null;
  membershipName: string | null;
  membershipEndDate?: string | null; // Added
  source: string | null;
  status: string | null;
  metadata: unknown;
  hasPurchases?: boolean;
  isClient?: boolean;
};

const formatMinorToCurrency = (minor?: number | null, currency = "EUR") => {
  if (minor === null || minor === undefined) return null;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(minor / 100);
};

const parseCurrencyToMinor = (value: string) => {
  if (!value?.trim()) return null;
  const normalized = value.replace(/[^0-9-.,]/g, "").replace(/,/g, "");
  const amount = Number(normalized);
  if (Number.isNaN(amount)) return null;
  return Math.round(amount * 100);
};

const isLeadProfile = (value: unknown): value is LeadProfile => {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "stats" in value &&
    "payments" in value
  );
};

const computeDisplayName = (lead: ApiLead, metadataContact?: { first_name?: string; firstName?: string; last_name?: string; lastName?: string }) => {
  const metadataFirst =
    metadataContact?.first_name ??
    metadataContact?.firstName;
  const metadataLast =
    metadataContact?.last_name ??
    metadataContact?.lastName;

  if (lead.fullName && lead.fullName.trim()) {
    return lead.fullName.trim();
  }

  const fromNames = [lead.firstName ?? "", lead.lastName ?? ""]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const metadataNames = [metadataFirst ?? "", metadataLast ?? ""]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  return (
    fromNames ||
    metadataNames ||
    lead.email ||
    "Unnamed Lead"
  );
};

const getStatusInfo = (status?: string | null, source?: string | null, hasPurchases?: boolean) => {
  const normalizedStatus = status ? status.toUpperCase() : null;
  const sourceLower = (source ?? "").toLowerCase();
  const fromAds = sourceLower === "ads" || sourceLower.startsWith("ads ");
  const fromGhl = fromAds || sourceLower.includes("ghl");

  if (normalizedStatus === "CLIENT") {
    return { label: "Client", tone: "client" as const, sourceLabel: source ?? "Converted" };
  }
  if (!hasPurchases && ((normalizedStatus === "LEAD" && fromGhl) || fromGhl)) {
    return { label: "Lead (from Ads)", tone: "lead" as const, sourceLabel: source ?? "Ads (GHL Webhook)" };
  }
  return null;
};

const buildProfileFromLead = (lead: ApiLead, displayName: string): LeadProfile => {
  const statusInfo = getStatusInfo(lead.isClient ? "CLIENT" : lead.status, lead.source, lead.hasPurchases);
  const initials = displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    name: displayName,
    initials: initials || "BG",
    title: lead.membershipName ?? "Imported Lead",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    status: statusInfo?.label,
    statusTone: statusInfo?.tone,
    source: statusInfo?.sourceLabel,
    tags: [lead.channel ?? "Imported"],
    identities: [
      lead.email ? { label: "Email", value: lead.email } : null,
      lead.phone ? { label: "Phone", value: lead.phone } : null,
    ].filter(Boolean) as { label: string; value: string }[],
    stats: {
      lifetimeSpend:
        formatMinorToCurrency(lead.valueMinor) ??
        (lead.membershipName ?? "Not set"),
      memberships: lead.membershipName ?? "Unassigned",
      lastPayment: "—",
      lastAttendance: "—",
    },
    payments: [],
    history: [],
    manualMatches: [],
    notes: [],
  };
};

type NormalizedLead = {
  row: LeadRow;
  profile: LeadProfile;
};

function normalizeApiLead(lead: ApiLead): NormalizedLead {
  const leadId = lead.externalId ?? lead.id;
  const metadata = (lead.metadata ?? {}) as Record<string, unknown>;
  const metadataProfile =
    typeof metadata === "object" && metadata !== null && "profile" in metadata
      ? (metadata as { profile?: unknown }).profile
      : null;
  const metadataContact =
    typeof metadata === "object" && metadata !== null && "raw" in metadata
      ? ((metadata as { raw?: unknown }).raw as Record<string, unknown> | undefined)
      : undefined;

  const displayName = computeDisplayName(
    lead,
    metadataContact as
    | { first_name?: string; firstName?: string; last_name?: string; lastName?: string }
    | undefined
  );
  const storedProfile = isLeadProfile(metadataProfile) ? metadataProfile : null;
  const statusInfo = getStatusInfo(lead.isClient ? "CLIENT" : lead.status, lead.source, lead.hasPurchases);
  const profileBase = storedProfile ?? buildProfileFromLead(lead, displayName);
  const shouldClearStoredLeadTag =
    profileBase.status === "Lead (from Ads)" && !statusInfo;
  const profile = {
    ...profileBase,
    status: shouldClearStoredLeadTag ? undefined : profileBase.status ?? statusInfo?.label ?? undefined,
    statusTone: shouldClearStoredLeadTag ? undefined : profileBase.statusTone ?? statusInfo?.tone ?? undefined,
    source: profileBase.source ?? statusInfo?.sourceLabel,
    history: Array.isArray(profileBase.history) ? profileBase.history : [],
  };

  const row: LeadRow = {
    id: leadId,
    name: displayName,
    statusLabel: profile.status ?? undefined,
    statusTone: profile.statusTone,
    source: profile.source,
    channel: lead.channel ?? "Imported",
    stage: lead.stage ?? "New",
    owner: lead.owner ?? "Unassigned",
    next: lead.nextStep ?? "Review import",
    value:
      formatMinorToCurrency(lead.valueMinor) ??
      lead.membershipName ??
      profile.stats.lifetimeSpend ??
      "€0",
  };

  return { row, profile };
}

// Duplicate type removed
function PeopleContent() {
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const initialView = (searchParams.get("view") as "all" | "leads" | "members" | "expiring") ?? "all";

  const [leadFilter, setLeadFilter] = useState<LeadStage>("All");
  const [viewMode, setViewMode] = useState<"all" | "leads" | "members" | "expiring">(initialView);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("All Sources");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>(csvColumns);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(defaultMapping);
  const [customMappings, setCustomMappings] = useState<{ key: string; column: string }[]>([
    { key: "Membership Id", column: "custom_ref" },
  ]);
  const [customFieldName, setCustomFieldName] = useState("");
  const [drafts, setDrafts] = useState<
    { id: string; name: string; email: string; membership: string; note: string }[]
  >([]);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    membership: "",
    note: "",
  });
  const [importedLeads, setImportedLeads] = useState<LeadRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, LeadProfile>>({});
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [showImportWorkspace, setShowImportWorkspace] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [tagLoading, setTagLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadImportedLeads = useCallback(async () => {
    setLoadingLeads(true);
    setLeadError(null);
    try {
      const response = await fetch(`/api/leads?view=${viewMode}&source=${encodeURIComponent(sourceFilter)}`);
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Unable to load leads.");
      }
      const leads: ApiLead[] = Array.isArray(payload.data) ? payload.data : [];
      const rows: LeadRow[] = [];
      const profileMap: Record<string, LeadProfile> = {};
      leads.forEach((lead) => {
        const normalized = normalizeApiLead(lead);
        rows.push(normalized.row);
        profileMap[normalized.row.id] = normalized.profile;
      });
      setImportedLeads(rows);
      setProfiles(profileMap);
      setSelectedLeadId((previous) => {
        if (previous && rows.some((lead) => lead.id === previous)) {
          return previous;
        }
        return rows[0]?.id ?? null;
      });
    } catch (error) {
      setLeadError(
        error instanceof Error
          ? error.message
          : "Unable to load leads from the server."
      );
    } finally {
      setLoadingLeads(false);
    }
  }, [viewMode, sourceFilter]);

  useEffect(() => {
    loadImportedLeads();
  }, [loadImportedLeads]);

  // const searchParams = useSearchParams(); Moved to top level
  const initialId = searchParams.get("id");

  useEffect(() => {
    if (initialId && importedLeads.length > 0) {
      const found = importedLeads.find(l => l.id === initialId || l.id === `lead_${initialId}` || l.id === initialId);
      // ID might be exact match.
      if (found) {
        setSelectedLeadId(found.id);
        setModalOpen(true);
      } else {
        // Fallback: Check if it's a contact ID needing mapping? 
        // The API might return leads with Contact ID as generic ID if normalized?
        // normalizeApiLead uses `lead.externalId ?? lead.id`. 
        // Let's assume ID matches.
        const match = importedLeads.find(l => l.id === initialId);
        if (match) {
          setSelectedLeadId(match.id);
          setModalOpen(true);
        }
      }
    }
  }, [initialId, importedLeads]);

  const allLeads = useMemo(() => importedLeads, [importedLeads]);

  const pageSizes = [10, 25, 50] as const;
  const [pageSize, setPageSize] = useState<(typeof pageSizes)[number]>(10);
  const [page, setPage] = useState(1);

  const filteredLeads = useMemo(() => {
    return allLeads.filter((lead) => {
      const matchesStage = leadFilter === "All" || lead.stage === leadFilter;
      const matchesSearch = search
        ? lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.channel.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesStage && matchesSearch;
    });
  }, [allLeads, leadFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const pagedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, page, pageSize]);

  const selectedLeadProfile = selectedLeadId ? profiles[selectedLeadId] : null;
  const [modalOpen, setModalOpen] = useState(false);

  const matchingIdentities = useMemo(() => {
    if (!selectedLeadProfile) {
      return [];
    }
    if (!search.trim()) {
      return selectedLeadProfile.identities.slice(0, 3);
    }
    return selectedLeadProfile.identities.filter((identity) =>
      identity.value.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, selectedLeadProfile]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.name || !formState.email) return;
    setDrafts((prev) => [
      ...prev,
      { id: `DRAFT-${prev.length + 1}`, ...formState },
    ]);
    setFormState({ name: "", email: "", membership: "", note: "" });
  };

  const handleMappingChange = (field: string, column: string) => {
    setFieldMapping((prev) => ({ ...prev, [field]: column }));
  };

  const handleCustomMappingChange = (index: number, column: string) => {
    setCustomMappings((prev) =>
      prev.map((mapping, idx) =>
        idx === index ? { ...mapping, column } : mapping
      )
    );
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !newTag.trim()) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/people/${selectedLeadId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: newTag }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message);

      // Optimistic update
      setProfiles((prev) => {
        const profile = prev[selectedLeadId];
        if (!profile) return prev;
        return {
          ...prev,
          [selectedLeadId]: {
            ...profile,
            tags: [...profile.tags, newTag],
          },
        };
      });
      setNewTag("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add tag");
    } finally {
      setTagLoading(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedLeadId) return;
    if (!confirm(`Remove tag "${tag}"?`)) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/people/${selectedLeadId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message);

      // Optimistic update
      setProfiles((prev) => {
        const profile = prev[selectedLeadId];
        if (!profile) return prev;
        return {
          ...prev,
          [selectedLeadId]: {
            ...profile,
            tags: profile.tags.filter((t) => t !== tag),
          },
        };
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove tag");
    } finally {
      setTagLoading(false);
    }
  };

  const addCustomField = () => {
    if (!customFieldName.trim()) return;
    setCustomMappings((prev) => [
      ...prev,
      {
        key: customFieldName.trim(),
        column: csvHeaders[0] ?? csvColumns[0],
      },
    ]);
    setCustomFieldName("");
  };

  const handleCsvUpload = async (file: File | null) => {
    setCsvFile(file);
    if (!file) {
      setCsvHeaders(csvColumns);
      setCsvPreview([]);
      setParsedRows([]);
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) {
        setCsvHeaders(csvColumns);
        setCsvPreview([]);
        setParsedRows([]);
        return;
      }
      const headers = rows[0].map((header) => header.trim());
      setCsvHeaders(headers);
      setParsedRows(rows.slice(1));
      setCsvPreview(rows.slice(1, 6));

      setFieldMapping((prev) => {
        const next = { ...prev };
        Object.entries(prev).forEach(([field, currentValue]) => {
          if (headers.includes(currentValue)) return;
          const guess = headers.find((header) =>
            header.toLowerCase().includes(field.replace(/_/g, " ").toLowerCase())
          );
          if (guess) next[field] = guess;
        });
        return next;
      });

      setCustomMappings((prev) =>
        prev.map((mapping) => {
          if (headers.includes(mapping.column)) return mapping;
          const guess =
            headers.find((header) =>
              header.toLowerCase().includes(mapping.key.toLowerCase())
            ) ?? mapping.column;
          return { ...mapping, column: guess };
        })
      );
      setImportMessage(null);
    } catch {
      setCsvHeaders(csvColumns);
      setCsvPreview([]);
      setParsedRows([]);
      setImportMessage("Failed to read CSV. Please try again.");
    }
  };

  const handleImportCsv = async () => {
    if (!parsedRows.length) {
      setImportMessage("Upload a CSV and verify mappings before importing.");
      return;
    }
    const headers = csvHeaders;
    const headerIndex = (column: string | undefined) =>
      column && column !== DONT_IMPORT
        ? headers.findIndex((header) => header === column)
        : -1;
    const getValue = (row: string[], key: keyof typeof fieldMapping) => {
      const column = fieldMapping[key];
      const index = headerIndex(column);
      if (index === -1) return "";
      return row[index] ?? "";
    };

    const payloads = parsedRows.map((row, index) => {
      const firstName = getValue(row, "first_name");
      const lastName = getValue(row, "last_name");
      const combinedName = getValue(row, "name");
      const displayName =
        [firstName, lastName].filter(Boolean).join(" ") ||
        combinedName ||
        `Lead ${index + 1}`;
      const membershipName =
        getValue(row, "membership_name") ||
        formState.membership ||
        "Unassigned";
      const valueRaw = getValue(row, "value");
      const lastBooking = getValue(row, "last_booking");
      const totalAttendances = getValue(row, "total_attendances");
      const leadId = `CSV-${Date.now()}-${index}`;
      const email = getValue(row, "email");
      const phone = getValue(row, "phone");
      const channel = getValue(row, "channel") || "CSV Upload";

      const template = createProfileTemplate(displayName);
      const initials =
        `${((firstName || displayName).charAt(0)) ?? ""}${((lastName || displayName.split(" ").slice(-1)[0] || "").charAt(0)) ?? ""
          }`.toUpperCase() || template.initials;

      const profile: LeadProfile = {
        ...template,
        name: displayName,
        initials,
        title: membershipName || channel || template.title,
        email: email ?? template.email,
        phone: phone ?? template.phone,
        tags: [membershipName, channel].filter(Boolean) as string[],
        identities: [
          email ? { label: "Email", value: email } : null,
          phone ? { label: "Phone", value: phone } : null,
          membershipName ? { label: "Membership", value: membershipName } : null,
        ].filter(Boolean) as { label: string; value: string }[],
        stats: {
          lifetimeSpend: valueRaw || template.stats.lifetimeSpend,
          memberships: membershipName || template.stats.memberships,
          lastPayment: lastBooking || template.stats.lastPayment,
          lastAttendance:
            totalAttendances && Number(totalAttendances) > 0
              ? `${totalAttendances} attendances`
              : template.stats.lastAttendance,
        },
        payments: [
          {
            date: lastBooking || "—",
            source: channel,
            amount: valueRaw || "€0",
            product: membershipName,
            status: "Imported",
          },
        ],
        manualMatches: [],
        notes: [
          {
            author: "CSV Importer",
            content: `Imported from ${csvFile?.name ?? "CSV"} row ${index + 1}`,
            timestamp: new Date().toLocaleString(),
          },
        ],
      };

      return {
        externalId: leadId,
        firstName,
        lastName,
        email,
        phone,
        channel,
        stage: "New",
        owner: "Unassigned",
        nextStep: "Review import",
        valueMinor: parseCurrencyToMinor(valueRaw),
        membershipName,
        metadata: { profile },
      };
    });

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: payloads }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Failed to import leads.");
      }
      setImportMessage(result.message ?? `Imported ${payloads.length} leads.`);
      await loadImportedLeads();
      if (payloads.length) {
        setSelectedLeadId(payloads[0].externalId ?? null);
      }
    } catch (error) {
      setImportMessage(
        error instanceof Error
          ? error.message
          : "Failed to import leads. Please try again."
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedLeadId) return;
    if (!confirm("Are you sure you want to delete this contact? This will remove all their data permanently.")) return;

    try {
      const response = await fetch(`/api/people/${selectedLeadId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Optimistic update
      setImportedLeads(prev => prev.filter(l => l.id !== selectedLeadId));
      setModalOpen(false);
      setSelectedLeadId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="flex flex-col gap-8 text-primary">
      <section className="glass-panel space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Leads / CRM
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Identity Graph</h2>
            <p className="text-sm text-muted">
              Lead sheet first. Search anything, filter stages, and open full profiles.
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex items-center rounded-xl bg-white/5 p-1 gap-1 border border-white/10">
              {(['all', 'members', 'leads'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === mode
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted hover:text-white hover:bg-white/5"
                    }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-xl bg-white/5 p-1 gap-1 border border-white/10">
              {sourceFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSourceFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${sourceFilter === filter
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-muted hover:text-white hover:bg-white/5"
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <button
              className="btn-primary text-sm"
              type="button"
              onClick={() => {
                setShowImportWorkspace((prev) => !prev);
                setImportMessage(null);
                setFormState({ name: "", email: "", membership: "", note: "" });
              }}
            >
              {showImportWorkspace ? "Import Workspace Open" : "Open Import Workspace"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/20 bg-white/80 px-5 py-3">
          <input
            type="text"
            placeholder="Search people or leads..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-lg font-medium text-primary placeholder:text-muted focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {searchHints.map((hint) => (
            <span key={hint} className="chip !border-white/15 !bg-white/5">
              {hint}
            </span>
          ))}
          <button
            className="chip text-xs"
            type="button"
            onClick={() => setShowImportWorkspace((prev) => !prev)}
          >
            {showImportWorkspace ? "Hide import workspace" : "Open import workspace"}
          </button>
        </div>
        {
          loadingLeads && (
            <p className="text-xs text-muted">Refreshing server leads…</p>
          )
        }
        {
          leadError && (
            <p className="text-xs text-amber-600">{leadError}</p>
          )
        }
      </section >

      {showImportWorkspace && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-900/15 bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Upload CSV</p>
            <h3 className="mt-2 text-xl font-semibold">Ingest leads from Glofox or Stripe</h3>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-emerald-900/30 bg-emerald-50/50 px-4 py-6 text-sm text-muted">
              <input
                type="file"
                accept=".csv"
                onChange={(event) => handleCsvUpload(event.target.files?.[0] ?? null)}
                className="hidden"
              />
              {csvFile ? (
                <>
                  <span className="text-base font-semibold text-primary">{csvFile.name}</span>
                  <span>Ready to map columns</span>
                </>
              ) : (
                <>
                  <span className="text-base font-semibold text-primary">Drop CSV or click to upload</span>
                  <span>Sample columns: first_name, email, phone, status...</span>
                </>
              )}
            </label>
            <form className="mt-4 grid gap-3 text-sm" onSubmit={handleCreate}>
              <p className="text-muted text-xs md:col-span-2">
                Quick add is optional. CSV imports will use the mapped &lsquo;Membership Name&rsquo; column automatically.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-2xl border border-emerald-900/15 bg-white px-4 py-3"
                  placeholder="Quick lead name"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
                <input
                  className="rounded-2xl border border-emerald-900/15 bg-white px-4 py-3"
                  placeholder="Email"
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
                <select
                  className="rounded-2xl border border-emerald-900/15 bg-white px-4 py-3"
                  value={formState.membership}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, membership: event.target.value }))
                  }
                >
                  <option value="">Auto detect from CSV (optional)</option>
                  {membershipOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-2xl border border-emerald-900/15 bg-white px-4 py-3"
                  placeholder="Internal note"
                  value={formState.note}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, note: event.target.value }))
                  }
                />
              </div>
              <button type="submit" className="btn-primary text-sm">
                Save quick lead
              </button>
            </form>
            {drafts.length > 0 && (
              <div className="mt-4 rounded-2xl border border-dashed border-emerald-900/25 bg-white/80 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-muted">
                  Drafts awaiting import
                </p>
                <ul className="mt-2 space-y-1">
                  {drafts.map((draft) => (
                    <li key={draft.id} className="flex justify-between text-primary">
                      <span>{draft.name}</span>
                      <span className="text-muted">{draft.membership}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-emerald-900/15 bg-white/80 p-5 text-sm">
            <p className="text-xs uppercase tracking-[0.35em] text-muted">Field Mapping</p>
            <h3 className="mt-2 text-xl font-semibold">Map CSV columns to Barn Gym schema</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(fieldMapping).map(([field, column]) => (
                <div key={field} className="flex flex-col gap-1 md:flex-row md:items-center">
                  <label className="md:w-32 capitalize text-muted">{field}</label>
                  <select
                    className="flex-1 rounded-2xl border border-emerald-900/20 bg-white px-4 py-2"
                    value={column}
                    onChange={(event) => handleMappingChange(field, event.target.value)}
                  >
                    <option value={DONT_IMPORT}>Don&apos;t import</option>
                    {csvHeaders.map((col) => (
                      <option key={`${field}-${col}`} value={col}>
                        {col || "—"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-muted">
                Custom Variables
              </p>
              {customMappings.map((mapping, index) => (
                <div key={`${mapping.key}-${index}`} className="flex flex-col gap-1 md:flex-row md:items-center">
                  <input
                    className="rounded-2xl border border-emerald-900/20 bg-white px-4 py-2 text-sm md:w-40"
                    value={mapping.key}
                    readOnly
                  />
                  <select
                    className="flex-1 rounded-2xl border border-emerald-900/20 bg-white px-4 py-2"
                    value={mapping.column}
                    onChange={(event) => handleCustomMappingChange(index, event.target.value)}
                  >
                    {csvHeaders.map((col) => (
                      <option key={`${mapping.key}-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input
                  className="rounded-2xl border border-dashed border-emerald-900/30 bg-white px-4 py-2 text-sm"
                  placeholder="Add custom variable"
                  value={customFieldName}
                  onChange={(event) => setCustomFieldName(event.target.value)}
                />
                <button type="button" className="chip text-xs" onClick={addCustomField}>
                  + Add mapping
                </button>
              </div>
            </div>

            {csvPreview.length > 0 && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-[0.35em] text-muted">
                  Preview (first {Math.min(csvPreview.length, 5)} rows)
                </p>
                <div className="mt-2 overflow-auto rounded-2xl border border-emerald-900/15 bg-white/70 text-xs">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr>
                        {csvHeaders.slice(0, 8).map((header) => (
                          <th key={header} className="border-b border-emerald-900/10 px-3 py-2 text-left font-medium text-muted">
                            {header || "—"}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(0, 5).map((row, index) => (
                        <tr key={`preview-${index}`} className="border-b border-emerald-900/5">
                          {csvHeaders.slice(0, 8).map((_, colIndex) => (
                            <td key={`preview-${index}-${colIndex}`} className="px-3 py-2 text-primary">
                              {row[colIndex] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={handleImportCsv}
              >
                Import mapped rows
              </button>
              {importMessage && (
                <p className="text-sm text-emerald-700">{importMessage}</p>
              )}
            </div>
          </div>
        </section>
      )
      }

      <section className="glass-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted">
              Lead Sheet
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Spreadsheet Overview</h3>
            <p className="text-sm text-muted">
              {filteredLeads.length} leads · click any row to open profile.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {leadStages.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => setLeadFilter(stage)}
                className={`chip text-xs ${stage === leadFilter ? "!bg-emerald-600 !text-white !border-emerald-600" : ""
                  }`}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                {["Lead", "Channel", "Stage", "Owner", "Next Step", "Value"].map((column) => (
                  <th key={column} className="pb-3 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/10">
              {pagedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`cursor-pointer rounded-2xl ${lead.id === selectedLeadId ? "bg-emerald-50/80" : ""
                    }`}
                  onClick={() => {
                    setSelectedLeadId(lead.id);
                    setModalOpen(true);
                  }}
                >
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-primary">{lead.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.statusLabel && (
                        <span
                          className={`chip text-[10px] ${lead.statusTone === "client"
                            ? "!bg-emerald-100 !text-emerald-800 !border-emerald-200"
                            : "!bg-amber-100 !text-amber-800 !border-amber-200"
                            }`}
                        >
                          {lead.statusLabel}
                        </span>
                      )}
                      {lead.source && (
                        <span className="chip text-[10px] !bg-white/70 !text-primary !border-white/30">
                          Source: {lead.source}
                        </span>
                      )}
                      <span className="text-[11px] text-muted">{lead.id}</span>
                    </div>
                  </td>
                  <td className="pr-4 text-muted">{lead.channel}</td>
                  <td className="pr-4">
                    <span className="chip text-xs">{lead.stage}</span>
                  </td>
                  <td className="pr-4 text-muted">{lead.owner}</td>
                  <td className="pr-4 text-muted">{lead.next}</td>
                  <td className="pr-4 font-semibold text-primary">{lead.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted">Rows per page</span>
            <select
              className="rounded-2xl border border-emerald-900/20 bg-white/60 px-3 py-2 text-sm"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value) as (typeof pageSizes)[number]);
                setPage(1);
              }}
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="chip text-xs"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span className="text-muted">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              className="chip text-xs"
              disabled={page === totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {
        modalOpen && selectedLeadProfile && mounted && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
            <div className="glass-panel max-h-[90vh] w-full max-w-4xl overflow-y-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Lead Profile
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">{selectedLeadProfile.name}</h3>
                  <p className="text-sm text-muted">{selectedLeadProfile.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedLeadProfile.status && (
                      <span
                        className={`chip text-xs ${selectedLeadProfile.statusTone === "client"
                          ? "!bg-emerald-100 !text-emerald-800 !border-emerald-200"
                          : "!bg-amber-100 !text-amber-800 !border-amber-200"
                          }`}
                      >
                        {selectedLeadProfile.status}
                      </span>
                    )}
                    {selectedLeadProfile.source && (
                      <span className="chip text-xs !bg-white/80 !text-primary !border-white/40">
                        Source: {selectedLeadProfile.source}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="chip text-xs !bg-red-500/10 !text-red-500 hover:!bg-red-500/20"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="chip text-xs"
                    onClick={() => setModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-sm text-muted">
                <p>Phone · {selectedLeadProfile.phone}</p>
                <p>Email · {selectedLeadProfile.email}</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {selectedLeadProfile.tags.map((tag) => (
                    <span key={tag} className="chip text-xs group flex items-center gap-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 opacity-50 hover:opacity-100 hover:text-rose-500"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <form onSubmit={handleAddTag} className="flex items-center">
                    <input
                      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-emerald-500/50 w-24"
                      placeholder="+ Tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      disabled={tagLoading}
                    />
                  </form>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Lifetime Value
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedLeadProfile.stats.lifetimeSpend}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Membership
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedLeadProfile.stats.memberships}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Recent Payment
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedLeadProfile.stats.lastPayment}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Attendance
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {selectedLeadProfile.stats.lastAttendance}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">
                    Contact Info
                  </p>
                  <ul className="mt-3 space-y-2 text-primary">
                    {matchingIdentities.map((identity) => (
                      <li key={identity.value} className="flex justify-between gap-4">
                        <span className="text-muted">{identity.label}</span>
                        <span className="font-medium text-primary">{identity.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">Recent Payments</p>
                  <div className="mt-3 space-y-3">
                    {selectedLeadProfile.payments.map((entry) => (
                      <div
                        key={`${entry.date}-${entry.product}`}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <p className="text-sm font-semibold text-primary">{entry.product}</p>
                        <p className="text-xs text-muted">
                          {entry.date} · {entry.source}
                        </p>
                        <p className="text-sm text-primary">{entry.amount}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.35em] text-muted">Transaction History</p>
                  <span className="text-xs text-muted">
                    Showing up to {selectedLeadProfile.history.length} records
                  </span>
                </div>
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-2">
                  {selectedLeadProfile.history.length === 0 ? (
                    <p className="text-sm text-muted">No transactions yet.</p>
                  ) : (
                    selectedLeadProfile.history.map((entry, idx) => (
                      <div
                        key={`${entry.timestamp}-${idx}`}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between text-sm text-primary">
                          <span className="font-semibold">{entry.amount}</span>
                          <span className="text-muted">{entry.source}</span>
                        </div>
                        <div className="text-xs text-muted">
                          {entry.timestamp} · {entry.product}
                          {entry.reference ? ` · Ref: ${entry.reference}` : ""}
                          {entry.status ? ` · ${entry.status}` : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.35em] text-muted">Notes</p>
                <div className="mt-3 space-y-3 text-sm">
                  {selectedLeadProfile.notes.map((note) => (
                    <div key={note.timestamp} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-muted">{note.timestamp}</p>
                      <p className="text-primary">{note.content}</p>
                      <p className="text-xs text-muted">— {note.author}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }

    </div >
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading...</div>}>
      <PeopleContent />
    </Suspense>
  );
}
