"use client";

import {
  Archive,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  Inbox,
  Mail,
  Mic,
  Paperclip,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AttachmentReference,
  ClientMeeting,
  CommunicationDraft,
} from "@/lib/advisor-data";
import {
  generateClientCommunicationDraft,
  saveCommunicationDraft,
} from "@/app/cockpit-actions";
import {
  ClientDocumentMeta,
  deleteDocument,
  downloadDocument,
  listDocuments,
  uploadDocument,
} from "@/lib/client-documents";
import { MeetingSessionDialog } from "@/components/clients/MeetingSessionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface CommunicationsExplorerProps {
  advisorId: number;
  clientId: number;
  clientName: string;
  drafts: CommunicationDraft[];
  meetings: ClientMeeting[];
  autoOpenMeeting?: boolean;
}

type FolderId =
  | "meetings"
  | "emails"
  | "meeting_requests"
  | "audio"
  | "documents"
  | "archived";

type ArtifactKey = "note" | "transcript" | "summary" | "action_items" | "audio";

type Selection =
  | { kind: "draft"; draftId: number }
  | { kind: "meeting"; meetingId: number; artifact: ArtifactKey };

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

const ARTIFACT_LABELS: Record<ArtifactKey, string> = {
  note: "Meeting note",
  transcript: "Transcript",
  summary: "Summary",
  action_items: "Action items",
  audio: "Audio recording",
};

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
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
  meetings,
  autoOpenMeeting = false,
}: CommunicationsExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftsState, setDraftsState] = useState(drafts);
  const [meetingsState, setMeetingsState] = useState(meetings);
  const [activeFolder, setActiveFolder] = useState<FolderId>("meetings");
  const [expandedFolders, setExpandedFolders] = useState<Set<FolderId>>(
    new Set(["meetings"]),
  );
  const [expandedMeetings, setExpandedMeetings] = useState<Set<number>>(
    new Set(),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(autoOpenMeeting);
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<CommunicationDraft["status"]>("draft");
  const [attachments, setAttachments] = useState<AttachmentReference[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Documents state
  const [documents, setDocuments] = useState<ClientDocumentMeta[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadDirection, setUploadDirection] = useState<"inbound" | "outbound">("outbound");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const selectedDraft = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "draft") {
      return draftsState.find((d) => d.draft_id === selection.draftId) ?? null;
    }
    if (selection.kind === "meeting" && selection.artifact === "note") {
      const meeting = meetingsState.find((m) => m.meeting_id === selection.meetingId);
      if (meeting?.draft_id) {
        return draftsState.find((d) => d.draft_id === meeting.draft_id) ?? null;
      }
    }
    return null;
  }, [selection, draftsState, meetingsState]);

  const selectedMeeting = useMemo(() => {
    if (selection?.kind !== "meeting") return null;
    return meetingsState.find((m) => m.meeting_id === selection.meetingId) ?? null;
  }, [selection, meetingsState]);

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

  // Load documents from IndexedDB when Documents folder is active
  useEffect(() => {
    if (activeFolder !== "documents") return;
    setDocsLoading(true);
    listDocuments(advisorId, clientId)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocsLoading(false));
  }, [activeFolder, advisorId, clientId]);

  const syncDraftToTop = (updatedDraft: CommunicationDraft) => {
    setDraftsState((current) => {
      const remaining = current.filter(
        (d) => d.draft_id !== updatedDraft.draft_id,
      );
      return [updatedDraft, ...remaining];
    });
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
        setActiveFolder(draftType === "meeting_request" ? "meeting_requests" : "emails");
        setExpandedFolders((cur) => {
          const next = new Set(cur);
          next.add(draftType === "meeting_request" ? "meeting_requests" : "emails");
          return next;
        });
        setSelection({ kind: "draft", draftId: draft.draft_id });
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

  const handleMeetingDraftSaved = ({
    draft,
    meeting,
  }: {
    draft: CommunicationDraft;
    meeting: ClientMeeting;
  }) => {
    syncDraftToTop(draft);
    setMeetingsState((cur) => [
      meeting,
      ...cur.filter((m) => m.meeting_id !== meeting.meeting_id),
    ]);
    setActiveFolder("meetings");
    setExpandedFolders((cur) => {
      const next = new Set(cur);
      next.add("meetings");
      return next;
    });
    setExpandedMeetings((cur) => {
      const next = new Set(cur);
      next.add(meeting.meeting_id);
      return next;
    });
    setSelection({ kind: "meeting", meetingId: meeting.meeting_id, artifact: "note" });
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
    setSelection(null);
  };

  const toggleMeeting = (meetingId: number) => {
    setExpandedMeetings((cur) => {
      const next = new Set(cur);
      if (next.has(meetingId)) next.delete(meetingId);
      else next.add(meetingId);
      return next;
    });
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

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);
    try {
      const meta = await uploadDocument(advisorId, clientId, file, uploadDirection);
      setDocuments((cur) => [meta, ...cur]);
      setMessage(`"${file.name}" uploaded.`);
    } catch {
      setMessage("Upload failed. Please try again.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (docId: string, name: string) => {
    try {
      const doc = await downloadDocument(docId);
      const blob = new Blob([doc.data], { type: doc.mime_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("Download failed.");
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await deleteDocument(docId);
      setDocuments((cur) => cur.filter((d) => d.doc_id !== docId));
    } catch {
      setMessage("Delete failed.");
    }
  };

  const visibleDrafts =
    activeFolder === "meetings"
      ? []
      : (groupedDrafts.get(activeFolder) ?? []);

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
            FOLDERS.map((f) => {
              if (f.id === "meetings") return [f.id, meetingsState.length];
              if (f.id === "audio") return [f.id, 0];
              if (f.id === "documents") return [f.id, documents.length];
              return [f.id, groupedDrafts.get(f.id)?.length ?? 0];
            }),
          )}
          activeFolder={activeFolder}
          expandedFolders={expandedFolders}
          expandedMeetings={expandedMeetings}
          meetings={meetingsState}
          selection={selection}
          onToggleFolder={toggleFolder}
          onToggleMeeting={toggleMeeting}
          onSelectMeetingArtifact={(meetingId, artifact) => {
            setActiveFolder("meetings");
            setSelection({ kind: "meeting", meetingId, artifact });
          }}
          onSelectDraft={(draftId) => {
            setSelection({ kind: "draft", draftId });
          }}
        />

        <div className="min-w-0">
          {selection?.kind === "meeting" && selectedMeeting ? (
            <MeetingArtifactViewer
              meeting={selectedMeeting}
              artifact={selection.artifact}
              draft={selectedDraft}
              editing={editing}
              subject={subject}
              body={body}
              status={status}
              attachments={attachments}
              isPending={isPending}
              onEdit={() => setEditing(true)}
              onCancel={() => {
                if (selectedDraft) {
                  setSubject(selectedDraft.subject);
                  setBody(selectedDraft.body);
                  setStatus(selectedDraft.status);
                  setAttachments(selectedDraft.attachment_metadata);
                }
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
          ) : selection?.kind === "draft" && selectedDraft ? (
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
          ) : activeFolder === "documents" ? (
            <DocumentsFolder
              documents={documents}
              loading={docsLoading}
              uploadDirection={uploadDirection}
              fileInputRef={fileInputRef}
              onDirectionChange={setUploadDirection}
              onUploadClick={() => fileInputRef.current?.click()}
              onUploadFile={handleUploadFile}
              onDownload={handleDownload}
              onDelete={handleDeleteDoc}
            />
          ) : (
            <FolderListing
              folder={FOLDERS.find((f) => f.id === activeFolder)!}
              drafts={visibleDrafts}
              onSelect={(draftId) => setSelection({ kind: "draft", draftId })}
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
  expandedMeetings,
  meetings,
  selection,
  onToggleFolder,
  onToggleMeeting,
  onSelectMeetingArtifact,
  onSelectDraft,
}: {
  folders: FolderConfig[];
  counts: Record<string, number>;
  activeFolder: FolderId;
  expandedFolders: Set<FolderId>;
  expandedMeetings: Set<number>;
  meetings: ClientMeeting[];
  selection: Selection | null;
  onToggleFolder: (id: FolderId) => void;
  onToggleMeeting: (meetingId: number) => void;
  onSelectMeetingArtifact: (meetingId: number, artifact: ArtifactKey) => void;
  onSelectDraft: (draftId: number) => void;
}) {
  return (
    <div className="bg-muted/10 p-3 space-y-0.5">
      {folders.map((folder) => {
        const Icon = folder.icon;
        const isExpanded = expandedFolders.has(folder.id);
        const isFolderActive =
          activeFolder === folder.id && selection === null;
        const count = counts[folder.id] ?? 0;
        const hasMeetingChildren = folder.id === "meetings" && meetings.length > 0;

        return (
          <div key={folder.id}>
            <button
              onClick={() => onToggleFolder(folder.id)}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                isFolderActive
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground hover:bg-muted/50"
              }`}
            >
              {hasMeetingChildren ? (
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

            {hasMeetingChildren && isExpanded && (
              <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {meetings.map((meeting) => {
                  const isMeetingExpanded = expandedMeetings.has(meeting.meeting_id);
                  const label =
                    meeting.summary
                      ? meeting.summary.slice(0, 40).replace(/\n/g, " ")
                      : `Meeting ${new Date(meeting.created_at).toLocaleDateString()}`;

                  return (
                    <div key={meeting.meeting_id}>
                      <button
                        onClick={() => onToggleMeeting(meeting.meeting_id)}
                        className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        title={label}
                      >
                        {isMeetingExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">
                            {label}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">
                            {formatDate(meeting.created_at)}
                          </span>
                        </span>
                      </button>

                      {isMeetingExpanded && (
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
                          {(["note", "transcript", "summary", "action_items", "audio"] as ArtifactKey[]).map(
                            (artifact) => {
                              const isSelected =
                                selection?.kind === "meeting" &&
                                selection.meetingId === meeting.meeting_id &&
                                selection.artifact === artifact;
                              const ArtifactIcon =
                                artifact === "audio"
                                  ? Mic
                                  : artifact === "action_items"
                                    ? ClipboardList
                                    : FileText;
                              const isDisabled =
                                (artifact === "audio") ||
                                (artifact === "note" && !meeting.draft_id);

                              return (
                                <button
                                  key={artifact}
                                  onClick={() =>
                                    !isDisabled &&
                                    onSelectMeetingArtifact(meeting.meeting_id, artifact)
                                  }
                                  disabled={isDisabled}
                                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] transition-colors ${
                                    isSelected
                                      ? "bg-primary/10 text-foreground"
                                      : isDisabled
                                        ? "text-muted-foreground/40 cursor-default"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                  }`}
                                >
                                  <ArtifactIcon className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {ARTIFACT_LABELS[artifact]}
                                    {artifact === "audio" && (
                                      <span className="ml-1 text-[9px] opacity-60">
                                        (none)
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}
                    </div>
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

  if (folder.id === "meetings") {
    return (
      <EmptyFolder
        icon={Icon}
        title="Meetings"
        description="Select a meeting from the sidebar to view its transcript, summary, and action items."
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

function DocumentsFolder({
  documents,
  loading,
  uploadDirection,
  fileInputRef,
  onDirectionChange,
  onUploadClick,
  onUploadFile,
  onDownload,
  onDelete,
}: {
  documents: ClientDocumentMeta[];
  loading: boolean;
  uploadDirection: "inbound" | "outbound";
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDirectionChange: (dir: "inbound" | "outbound") => void;
  onUploadClick: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: (docId: string, name: string) => void;
  onDelete: (docId: string) => void;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Paperclip className="h-4 w-4 text-primary" />
          Documents
          {documents.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              · {documents.length} {documents.length === 1 ? "file" : "files"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={uploadDirection}
            onChange={(e) => onDirectionChange(e.target.value as "inbound" | "outbound")}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            title="Document direction"
          >
            <option value="outbound">Outbound (to client)</option>
            <option value="inbound">Inbound (from client)</option>
          </select>
          <Button variant="outline" size="sm" onClick={onUploadClick} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onUploadFile}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">No documents yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upload files shared with or received from this client. Use the direction tag to mark whether a file is going to or from the client.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {documents.map((doc) => (
            <div
              key={doc.doc_id}
              className="flex items-center gap-3 bg-card px-4 py-3"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatBytes(doc.size)} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  doc.direction === "inbound"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                }`}
              >
                {doc.direction === "inbound" ? "From client" : "To client"}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownload(doc.doc_id, doc.name)}
                  className="h-7 w-7 p-0"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(doc.doc_id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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

function MeetingArtifactViewer({
  meeting,
  artifact,
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
  meeting: ClientMeeting;
  artifact: ArtifactKey;
  draft: CommunicationDraft | null;
  editing: boolean;
  subject: string;
  body: string;
  status: CommunicationDraft["status"];
  attachments: AttachmentReference[];
  isPending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onStatusChange: (v: CommunicationDraft["status"]) => void;
  onAddAttachment: () => void;
  onUpdateAttachment: (id: string, key: keyof AttachmentReference, value: string) => void;
  onRemoveAttachment: (id: string) => void;
  onSave: () => void;
}) {
  if (artifact === "note" && draft) {
    return (
      <DraftViewer
        draft={draft}
        editing={editing}
        subject={subject}
        body={body}
        status={status}
        attachments={attachments}
        isPending={isPending}
        onEdit={onEdit}
        onCancel={onCancel}
        onSubjectChange={onSubjectChange}
        onBodyChange={onBodyChange}
        onStatusChange={onStatusChange}
        onAddAttachment={onAddAttachment}
        onUpdateAttachment={onUpdateAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onSave={onSave}
      />
    );
  }

  const label = ARTIFACT_LABELS[artifact];
  const metaDate = formatTimestamp(meeting.created_at);
  const durationLabel =
    meeting.duration_seconds != null && meeting.duration_seconds > 0
      ? formatMeetingDuration(meeting.duration_seconds)
      : null;

  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Meeting recorded {metaDate}
          {durationLabel ? ` · ${durationLabel}` : ""}
        </p>
      </div>

      {artifact === "audio" && (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20 text-center p-6">
          <Mic className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No audio was captured for this meeting.
          </p>
        </div>
      )}

      {artifact === "transcript" && (
        <div className="rounded-xl border border-border bg-muted/10 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
            {meeting.transcript || "(No transcript recorded)"}
          </pre>
        </div>
      )}

      {artifact === "summary" && (
        <div className="rounded-xl border border-border bg-muted/10 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-foreground">
            {meeting.summary || "(No summary available)"}
          </pre>
        </div>
      )}

      {artifact === "action_items" && (
        <div className="rounded-xl border border-border bg-muted/10 p-4">
          {meeting.action_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">(No action items recorded)</p>
          ) : (
            <ul className="space-y-2">
              {meeting.action_items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {artifact === "note" && !draft && (
        <div className="rounded-xl border border-border bg-muted/10 p-4">
          <p className="text-sm text-muted-foreground">No formatted meeting note linked to this meeting.</p>
        </div>
      )}
    </div>
  );
}

function formatMeetingDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
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
