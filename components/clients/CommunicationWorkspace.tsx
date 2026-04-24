"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Mail, Mic, Paperclip, Save } from "lucide-react";
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

interface CommunicationWorkspaceProps {
  advisorId: number;
  clientId: number;
  clientName: string;
  drafts: CommunicationDraft[];
  autoOpenMeeting?: boolean;
}

function draftTypeLabel(draftType: CommunicationDraft["draft_type"]): string {
  if (draftType === "meeting_request") return "Meeting request";
  if (draftType === "meeting_summary") return "Meeting note";
  return "Client email";
}

function blankAttachment(): AttachmentReference {
  return {
    id: crypto.randomUUID(),
    name: "",
    note: "",
  };
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function CommunicationWorkspace({
  advisorId,
  clientId,
  clientName,
  drafts,
  autoOpenMeeting = false,
}: CommunicationWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftsState, setDraftsState] = useState(drafts);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(
    drafts[0]?.draft_id ?? null,
  );
  const [subject, setSubject] = useState(drafts[0]?.subject ?? "");
  const [body, setBody] = useState(drafts[0]?.body ?? "");
  const [status, setStatus] = useState<CommunicationDraft["status"]>(
    drafts[0]?.status ?? "draft",
  );
  const [attachments, setAttachments] = useState<AttachmentReference[]>(
    drafts[0]?.attachment_metadata ?? [],
  );
  const [meetingOpen, setMeetingOpen] = useState(autoOpenMeeting);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDraft = useMemo(
    () => draftsState.find((draft) => draft.draft_id === selectedDraftId) ?? null,
    [draftsState, selectedDraftId],
  );

  useEffect(() => {
    if (!selectedDraft) return;
    setSubject(selectedDraft.subject);
    setBody(selectedDraft.body);
    setStatus(selectedDraft.status);
    setAttachments(selectedDraft.attachment_metadata);
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
    setDraftsState((currentDrafts) => {
      const remaining = currentDrafts.filter(
        (draft) => draft.draft_id !== updatedDraft.draft_id,
      );
      return [updatedDraft, ...remaining];
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
        setMessage("Draft saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to save draft.");
      }
    });
  };

  const updateAttachment = (
    attachmentId: string,
    key: keyof AttachmentReference,
    value: string,
  ) => {
    setAttachments((currentAttachments) =>
      currentAttachments.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, [key]: value }
          : attachment,
      ),
    );
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Communication Workspace
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generate a pre-populated note for {clientName}, edit it, add attachment
            placeholders, or capture a meeting note and save it for later.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
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
            onClick={() => handleGenerate("email")}
            disabled={isPending}
            className="gap-2"
          >
            <Mail className="h-4 w-4" />
            Generate email
          </Button>
          <Button
            variant="outline"
            onClick={() => handleGenerate("meeting_request")}
            disabled={isPending}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            Generate meeting request
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
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

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Saved drafts</p>
          {draftsState.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved drafts yet. Generate one to get started.
            </p>
          ) : (
            draftsState.map((draft) => (
              <button
                key={draft.draft_id}
                onClick={() => setSelectedDraftId(draft.draft_id)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  selectedDraftId === draft.draft_id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {draftTypeLabel(draft.draft_type)}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground capitalize">
                    {draft.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {draft.subject}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {formatTimestamp(draft.updated_at)}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px] gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="draft-subject">
                Subject
              </label>
              <Input
                id="draft-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Draft subject"
                disabled={!selectedDraft}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="draft-status">
                Status
              </label>
              <select
                id="draft-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as CommunicationDraft["status"])
                }
                disabled={!selectedDraft}
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
              Message
            </label>
            <Textarea
              id="draft-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Draft body"
              className="min-h-[320px]"
              disabled={!selectedDraft}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Paperclip className="h-4 w-4 text-primary" />
                Attachment placeholders
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttachments((current) => [...current, blankAttachment()])}
                disabled={!selectedDraft}
              >
                Add attachment
              </Button>
            </div>

            <div className="space-y-3">
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No attachment placeholders added yet.
                </p>
              ) : (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3"
                  >
                    <Input
                      value={attachment.name}
                      onChange={(event) =>
                        updateAttachment(attachment.id, "name", event.target.value)
                      }
                      placeholder="Attachment name"
                      disabled={!selectedDraft}
                    />
                    <Input
                      value={attachment.note}
                      onChange={(event) =>
                        updateAttachment(attachment.id, "note", event.target.value)
                      }
                      placeholder="Why include it"
                      disabled={!selectedDraft}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(attachment.id)}
                      disabled={!selectedDraft}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Version one saves editable drafts only. Sending and real file delivery can be layered in later.
            </p>
            <Button
              onClick={handleSave}
              disabled={!selectedDraft || isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
