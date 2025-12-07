export type ScenescribePlatform = "youtube" | "tiktok" | "generic";
export type ScenescribeAspectRatio = "16:9" | "9:16" | "1:1";
export type ScenescribeTone = "educational" | "casual" | "serious" | "playful";
export type ScenescribeStyle = "realistic" | "semi-abstract" | "diagram-heavy";

export type ScenescribeConfig = {
  platform: ScenescribePlatform;
  aspectRatio: ScenescribeAspectRatio;
  tone: ScenescribeTone;
  style: ScenescribeStyle;
  targetDurationSeconds: number;
  topicOverrides?: Record<
    string,
    {
      tone?: ScenescribeTone;
      durationSeconds?: number;
    }
  >;
};

export type ScenescribeTopic = {
  id: string;
  order: number;
  title: string;
  description: string;
  keyPoints: string[];
  enabled: boolean;
  sourceSpan?: { startChar: number; endChar: number };
  narration?: string;
  scenes?: ScenescribeScene[];
  toneOverride?: ScenescribeTone;
  durationSeconds?: number;
  scriptStatus?: ScenescribeTaskStatus;
  videoStatus?: ScenescribeTaskStatus;
  media?: ScenescribeMedia;
};

export type ScenescribeScene = {
  id: string;
  order: number;
  sceneSummary: string;
  visualDescription: string;
  actions: string[];
  props: string[];
  overlayTextSuggestions: string[];
  cameraStyle?: string;
  estimatedDurationSeconds?: number;
};

export type ScenescribeMedia = {
  videoUrl?: string;
  audioUrl?: string;
  subtitlesUrl?: string;
  thumbnailUrl?: string;
};

export type ScenescribeProject = {
  id: string;
  inputType: "url" | "text";
  url?: string;
  rawText?: string;
  cleanedText?: string;
  summary?: string;
  topics: ScenescribeTopic[];
  config: ScenescribeConfig;
  status:
    | "created"
    | "structured"
    | "scripts_ready"
    | "videos_generating"
    | "completed"
    | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type ScenescribeTaskStatus = "pending" | "generating" | "assembling" | "ready" | "failed";

export type ScenescribeStructureResponse = {
  summary: string;
  topics: ScenescribeTopic[];
};

export type ScenescribeScriptResponse = {
  topics: Array<{
    topicId: string;
    narration: string;
    scenes: ScenescribeScene[];
  }>;
};

export type ScenescribeVideoJob = {
  topicId: string;
  status: ScenescribeTaskStatus;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  media?: ScenescribeMedia;
};

