"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clapperboard, FileText, Globe2, Loader2, Play, Settings, Sparkles, Wand2 } from "lucide-react";
import { ScenescribeConfig, ScenescribeProject, ScenescribeTopic } from "@/types/scenescribe";

type Step = "ingest" | "structure" | "scripts";

const defaultConfig: ScenescribeConfig = {
  platform: "youtube",
  aspectRatio: "16:9",
  tone: "educational",
  style: "semi-abstract",
  targetDurationSeconds: 60,
};

const sampleText =
  "The product requirements document describes SceneScribe, which converts any link or pasted text into vivid, topic-based explainer videos. It auto-segments content, lets users edit topics, generates narration and scenes, and renders per-topic MP4s with captions.";

export default function SceneScribePage() {
  const [step, setStep] = useState<Step>("ingest");
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState(sampleText);
  const [config, setConfig] = useState<ScenescribeConfig>(defaultConfig);
  const [project, setProject] = useState<ScenescribeProject | null>(null);
  const [draftTopics, setDraftTopics] = useState<ScenescribeTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoGenerating, setVideoGenerating] = useState(false);

  const canProceedToStructure = useMemo(() => Boolean(project?.topics?.length), [project]);

  const handleCreateProject = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scenescribe/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputType,
          url: inputType === "url" ? url : undefined,
          rawText: inputType === "text" ? rawText : undefined,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }
      setProject(data.project);
      setDraftTopics(data.project.topics);
      setStep("structure");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [config, inputType, rawText, url]);

  const handleSaveTopics = useCallback(async () => {
    if (!project) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenescribe/projects/${project.id}/topics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: draftTopics }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update topics");
      setProject(data.project);
      setDraftTopics(data.project.topics);
      setStep("scripts");
    } catch (err: any) {
      setError(err.message || "Failed to update topics");
    } finally {
      setIsLoading(false);
    }
  }, [draftTopics, project]);

  const handleGenerateScripts = useCallback(
    async (topicIds?: string[]) => {
      if (!project) return;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/scenescribe/projects/${project.id}/scripts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: topicIds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to generate scripts");
        setProject(data.project);
        setDraftTopics(data.project.topics);
      } catch (err: any) {
        setError(err.message || "Failed to generate scripts");
      } finally {
        setIsLoading(false);
      }
    },
    [project]
  );

  const handleGenerateVideos = useCallback(async () => {
    if (!project) return;
    setVideoGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenescribe/projects/${project.id}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: project.topics.filter((t) => t.enabled !== false).map((t) => t.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate videos");
      setProject(data.project);
      setDraftTopics(data.project.topics);
    } catch (err: any) {
      setError(err.message || "Failed to generate videos");
    } finally {
      setVideoGenerating(false);
    }
  }, [project]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (project?.topics.some((t) => t.videoStatus && t.videoStatus !== "ready")) {
      interval = setInterval(async () => {
        const res = await fetch(`/api/scenescribe/projects/${project.id}`);
        if (res.ok) {
          const data = await res.json();
          setProject(data.project);
          setDraftTopics(data.project.topics);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [project?.id, project?.topics]);

  const stepIndicator = useMemo(
    () => [
      { id: "ingest", label: "Input", icon: Globe2 },
      { id: "structure", label: "Structure", icon: FileText },
      { id: "scripts", label: "Scripts & Video", icon: Sparkles },
    ],
    []
  );

  const renderTopicCard = (topic: ScenescribeTopic, idx: number) => (
    <div
      key={topic.id}
      className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3"
      data-testid={`topic-card-${idx}`}
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 px-2 py-1 bg-slate-800 rounded">
            Topic {topic.order}
          </span>
          <input
            className="w-full md:w-72 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-white text-sm"
            value={topic.title}
            onChange={(e) =>
              setDraftTopics((prev) =>
                prev.map((t) => (t.id === topic.id ? { ...t, title: e.target.value } : t))
              )
            }
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={topic.enabled !== false}
            onChange={(e) =>
              setDraftTopics((prev) =>
                prev.map((t) => (t.id === topic.id ? { ...t, enabled: e.target.checked } : t))
              )
            }
            className="accent-amber-400"
          />
          Enabled
        </label>
      </div>
      <textarea
        className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
        rows={3}
        value={topic.description}
        onChange={(e) =>
          setDraftTopics((prev) =>
            prev.map((t) => (t.id === topic.id ? { ...t, description: e.target.value } : t))
          )
        }
      />
      <div className="flex flex-wrap gap-2 text-xs text-slate-300">
        {topic.keyPoints?.map((kp, kpIdx) => (
          <span key={kpIdx} className="px-2 py-1 bg-slate-800 rounded-full border border-slate-700">
            • {kp}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050304] text-slate-100">
      <main className="container mx-auto px-4 py-16 max-w-5xl">
        <Link href="/30-days-of-product" className="inline-flex items-center text-slate-400 hover:text-amber-400 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to 30 Days Challenge
        </Link>

        <header className="mb-8 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Clapperboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">SceneScribe</h1>
              <p className="text-slate-400 text-sm md:text-base">
                Link or text → topics → scripts → vivid, per-topic explainer videos with captions.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {stepIndicator.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isPast = stepIndicator.findIndex((si) => si.id === step) > idx;
              return (
                <div
                  key={s.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
                    isActive
                      ? "bg-amber-500 text-slate-950 border-amber-500"
                      : isPast
                        ? "bg-slate-800 text-amber-300 border-slate-700"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </div>
              );
            })}
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Step 1: Input */}
        <section
          className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-8"
          data-testid="scenescribe-input-step"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe2 className="w-5 h-5 text-amber-400" />
              Input & Config
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`px-2 py-1 rounded ${inputType === "url" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800"}`}>
                URL
              </span>
              <span className={`px-2 py-1 rounded ${inputType === "text" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800"}`}>
                Text
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex gap-3">
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                    inputType === "url"
                      ? "bg-amber-500 text-slate-950 border-amber-500"
                      : "bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                  onClick={() => setInputType("url")}
                >
                  Paste a link
                </button>
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                    inputType === "text"
                      ? "bg-amber-500 text-slate-950 border-amber-500"
                      : "bg-slate-800 text-slate-200 border-slate-700"
                  }`}
                  onClick={() => setInputType("text")}
                >
                  Paste text
                </button>
              </div>
              {inputType === "url" ? (
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white"
                />
              ) : (
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white"
                  placeholder="Paste or type the text you want to convert..."
                />
              )}
              <button
                onClick={handleCreateProject}
                disabled={isLoading || (!url && inputType === "url") || (!rawText && inputType === "text")}
                data-testid="scenescribe-create"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-semibold disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Create project
              </button>
            </div>
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                <Settings className="w-4 h-4" />
                Output config
              </div>
              <div className="space-y-2">
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  Platform
                  <select
                    value={config.platform}
                    onChange={(e) => setConfig({ ...config, platform: e.target.value as ScenescribeConfig["platform"] })}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok/Reels</option>
                    <option value="generic">Generic</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  Aspect ratio
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value as ScenescribeConfig["aspectRatio"] })}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  Tone
                  <select
                    value={config.tone}
                    onChange={(e) => setConfig({ ...config, tone: e.target.value as ScenescribeConfig["tone"] })}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="educational">Educational</option>
                    <option value="casual">Casual</option>
                    <option value="serious">Serious</option>
                    <option value="playful">Playful</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  Style
                  <select
                    value={config.style}
                    onChange={(e) => setConfig({ ...config, style: e.target.value as ScenescribeConfig["style"] })}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="realistic">Realistic</option>
                    <option value="semi-abstract">Semi-abstract</option>
                    <option value="diagram-heavy">Diagram heavy</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  Target duration (sec/topic)
                  <input
                    type="number"
                    min={20}
                    max={120}
                    value={config.targetDurationSeconds}
                    onChange={(e) => setConfig({ ...config, targetDurationSeconds: Number(e.target.value) })}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                Fast, low-latency generation with captions on by default. Works on desktop and mobile.
              </p>
            </div>
          </div>
        </section>

        {/* Step 2: Topics */}
        {canProceedToStructure && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-8" data-testid="scenescribe-topics">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                Structure & Topics
              </h2>
              <button
                onClick={handleSaveTopics}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 hover:border-amber-400 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Save topics
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1 bg-slate-800/70 border border-slate-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-2">Summary</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {project?.summary || "Structured summary will appear here after parsing."}
                </p>
              </div>
              <div className="md:col-span-2 space-y-3">
                {draftTopics.map((topic, idx) => renderTopicCard(topic, idx))}
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Scripts & Video */}
        {project && step === "scripts" && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4" data-testid="scenescribe-scripts">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Scripts, Scenes, and Video
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleGenerateScripts()}
                  disabled={isLoading}
                  data-testid="scenescribe-generate-scripts"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-semibold disabled:opacity-60"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Generate scripts
                </button>
                <button
                  onClick={handleGenerateVideos}
                  disabled={videoGenerating}
                  data-testid="scenescribe-generate-videos"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 hover:border-amber-400 disabled:opacity-60"
                >
                  {videoGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Generate videos
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {project.topics.map((topic) => (
                <div key={topic.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-400 px-2 py-1 bg-slate-800 rounded">
                          Topic {topic.order}
                        </span>
                        <span className="text-white font-semibold">{topic.title}</span>
                        {topic.scriptStatus === "ready" && (
                          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 px-2 py-1 rounded">
                            Script ready
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300">{topic.description}</p>
                    </div>
                    <button
                      onClick={() => handleGenerateScripts([topic.id])}
                      className="text-xs px-3 py-1.5 rounded bg-slate-800 text-slate-200 border border-slate-700 hover:border-amber-400"
                    >
                      Regenerate script
                    </button>
                  </div>
                  {topic.narration && (
                    <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 text-sm text-slate-200">
                      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Narration</div>
                      {topic.narration}
                    </div>
                  )}
                  {topic.scenes && topic.scenes.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {topic.scenes.map((scene) => (
                        <div key={scene.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-200 font-semibold">
                              Scene {scene.order}: {scene.sceneSummary}
                            </span>
                            <span className="text-xs text-slate-400">{scene.estimatedDurationSeconds || 8}s</span>
                          </div>
                          <p className="text-slate-300 mb-2">{scene.visualDescription}</p>
                          <div className="text-xs text-slate-400 space-y-1">
                            <p>Actions: {scene.actions?.join("; ")}</p>
                            <p>Props: {scene.props?.join("; ")}</p>
                            <p>Overlays: {scene.overlayTextSuggestions?.join("; ")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded border ${
                        topic.videoStatus === "ready"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
                          : topic.videoStatus === "generating" || topic.videoStatus === "assembling"
                            ? "bg-amber-500/10 text-amber-300 border-amber-500/40"
                            : topic.videoStatus === "failed"
                              ? "bg-red-500/10 text-red-300 border-red-500/40"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {topic.videoStatus || "pending"}
                    </span>
                    {topic.media?.videoUrl && (
                      <Link
                        href={topic.media.videoUrl}
                        target="_blank"
                        data-testid="scenescribe-video-link"
                        className="text-xs inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline"
                      >
                        Preview MP4
                      </Link>
                    )}
                  </div>
                  {topic.media?.videoUrl && (
                    <video
                      controls
                      className="w-full rounded-lg border border-slate-800"
                      src={topic.media.videoUrl}
                      poster={topic.media.thumbnailUrl}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

