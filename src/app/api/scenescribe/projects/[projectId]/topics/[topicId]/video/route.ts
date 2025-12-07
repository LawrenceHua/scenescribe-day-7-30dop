import { NextRequest, NextResponse } from "next/server";
import { getScenescribeProject } from "@/lib/scenescribe/store";

export async function GET(_: NextRequest, { params }: { params: { projectId: string; topicId: string } }) {
  const project = await getScenescribeProject(params.projectId);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const topic = project.topics.find((t) => t.id === params.topicId);
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  return NextResponse.json({
    status: topic.videoStatus || "pending",
    media: topic.media || null,
  });
}

