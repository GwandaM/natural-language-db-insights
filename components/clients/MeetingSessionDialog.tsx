"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Mic,
  Pause,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import {
  createMeetingSummaryDraft,
  generateMeetingSummaryPreview,
} from "@/app/cockpit-actions";
import { CommunicationDraft } from "@/lib/advisor-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface MeetingSessionDialogProps {
  advisorId: number;
  clientId: number;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftSaved: (draft: CommunicationDraft) => void;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  }
  return `${remainingSeconds}s`;
}

function parseActionItems(text: string): string[] {
  return text
    .split("\n")
    .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
    .filter((item) => item.length > 0);
}

export function MeetingSessionDialog({
  advisorId,
  clientId,
  clientName,
  open,
  onOpenChange,
  onDraftSaved,
}: MeetingSessionDialogProps) {
  const [tab, setTab] = useState("capture");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [actionItemsText, setActionItemsText] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isTranscriptionSupported, setIsTranscriptionSupported] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const transcriptRef = useRef("");
  const sessionAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTranscriptionSupported(
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  useEffect(() => {
    if (!open) {
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript("");
      return;
    }

    if (!subject) {
      setSubject(`Meeting summary: ${clientName}`);
    }
  }, [clientName, open, subject]);

  useEffect(() => {
    if (!isListening || sessionAnchorRef.current == null) return;

    const tick = () => {
      if (sessionAnchorRef.current == null) return;
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - sessionAnchorRef.current) / 1000)),
      );
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [isListening]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  const actionItemCount = useMemo(
    () => parseActionItems(actionItemsText).length,
    [actionItemsText],
  );

  const clearSession = () => {
    shouldRestartRef.current = false;
    recognitionRef.current?.abort();
    setIsListening(false);
    setTab("capture");
    setTranscript("");
    setInterimTranscript("");
    setSubject(`Meeting summary: ${clientName}`);
    setSummary("");
    setActionItemsText("");
    setSessionStartedAt(null);
    setElapsedSeconds(0);
    setMessage(null);
    setError(null);
    sessionAnchorRef.current = null;
  };

  const ensureSessionStarted = () => {
    if (sessionAnchorRef.current != null) return;

    const anchor = Date.now() - elapsedSeconds * 1000;
    sessionAnchorRef.current = anchor;
    if (!sessionStartedAt) {
      setSessionStartedAt(new Date(anchor).toISOString());
    }
  };

  const stopListening = (abort = false) => {
    shouldRestartRef.current = false;
    if (sessionAnchorRef.current != null) {
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - sessionAnchorRef.current) / 1000)),
      );
    }
    setIsListening(false);
    setInterimTranscript("");
    try {
      if (abort) {
        recognitionRef.current?.abort();
      } else {
        recognitionRef.current?.stop();
      }
    } catch {
      // Browser speech APIs can throw if stopped from an idle state.
    }
  };

  const startListening = () => {
    setMessage(null);
    setError(null);
    ensureSessionStarted();

    if (!isTranscriptionSupported) {
      setMessage(
        "Live browser transcription is unavailable here. You can still paste or type the transcript manually.",
      );
      return;
    }

    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setMessage(
        "Live browser transcription is unavailable here. You can still paste or type the transcript manually.",
      );
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-ZA";

      recognition.onresult = (event) => {
        let finalChunk = "";
        let nextInterim = "";

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcriptPart = result[0]?.transcript?.trim() ?? "";
          if (!transcriptPart) continue;

          if (result.isFinal) {
            finalChunk += `${transcriptPart} `;
          } else {
            nextInterim += `${transcriptPart} `;
          }
        }

        if (finalChunk.trim()) {
          setTranscript((current) =>
            [current.trim(), finalChunk.trim()].filter(Boolean).join("\n"),
          );
        }

        setInterimTranscript(nextInterim.trim());
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        shouldRestartRef.current = false;

        if (event.error === "not-allowed") {
          setError("Microphone access was blocked. Allow microphone access and try again.");
          return;
        }

        if (event.error === "no-speech") {
          setMessage("No speech was detected. You can continue speaking or type notes manually.");
          return;
        }

        setError(`Transcription stopped: ${event.error}.`);
      };

      recognition.onend = () => {
        if (shouldRestartRef.current) {
          try {
            recognition.start();
            return;
          } catch {
            setIsListening(false);
          }
        }

        setIsListening(false);
        setInterimTranscript("");
      };

      recognitionRef.current = recognition;
    }

    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setError("Transcription is already running or the browser did not allow the session to start.");
    }
  };

  const handleGenerateSummary = () => {
    setError(null);
    setMessage(null);
    stopListening();

    if (!transcript.trim()) {
      setError("Capture or paste the meeting transcript before generating a summary.");
      return;
    }

    startGenerating(async () => {
      try {
        const preview = await generateMeetingSummaryPreview({
          advisorId,
          clientId,
          transcript,
        });
        setSubject(preview.subject);
        setSummary(preview.summary);
        setActionItemsText(preview.actionItems.join("\n"));
        setTab("review");
        setMessage("Meeting summary generated. Review and edit it before saving.");
      } catch (generationError) {
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Failed to generate the meeting summary.",
        );
      }
    });
  };

  const handleSave = () => {
    setError(null);
    setMessage(null);

    if (!transcript.trim()) {
      setError("A transcript or meeting notes are required before saving.");
      return;
    }

    if (!summary.trim()) {
      setError("Generate or enter the meeting summary before saving.");
      return;
    }

    startSaving(async () => {
      try {
        const draft = await createMeetingSummaryDraft({
          advisorId,
          clientId,
          subject,
          summary,
          actionItems: parseActionItems(actionItemsText),
          transcript,
          startedAt: sessionStartedAt,
          durationSeconds: elapsedSeconds,
        });
        onDraftSaved(draft);
        clearSession();
        onOpenChange(false);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save the meeting note.",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle>Meeting session</DialogTitle>
            <DialogDescription>
              Capture a live transcript for {clientName}, generate an AI meeting
              note, edit it for accuracy, and save it into client communications.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Session
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {sessionStartedAt ? "In progress" : "Not started"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Duration
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Transcription
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {isTranscriptionSupported ? "Browser live transcript available" : "Manual transcript mode"}
              </p>
            </div>
          </div>

          {(message || error) && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                error
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
                  : "border-border bg-muted/30 text-muted-foreground"
              }`}
            >
              {error ?? message}
            </div>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="capture">Capture</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
            </TabsList>

            <TabsContent value="capture" className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={startListening}
                  disabled={isGenerating || isSaving}
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  {isListening ? "Listening…" : "Start live transcript"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => stopListening()}
                  disabled={!isListening || isGenerating || isSaving}
                  className="gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
                <Button
                  variant="outline"
                  onClick={clearSession}
                  disabled={isGenerating || isSaving}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating || isSaving}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {isGenerating ? "Generating…" : "Generate summary"}
                </Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="meeting-transcript">
                    Transcript
                  </label>
                  <Textarea
                    id="meeting-transcript"
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    placeholder="Live transcription will appear here. You can also paste or type meeting notes manually."
                    className="min-h-[360px]"
                  />
                  {interimTranscript && (
                    <p className="text-sm text-muted-foreground italic">
                      Listening: {interimTranscript}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Workflow
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Start the live transcript if your browser supports it. You can
                      pause, edit, or paste notes before generating the meeting note.
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>1. Capture or paste the meeting transcript.</p>
                    <p>2. Generate the AI summary and action items.</p>
                    <p>3. Edit the note for accuracy.</p>
                    <p>4. Save it into Client Communications.</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background/70 p-3 text-sm text-muted-foreground">
                    Browser transcription depends on the Web Speech API and microphone
                    permission. If it is unavailable, manual transcript capture still works.
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="review" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="meeting-subject">
                      Subject
                    </label>
                    <Input
                      id="meeting-subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Meeting summary subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="meeting-summary">
                      Summary
                    </label>
                    <Textarea
                      id="meeting-summary"
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder="AI-generated or manually edited meeting summary"
                      className="min-h-[180px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="meeting-actions">
                      Action items
                    </label>
                    <Textarea
                      id="meeting-actions"
                      value={actionItemsText}
                      onChange={(event) => setActionItemsText(event.target.value)}
                      placeholder="One action item per line"
                      className="min-h-[160px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      {actionItemCount} action item{actionItemCount === 1 ? "" : "s"} ready to save.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="meeting-review-transcript">
                    Transcript
                  </label>
                  <Textarea
                    id="meeting-review-transcript"
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    placeholder="Transcript"
                    className="min-h-[420px]"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t border-border px-6 py-4">
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateSummary}
              disabled={isGenerating || isSaving}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Generating…" : "Refresh summary"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isGenerating || isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving…" : "Save to communications"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
