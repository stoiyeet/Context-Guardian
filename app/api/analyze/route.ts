import { NextResponse } from "next/server";
import { analyzeIncident } from "@/lib/ambient-ops/analyzer";
import type { EnvironmentType, ExecutionSurface, IncidentInput } from "@/lib/ambient-ops/types";

export const dynamic = "force-dynamic";

const ENVIRONMENTS: EnvironmentType[] = ["local", "staging", "production", "shared-ci"];
const SURFACES: ExecutionSurface[] = ["terminal", "ci", "deploy", "manual"];

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseEnvironment(value: unknown): EnvironmentType {
  return ENVIRONMENTS.includes(value as EnvironmentType)
    ? (value as EnvironmentType)
    : "local";
}

function parseSurface(value: unknown): ExecutionSurface {
  return SURFACES.includes(value as ExecutionSurface) ? (value as ExecutionSurface) : "terminal";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<IncidentInput>;

    const errorText = asString(body.errorText).trim();
    if (!errorText) {
      return NextResponse.json(
        { error: "errorText is required" },
        { status: 400 },
      );
    }

    const input: IncidentInput = {
      errorText,
      component: asString(body.component).trim() || "unknown-component",
      environment: parseEnvironment(body.environment),
      surface: parseSurface(body.surface),
      userDescription: asString(body.userDescription).trim() || undefined,
      terminalHistory: asStringArray(body.terminalHistory),
    };

    const analysis = await analyzeIncident(input);
    return NextResponse.json(analysis);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to analyze incident";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

