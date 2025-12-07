import { NextRequest, NextResponse } from "next/server";
import { getScenescribeProject, updateScenescribeProject } from "@/lib/scenescribe/store";
import { logger } from "@/lib/logger";

export async function GET(_: NextRequest, { params }: { params: { projectId: string } }) {
  const project = await getScenescribeProject(params.projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const body = await request.json();
    const project = await updateScenescribeProject(params.projectId, body);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (error) {
    logger.error("[SceneScribe] Failed to update project", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

