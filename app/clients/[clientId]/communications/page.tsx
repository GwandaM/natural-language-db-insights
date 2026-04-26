import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getClientCommunicationDrafts,
  getClientDetail,
  getClientMeetings,
} from "@/lib/advisor-data";
import { CommunicationsExplorer } from "@/components/clients/CommunicationsExplorer";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClientCommunicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const advisorId = parseInt(
    (resolvedSearchParams?.advisor as string) ?? "1",
    10,
  );
  const clientId = parseInt(resolvedParams.clientId, 10);
  const autoOpenMeeting =
    String(resolvedSearchParams?.startMeeting ?? "") === "1";

  const [clientDetail, drafts, meetings] = await Promise.all([
    getClientDetail(advisorId, clientId),
    getClientCommunicationDrafts(advisorId, clientId),
    getClientMeetings(advisorId, clientId),
  ]);

  if (!clientDetail) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/clients?advisor=${advisorId}`}
          className="hover:text-foreground transition-colors"
        >
          Clients
        </Link>
        <span>/</span>
        <Link
          href={`/clients/${clientId}?advisor=${advisorId}`}
          className="hover:text-foreground transition-colors"
        >
          {clientDetail.client_name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Communications</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Communications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Past meetings, transcripts, drafts, and shared documents for{" "}
            {clientDetail.client_name}.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${clientId}?advisor=${advisorId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to client
          </Link>
        </Button>
      </div>

      <CommunicationsExplorer
        advisorId={advisorId}
        clientId={clientId}
        clientName={clientDetail.client_name}
        drafts={drafts}
        meetings={meetings}
        autoOpenMeeting={autoOpenMeeting}
      />
    </div>
  );
}
