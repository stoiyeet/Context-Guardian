"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  Background,
  type Edge,
  MarkerType,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { OpsTicket } from "@/lib/types";

type EvidenceGraphProps = {
  ticket: OpsTicket;
  height?: number;
};

function sourceBadge(sourceType: string): string {
  if (sourceType === "slack") {
    return "SLK";
  }
  if (sourceType === "jira") {
    return "INF";
  }
  if (sourceType === "confluence") {
    return "PM";
  }
  if (sourceType === "regulatory") {
    return "REG";
  }
  return "TKT";
}

function toArtifactHref(documentRef: string): string | null {
  if (!documentRef || documentRef === "Current ticket") {
    return null;
  }
  if (documentRef.startsWith("/")) {
    return documentRef;
  }
  if (documentRef.startsWith("http")) {
    return documentRef;
  }
  return `/knowledge-base?artifact=${documentRef}`;
}

export default function EvidenceGraph({ ticket, height = 260 }: EvidenceGraphProps) {
  const router = useRouter();

  const nodes = useMemo<Node[]>(
    () =>
      ticket.evidenceNodes.map((node) => ({
        id: node.id,
        position: node.position,
        data: {
          label: (
            <div className="evidence-node-card">
              <p>
                <span className="evidence-node-badge">{sourceBadge(node.sourceType)}</span>
                {node.label}
              </p>
              <span>{node.snippet}</span>
            </div>
          ),
          href: toArtifactHref(node.documentRef),
        },
        draggable: false,
      })),
    [ticket.evidenceNodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      ticket.evidenceEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [ticket.evidenceEdges],
  );

  if (nodes.length === 0) {
    return <p className="evidence-graph-hint">No evidence graph available yet.</p>;
  }

  return (
    <div className="evidence-graph-wrap" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => {
          const href = (node.data as { href?: string } | undefined)?.href;
          if (!href) {
            return;
          }
          if (href.startsWith("http")) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
          }
          router.push(href);
        }}
      >
        <Background gap={22} size={1} color="rgba(232, 234, 237, 0.08)" />
      </ReactFlow>
    </div>
  );
}
