"use client";

import {
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Inbox,
  Mail,
  Mic,
  Paperclip,
  Save,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AttachmentReference,
  CommunicationDraft,
} from "@/lib/advisor-data";
import {
  generateClientCommunicationDraft,
  saveCommunicationDraft,
} from "@/app/cockpit-actions";
import { MeetingSessionDialog } from "@/components/clients/MeetingSessionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CommunicationsExplorerProps {
  advisorId: number;
  clientId: number;
  clientName: string;
  drafts: CommunicationDraft[];
  autoOpenMeeting?: boolean;
}

type FolderId =
  | "meetings"
  | "emails"
  | "meeting_requests"
  | "audio"
  | "documents"
  | "archived";

interface FolderConfig {
  id: FolderId;
  label: string;
  icon: typeof FolderOpen;
}

const FOLDERS: FolderConfig[] = [
  { id: "meetings", label: "Meetings", icon: CalendarClock },
  { id: "emails", label: "Email Drafts", icon: Mail },
  { id: "meeting_requests", label: "Meeting Requests", icon: Inbox },
  { id: "audio", label: "Audio Recordings", icon: Mic },
  { id: "documents", label: "Documents", icon: Paperclip },
  { id: "archived", label: "Archived", icon: Archive },
];

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function blankAttachment(): AttachmentReference {
  return { id: crypto.randomUUID(), name: "", note: "" };
}

function categorizeDraft(draft: CommunicationDraft): FolderId {
  if (draft.status === "archived") return "archived";
  if (draft.draft_type === "meeting_summary") return "meetings";
  if (draft.draft_type === "meeting_request") return "meeting_requests";
  return "emails";
}

export function CommunicationsExplorer({
  advisorId,
  clientId,
  clientName,
  drafts,
  autoOpenMeeting = false,
}: CommunicationsExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftsState, setDraftsState] = useState(drafts);
  const [activeFolder, setActiveFolder] = useState<FolderId>("meetings");
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderId>>(
    new Set(["meetings"]),
  );
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(autoOpenMeeting);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<CommunicationDraft["status"]>("draft");
  const [attachments, setAttachments] = useState<AttachmentReference[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groupedDrafts = useMemo(() => {
    const groups = new Map<FolderId, CommunicationDraft[]>();
    for (const folder of FOLDERS) groups.set(folder.id, []);
    for (const draft of draftsState) {
      const folder = categorizeDraft(draft);
      groups.get(folder)?.push(draft);
    }
    for (const [, list] of groups) {
      list.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    }
    return groups;
  }, [draftsState]);

  const visibleDrafts = groupedDrafts.get(activeFolder) ?? [];
  const selectedDraft =
    draftsState.find((d) => d.draft_id === selectedDraftId) ?? null;

  useEffect(() => {
    if (!selectedDraft) {
      setEditing(false);
      return;
    }
    setSubject(selectedDraft.subject);
    setBody(selectedDraft.body);
    setStatus(selectedDraft.status);
    setAttachments(selectedDraft.attachment_metadata);
    setEditing(false);
  }, [selectedDraft]);

  useEffect(() => {
    if (autoOpenMeeting) {
      setMeetingOpen(true);
      const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
      nextParams.delete("startMeeting");
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [autoOpenMeeting, pathname, router, searchParams]);

  const syncDraftToTop = (updatedDraft: CommunicationDraft) => {
    setDraftsState((current) => {
      const remaining = current.filter(
        (d) => d.draft_id !== updatedDraft.draft_id,
      );
      return [updatedDraft, ...remaining];
    });
    setActiveFolder(categorizeDraft(updatedDraft));
    setExpandedFolders((current) => {
      const next = new Set(current);
      next.add(categorizeDraft(updatedDraft));
      return next;
    });
    setSelectedDraftId(updatedDraft.draft_id);
  };

  const handleGenerate = (draftType: "email" | "meeting_request") => {
    setMessage(null);
    startTransition(async () => {
      try {
        const draft = await generateClientCommunicationDraft({
          advisorId,
          clientId,
          draftType,
        });
        syncDraftToTop(draft);
        setMessage(
          draftType === "meeting_request"
            ? "Meeting request draft generated."
            : "Client email draft generated.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to generate draft.",
        );
      }
    });
  };

  const handleMeetingDraftSaved = (draft: CommunicationDraft) => {
    syncDraftToTop(draft);
    setMessage("Meeting note saved.");
  };

  const handleSave = () => {
    if (!selectedDraft) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const draft = await saveCommunicationDraft({
          draftId: selectedDraft.draft_id,
          advisorId,
          clientId,
          status,
          subject,
          body,
          attachments,
        });
        syncDraftToTop(draft);
        setEditing(false);
        setMessage("Draft saved.");
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to save draft.",
        );
      }
    });
  };

  const toggleFolder = (folderId: FolderId) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
    setActiveFolder(folderId);
    setSelectedDraftId(null);
  };

  const updateAttachment = (
    attachmentId: string,
    key: keyof AttachmentReference,
    value: string,
  ) => {
    setAttachments((current) =>
      current.map((a) =>
        a.id === attachmentId ? { ...a, [key]: value } : a,
      ),
    );
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((a) => a.id !== attachmentId));
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Communications archive
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-foreground">
            {clientName}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMeetingOpen(true);
              setMessage(null);
            }}
            disabled={isPending}
            className="gap-2"
          >
            <Mic className="h-4 w-4" />
            Start meeting
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerate("email")}
            disabled={isPending}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Generate email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerate("meeting_request")}
            disabled={isPending}
            className="gap-2"
          >
            <CalendarClock className="h-4 w-4" />
            Generate meeting request
          </Button>
        </div>
      </div>

      {message && (
        <div className="border-b border-border bg-muted/30 px-5 py-2 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      <MeetingSessionDialog
        advisorId={advisorId}
        clientId={clientId}
        clientName={clientName}
        open={meetingOpen}
        onOpenChange={setMeetingOpen}
        onDraftSaved={handleMeetingDraftSaved}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-border min-h-[520px]">
        <FolderTree
          folders={FOLDERS}
          counts={Object.fromEntries(
            FOLDERS.map((f) => [f.id, groupedDrafts.get(f.id)?.length ?? 0]),
          )}
          activeFolder={activeFolder}
          expandedFolders={expandedFolders}
          meetings={groupedDrafts.get("meetings") ?? []}
          selectedDraftId={selectedDraftId}
          onToggleFolder={toggleFolder}
          onSelectMeeting={(draftId) => {
            setActiveFolder("meetings");
            setSelectedDraftId(draftId);
          }}
        />

        <div className="min-w-0">
          {selectedDraft ? (
            <DraftViewer
              draft={selectedDraft}
              editing={editing}
              subject={subject}
              body={body}
              status={status}
              attachments={attachments}
              isPending={isPending}
              onEdit={() => setEditing(true)}
              onCancel={() => {
                setSubject(selectedDraft.subject);
                setBody(selectedDraft.body);
                setStatus(selectedDraft.status);
                setAttachments(selectedDraft.attachment_metadata);
                setEditing(false);
              }}
              onSubjectChange={setSubject}
              onBodyChange={setBody}
              onStatusChange={setStatus}
              onAddAttachment={() =>
                setAttachments((current) => [...current, blankAttachment()])
              }
              onUpdateAttachment={updateAttachment}
              onRemoveAttachment={removeAttachment}
              onSave={handleSave}
            />
          ) : (
            <FolderListing
              folder={FOLDERS.find((f) => f.id === activeFolder)!}
              drafts={visibleDrafts}
              onSelect={setSelectedDraftId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FolderTree({
  folders,
  counts,
  activeFolder,
  expandedFolders,
  meetings,
  selectedDraftId,
  onToggleFolder,
  onSelectMeeting,
}: {
  folders: FolderConfig[];
  counts: Record<string, number>;
  activeFolder: FolderId;
  expandedFolders: Set<FolderId>;
  meetings: CommunicationDraft[];
  selectedDraftId: number | null;
  onToggleFolder: (id: FolderId) => void;
  onSelectMeeting: (draftId: number) => void;
}) {
  return (
    <div className="bg-muted/10 p-3 space-y-0.5">
      {folders.map((folder) => {
        const Icon = folder.icon;
        const isExpanded = expandedFolders.has(folder.id);
        const isActive = activeFolder === folder.id && selectedDraftId === null;
        const count = counts[folder.id] ?? 0;
        const hasChildren = folder.id === "meetings" && meetings.length > 0;

        return (
          <div key={folder.id}>
            <button
              onClick={() => onToggleFolder(folder.id)}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3.5" />
              )}
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 text-left truncate">{folder.label}</span>
              {count > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
            {hasChildren && isExpanded && (
              <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {meetings.map((meeting) => {
                  const isSelected = selectedDraftId === meeting.draft_id;
                  return (
                    <button
                      key={meeting.draft_id}
                      onClick={() => onSelectMeeting(meeting.draft_id)}
                      className={`group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                      title={meeting.subject}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {meeting.subject || "Untitled meeting"}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {formatDate(meeting.updated_at)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FolderListing({
  folder,
  drafts,
  onSelect,
}: {
  folder: FolderConfig;
  drafts: CommunicationDraft[];
  onSelect: (id: number) => void;
}) {
  const Icon = folder.icon;

  if (folder.id === "audio") {
    return (
      <EmptyFolder
        icon={Icon}
        title="Audio Recordings"
        description="Captured meeting audio will appear here once recording capture is wired up."
        actionLabel="Record audio (coming soon)"
        actionDisabled
      />
    );
  }

  if (folder.id === "documents") {
    return (
      <EmptyFolder
        icon={Icon}
        title="Documents"
        description="Files shared with or received from this client will be stored here."
        actionLabel="Upload document (coming soon)"
        actionIcon={Upload}
        actionDisabled
      />
    );
  }

  if (drafts.length === 0) {
    return (
      <EmptyFolder
        icon={Icon}
        title={folder.label}
        description={`No items in ${folder.label.toLowerCase()} yet.`}
      />
    );
  }

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {folder.label}
        <span className="text-xs font-normal text-muted-foreground">
          · {drafts.length} {drafts.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {drafts.map((draft) => (
          <button
            key={draft.draft_id}
            onClick={() => onSelect(draft.draft_id)}
            className="flex w-full items-start gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {draft.subject || "Untitled"}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {draft.body.replace(/\s+/g, " ").trim() || "No content"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                {draft.status}
              </span>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {formatDate(draft.updated_at)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyFolder({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  actionDisabled,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: typeof FolderOpen;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      {actionLabel && (
        <Button variant="outline" size="sm" disabled={actionDisabled} className="gap-2 mt-2">
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function DraftViewer({
  draft,
  editing,
  subject,
  body,
  status,
  attachments,
  isPending,
  onEdit,
  onCancel,
  onSubjectChange,
  onBodyChange,
  onStatusChange,
  onAddAttachment,
  onUpdateAttachment,
  onRemoveAttachment,
  onSave,
}: {
  draft: CommunicationDraft;
  editing: boolean;
  subject: string;
  body: string;
  status: CommunicationDraft["status"];
  attachments: AttachmentReference[];
  isPending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onStatusChange: (value: CommunicationDraft["status"]) => void;
  onAddAttachment: () => void;
  onUpdateAttachment: (
    id: string,
    key: keyof AttachmentReference,
    value: string,
  ) => void;
  onRemoveAttachment: (id: string) => void;
  onSave: () => void;
}) {
  const isMeeting = draft.draft_type === "meeting_summary";

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {isMeeting
              ? "Meeting note"
              : draft.draft_type === "meeting_request"
                ? "Meeting request"
                : "Email draft"}
          </p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-foreground">
            {editing ? "Editing draft" : draft.subject || "Untitled"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Updated {formatTimestamp(draft.updated_at)} · status{" "}
            <span className="capitalize">{draft.status}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                Cancel
              </Button>
              <Button size="sm" onClick={onSave} disabled={isPending} className="gap-2">
                <Save className="h-4 w-4" />
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      </div>

      {isMeeting && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <MeetingArtifactCard
            icon={FileText}
            title="Transcript"
            description="Captured meeting transcript"
          />
          <MeetingArtifactCard
            icon={Mic}
            title="Audio recording"
            description="No audio captured yet"
            muted
          />
          <MeetingArtifactCard
            icon={Paperclip}
            title="Attachments"
            description={
              attachments.length > 0
                ? `${attachments.length} placeholder${attachments.length === 1 ? "" : "s"}`
                : "None"
            }
          />
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="draft-subject">
                Subject
              </label>
              <Input
                id="draft-subject"
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                placeholder="Draft subject"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="draft-status">
                Status
              </label>
              <select
                id="draft-status"
                value={status}
                onChange={(e) =>
                  onStatusChange(e.target.value as CommunicationDraft["status"])
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="draft-body">
              {isMeeting ? "Transcript & summary" : "Message"}
            </label>
            <Textarea
              id="draft-body"
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              placeholder="Draft body"
              className="min-h-[320px]"
            />
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-primary" />
                Attachment placeholders
              </div>
              <Button variant="ghost" size="sm" onClick={onAddAttachment}>
                Add attachment
              </Button>
            </div>
            <div className="space-y-3">
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attachment placeholders added yet.
                </p>
              ) : (
                attachments.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3"
                  >
                    <Input
                      value={a.name}
                      onChange={(e) => onUpdateAttachment(a.id, "name", e.target.value)}
                      placeholder="Attachment name"
                    />
                    <Input
                      value={a.note}
                      onChange={(e) => onUpdateAttachment(a.id, "note", e.target.value)}
                      placeholder="Why include it"
                    />
                    <Button variant="ghost" size="sm" onClick={() => onRemoveAttachment(a.id)}>
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/10 p-4">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
              {draft.body || "(empty)"}
            </pre>
          </div>
          {draft.attachment_metadata.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-primary" />
                Attachments
              </div>
              <ul className="space-y-2">
                {draft.attachment_metadata.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.name || "Untitled attachment"}
                      </p>
                      {a.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MeetingArtifactCard({
  icon: Icon,
  title,
  description,
  muted,
}: {
  icon: typeof FolderOpen;
  title: string;
  description: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-border p-3 ${
        muted ? "bg-muted/10" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}
