"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  HelpCircle,
  Info,
  LayoutGrid,
  LifeBuoy,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Target,
} from "lucide-react";
import type { SiteContext } from "@/application/hooks/use-site-context";
import type { SeniorsQuizQuestion } from "@/domain/seniors/types";
import {
  figureHeading,
  isRenderableImageUrl,
  normalizeTopicDiagrams,
  type TopicDiagramItem,
} from "@/domain/seniors/topic-diagrams";
import {
  buildTopicProgressMilestones,
  computeTopicProgressPercent,
} from "@/domain/seniors/topic-progress";
import { SeniorsTabBar } from "@/presentation/components/templates/seniors/shared/SeniorsUi";
import {
  TOPIC_TABS,
  type TopicTabIcon,
  type TopicTabId,
} from "@/presentation/components/templates/seniors/shared/seniors-nav";
import { StudentAiDoubtChat } from "@/presentation/components/templates/seniors/student/StudentAiDoubtChat";
import { pingSeniorsGamification } from "@/presentation/components/templates/seniors/gamification/ping-seniors-gamification";
import { StudentQuizPanel } from "@/presentation/components/templates/seniors/student/StudentHomeworkClients";
import { PhotosynthesisLeafDiagram } from "@/presentation/components/templates/seniors/student/PhotosynthesisLeafDiagram";
import { RichHtmlContent } from "@/presentation/components/practice/RichHtmlContent";
import {
  StudentEmptyState,
  StudentLiftCard,
  STUDENT_ACCENT,
  STUDENT_ACCENT_SOFT,
} from "@/presentation/components/templates/seniors/student/StudentPageChrome";
import { useSeniorsSite } from "@/presentation/components/website/TenantSiteShell";
import { formatDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";

export interface TopicPageData {
  id: string;
  slug: string;
  number: string;
  title: string;
  subjectName: string;
  chapterName: string;
  chapterNumber: number;
  learningObjective: string;
  teacherExplanation: string;
  keywords: string[];
  diagramUrl: string;
  diagrams?: TopicDiagramItem[];
  contentStatus: string;
  contents: {
    id: string;
    contentType: string;
    title: string;
    body: string;
    fileUrl: string;
    uploadedByName: string;
    updatedAt: Date;
  }[];
  homework: { id: string; title: string; dueAt: Date; questionCount: number }[];
  quizzes?: { id: string; title: string; questions: SeniorsQuizQuestion[] }[];
  quiz: { id: string; title: string; questions: SeniorsQuizQuestion[] } | null;
  prevSlug: string | null;
  nextSlug: string | null;
  prevTitle: string | null;
  nextTitle: string | null;
  topicPosition: number;
  topicTotal: number;
}

type TopicPageMode = "student" | "teacher-preview";

const TAB_ICONS: Record<TopicTabIcon, typeof LayoutGrid> = {
  layout: LayoutGrid,
  file: FileText,
  pencil: Pencil,
  refresh: RefreshCw,
  help: HelpCircle,
  "life-buoy": LifeBuoy,
};

function highlightKeywords(text: string, keywords: string[]) {
  if (!text) return "Content coming soon.";
  if (keywords.length === 0) {
    return text.split("\n").map((line, i) => (
      <p key={i} className={cn("leading-relaxed whitespace-pre-wrap", i > 0 && "mt-3")}>
        {line}
      </p>
    ));
  }

  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegExp).join("|")})`, "gi");

  return text.split("\n").map((line, i) => {
    const parts = line.split(pattern);
    return (
      <p key={i} className={cn("leading-relaxed whitespace-pre-wrap", i > 0 && "mt-3")}>
        {parts.map((part, j) => {
          const match = sorted.find((k) => k.toLowerCase() === part.toLowerCase());
          if (match) {
            return (
              <strong key={j} className="font-semibold text-[#111827]">
                {part}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        })}
      </p>
    );
  });
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value.trim());
}

function TopicDiagramCarousel({
  topic,
  diagramFailed,
  onDiagramError,
  className,
  compact = false,
}: {
  topic: TopicPageData;
  diagramFailed: boolean;
  onDiagramError: () => void;
  className?: string;
  compact?: boolean;
}) {
  const diagrams = useMemo(
    () => normalizeTopicDiagrams(topic.diagrams, topic.diagramUrl),
    [topic.diagrams, topic.diagramUrl],
  );
  const [index, setIndex] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIndex(0);
    setFailedUrls({});
  }, [topic.id]);

  const useInlinePhotosynthesis =
    topic.slug.includes("photosynthesis") && (diagrams.length === 0 || diagramFailed);

  if (useInlinePhotosynthesis) {
    return <PhotosynthesisLeafDiagram className={className} />;
  }

  if (diagrams.length === 0) {
    if (topic.slug.includes("photosynthesis")) {
      return <PhotosynthesisLeafDiagram className={className} />;
    }
    return (
      <p className="p-8 text-center text-sm text-[#6B7280]">Visual aid will appear here.</p>
    );
  }

  const safeIndex = Math.min(index, diagrams.length - 1);
  const current = diagrams[safeIndex];
  const currentFailed = failedUrls[current.url];

  if (currentFailed && topic.slug.includes("photosynthesis")) {
    return <PhotosynthesisLeafDiagram className={className} />;
  }

  function go(delta: number) {
    setIndex((prev) => (prev + delta + diagrams.length) % diagrams.length);
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex w-full items-center justify-center">
        {diagrams.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#E8EEF5] bg-white/95 text-[#374151] shadow-sm transition hover:bg-white"
            aria-label="Previous diagram"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {currentFailed ? (
          <p className="p-8 text-center text-sm text-[#6B7280]">Diagram could not be loaded.</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={figureHeading(safeIndex, current.caption) || `${topic.title} diagram`}
            className={className}
            onError={() => {
              setFailedUrls((prev) => ({ ...prev, [current.url]: true }));
              onDiagramError();
            }}
          />
        )}
        {diagrams.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#E8EEF5] bg-white/95 text-[#374151] shadow-sm transition hover:bg-white"
            aria-label="Next diagram"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-center font-medium text-[#374151]",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {figureHeading(safeIndex, current.caption)}
      </p>
      {diagrams.length > 1 ? (
        <div className="mt-2 flex items-center gap-1.5">
          {diagrams.map((d, i) => (
            <button
              key={`${d.url}-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex(i);
              }}
              className={cn(
                "h-1.5 rounded-full transition",
                i === safeIndex ? "w-4 bg-[var(--sp-brand)]" : "w-1.5 bg-[#D1D5DB]",
              )}
              aria-label={`Show diagram ${i + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TopicFocusOverlay({
  topic,
  diagramFailed,
  onDiagramError,
  onClose,
  ctx,
  topicHref,
}: {
  topic: TopicPageData;
  diagramFailed: boolean;
  onDiagramError: () => void;
  onClose: () => void;
  ctx: SiteContext;
  topicHref: (slug: string) => string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#0F172A]/75 p-4 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Topic focus view"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EEF5] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
              Focus mode · {topic.subjectName}
            </p>
            <h2 className="truncate text-lg font-bold text-[#111827]">
              {topic.number} {topic.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EEF5] bg-white px-3 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#F3F6FB]"
          >
            <Minimize2 className="h-4 w-4" />
            Exit focus
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#E8EEF5] bg-[#F8FAFD] p-4">
                <p className="text-sm font-bold text-[#111827]">Learning Objective</p>
                <div className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                  {looksLikeHtml(topic.learningObjective) ? (
                    <RichHtmlContent html={topic.learningObjective} className="text-sm leading-relaxed" />
                  ) : (
                    topic.learningObjective || "—"
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E8EEF5] p-4">
                <p className="text-sm font-bold text-[#111827]">Teacher Explanation</p>
                <div className="mt-3 max-h-[min(52vh,420px)] overflow-y-auto pr-1 text-sm text-[#4B5563]">
                  {looksLikeHtml(topic.teacherExplanation) ? (
                    <RichHtmlContent html={topic.teacherExplanation} className="text-sm leading-relaxed" />
                  ) : (
                    highlightKeywords(topic.teacherExplanation, topic.keywords)
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col rounded-2xl border border-[#E8EEF5] bg-[#F8FAFC] p-4">
              <p className="text-sm font-bold text-[#111827]">
                {topic.slug.includes("photosynthesis")
                  ? "Photosynthesis in Leaf"
                  : topic.title}
              </p>
              <div className="mt-4 flex flex-1 items-center justify-center">
                <TopicDiagramCarousel
                  topic={topic}
                  diagramFailed={diagramFailed}
                  onDiagramError={onDiagramError}
                  className="h-auto max-h-[min(52vh,480px)] w-full object-contain"
                />
              </div>
            </div>
          </div>

          {topic.keywords.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-sm font-bold text-[#111827]">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {topic.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold"
                    style={{ backgroundColor: STUDENT_ACCENT_SOFT, color: STUDENT_ACCENT }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E8EEF5] px-5 py-3">
          <p className="text-xs text-[#6B7280]">
            Topic {topic.topicPosition} of {topic.topicTotal} in {topic.subjectName}
          </p>
          <div className="flex items-center gap-2">
            {topic.prevSlug ? (
              <Link
                href={topicHref(topic.prevSlug)}
                className="rounded-xl border border-[#E8EEF5] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#F3F6FB]"
              >
                ← Previous
              </Link>
            ) : null}
            {topic.nextSlug ? (
              <Link
                href={topicHref(topic.nextSlug)}
                className="rounded-xl bg-[var(--sp-brand)] px-3 py-2 text-sm font-semibold text-[var(--sp-on-brand)] hover:bg-[#153a7d]"
              >
                Next →
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPdfUrl(url: string) {
  const trimmed = url.trim().toLowerCase();
  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  })();
  return (
    trimmed.endsWith(".pdf") ||
    trimmed.includes(".pdf?") ||
    decoded.includes(".pdf") ||
    trimmed.includes("application/pdf") ||
    trimmed.startsWith("data:application/pdf")
  );
}

/** Local `/uploads/seniors/...` paths do not persist on production deploys. */
function isEphemeralUploadUrl(url: string) {
  return /\/uploads\/seniors\//i.test(url.trim());
}

function ContentBlock({
  title,
  body,
  meta,
  fileUrl,
  icon: Icon,
  tint,
  embedNotes = false,
}: {
  title: string;
  body: string;
  meta?: string;
  fileUrl?: string;
  icon: typeof FileText;
  tint: string;
  /** When true, PDF/notes open inside this card -no external link CTA */
  embedNotes?: boolean;
}) {
  const pdf = Boolean(fileUrl && isPdfUrl(fileUrl));
  const fileMissing = Boolean(fileUrl && isEphemeralUploadUrl(fileUrl));

  if (embedNotes && fileUrl && (pdf || fileMissing)) {
    return (
      <StudentLiftCard className="overflow-hidden p-0">
        <div className="border-b border-[#E8EEF5] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tint)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[#111827]">{title}</p>
              {meta ? <p className="mt-0.5 text-xs text-[#9CA3AF]">{meta}</p> : null}
              {body ? (
                <div className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                  {looksLikeHtml(body) ? (
                    <RichHtmlContent html={body} className="text-sm leading-relaxed" />
                  ) : (
                    <div className="whitespace-pre-wrap">{body}</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {fileMissing ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-[#F8FAFC] px-6 py-10 text-center">
            <FileText className="h-8 w-8 text-[#94A3B8]" />
            <p className="text-sm font-medium text-[#334155]">Notes file is unavailable</p>
            <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">
              This file was not saved to cloud storage. Ask your teacher to upload the notes again.
            </p>
          </div>
        ) : (
          <div className="bg-[#F1F5F9]">
            <object
              data={`${fileUrl}#toolbar=1&navpanes=0`}
              type="application/pdf"
              className="h-[min(78vh,720px)] w-full"
              aria-label={`${title} notes PDF`}
            >
              <iframe
                title={`${title} notes`}
                src={fileUrl}
                className="h-[min(78vh,720px)] w-full border-0"
              />
            </object>
          </div>
        )}
      </StudentLiftCard>
    );
  }

  return (
    <StudentLiftCard className="p-5">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tint)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#111827]">{title}</p>
          {meta ? <p className="mt-0.5 text-xs text-[#9CA3AF]">{meta}</p> : null}
          {body ? (
            <div className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              {looksLikeHtml(body) ? (
                <RichHtmlContent html={body} className="text-sm leading-relaxed" />
              ) : (
                <div className="whitespace-pre-wrap">{body}</div>
              )}
            </div>
          ) : null}
          {fileUrl && embedNotes && isRenderableImageUrl(fileUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={title}
              className="mt-4 max-h-[min(70vh,560px)] w-full rounded-xl border border-[#E8EEF5] object-contain"
            />
          ) : null}
          {fileUrl && !embedNotes ? (
            <div className="mt-4">
              {pdf ? (
                <div className="overflow-hidden rounded-xl border border-[#E8EEF5] bg-[#F8FAFC]">
                  <iframe
                    title={`${title} PDF`}
                    src={fileUrl}
                    className="h-[min(70vh,560px)] w-full"
                  />
                </div>
              ) : isRenderableImageUrl(fileUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fileUrl}
                  alt={title}
                  className="max-h-72 rounded-xl border border-[#E8EEF5] object-contain"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </StudentLiftCard>
  );
}

export function StudentTopicPage({
  ctx,
  topic,
  mode = "student",
}: {
  ctx: SiteContext;
  topic: TopicPageData;
  mode?: TopicPageMode;
}) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TopicTabId) || "overview";
  const [tab, setTab] = useState<TopicTabId>(
    TOPIC_TABS.some((t) => t.id === initialTab) ? initialTab : "overview",
  );
  const router = useRouter();
  const [focusOpen, setFocusOpen] = useState(false);
  const [diagramFailed, setDiagramFailed] = useState(false);
  const site = useSeniorsSite();
  const topicHref = useCallback(
    (slug: string) =>
      mode === "teacher-preview"
        ? ctx.sitePath(`teacher/topics/${slug}/preview`)
        : ctx.sitePath(`student/learn/${slug}`),
    [ctx, mode],
  );

  const goToTopic = useCallback(
    (slug: string) => {
      router.push(topicHref(slug));
    },
    [router, topicHref],
  );

  const closeFocus = useCallback(() => setFocusOpen(false), []);

  useEffect(() => {
    if (mode !== "student") return;
    void pingSeniorsGamification(ctx.tenant, "learn");
  }, [ctx.tenant, mode]);

  const notes = topic.contents.filter(
    (c) => c.contentType === "notes" || c.contentType === "worksheet",
  );
  const practice = topic.contents.filter(
    (c) => c.contentType === "practice_question" || c.contentType === "practice",
  );
  const revision = topic.contents.filter(
    (c) =>
      c.contentType === "revision" ||
      c.contentType === "revision_note" ||
      c.contentType === "model_answer" ||
      c.contentType === "previous_paper",
  );

  const visitedTabsRef = useRef(new Set<TopicTabId>([initialTab]));

  const topicQuizzes =
    topic.quizzes && topic.quizzes.length > 0
      ? topic.quizzes
      : topic.quiz
        ? [topic.quiz]
        : [];

  type LessonStep = {
    tab: TopicTabId;
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    detail: string;
  };

  const lessonSteps: LessonStep[] = [];
  if (notes.length > 0) {
    lessonSteps.push({
      tab: "notes",
      eyebrow: "Recommended next step",
      title: "Read your teacher's notes",
      description: "Build your understanding with the material shared for this topic.",
      action: "Open notes",
      detail: `${notes.length} resource${notes.length === 1 ? "" : "s"} available`,
    });
  }
  if (practice.length > 0 || topic.homework.length > 0) {
    lessonSteps.push({
      tab: "practice",
      eyebrow: "Recommended next step",
      title: "Put the idea into practice",
      description: "Work through the practice material or homework linked to this topic.",
      action: "Start practice",
      detail: `${practice.length + topic.homework.length} item${practice.length + topic.homework.length === 1 ? "" : "s"} available`,
    });
  }
  if (revision.length > 0) {
    lessonSteps.push({
      tab: "revision",
      eyebrow: "Recommended next step",
      title: "Review the key points",
      description: "Use the revision material to reinforce what you have learned.",
      action: "Open revision",
      detail: `${revision.length} resource${revision.length === 1 ? "" : "s"} available`,
    });
  }
  if (topicQuizzes.some((quiz) => quiz.questions?.length > 0)) {
    lessonSteps.push({
      tab: "quiz",
      eyebrow: "Check your understanding",
      title: "Try the topic quiz",
      description: "See what you have understood and identify anything to revisit.",
      action: "Start quiz",
      detail: `${topicQuizzes.length} quiz${topicQuizzes.length === 1 ? "" : "zes"} available`,
    });
  }
  lessonSteps.push({
    tab: "need-help",
    eyebrow: "Need a hand?",
    title: "Ask a doubt about this topic",
    description: "Get help with a concept or a step that is not clear yet.",
    action: "Ask a doubt",
    detail: "Topic-aware help",
  });

  const recommendedStep =
    lessonSteps.find((step) => !visitedTabsRef.current.has(step.tab)) ??
    lessonSteps[0];

  const progressMilestones = useMemo(
    () =>
      buildTopicProgressMilestones({
        hasNotes: notes.length > 0,
        hasPractice: practice.length > 0,
        hasRevision: revision.length > 0,
        hasQuiz: topicQuizzes.some((q) => q.questions?.length > 0),
      }),
    [notes.length, practice.length, revision.length, topicQuizzes],
  );

  useEffect(() => {
    visitedTabsRef.current = new Set([tab]);
  }, [topic.id]);

  useEffect(() => {
    if (mode !== "student") return;
    if (!topic.id) return;

    visitedTabsRef.current.add(tab);
    const progressPercent = computeTopicProgressPercent(
      visitedTabsRef.current,
      progressMilestones,
    );

    void fetch(`/api/tenants/${site.tenant}/seniors/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: topic.id, progressPercent }),
    }).catch(() => {});
  }, [mode, tab, topic.id, site.tenant, progressMilestones]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (focusOpen) return;
      if (e.key === "ArrowLeft" && topic.prevSlug) {
        e.preventDefault();
        goToTopic(topic.prevSlug);
      }
      if (e.key === "ArrowRight" && topic.nextSlug) {
        e.preventDefault();
        goToTopic(topic.nextSlug);
      }
      if (e.key === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFocusOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusOpen, goToTopic, topic.nextSlug, topic.prevSlug]);

  const tabs = useMemo(
    () =>
      TOPIC_TABS.map((t) => {
        const Icon = TAB_ICONS[t.icon];
        return {
          id: t.id,
          label: t.label,
          icon: <Icon className="h-4 w-4" strokeWidth={2} />,
        };
      }),
    [],
  );

  const navBtnBase =
    "group relative inline-flex min-w-[7.5rem] flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition active:scale-[0.98]";
  const navBtnEnabled =
    "border-[#E8EEF5] bg-white hover:border-[var(--sp-brand)]/25 hover:bg-[#F3F6FB] hover:shadow-sm";
  const navBtnDisabled =
    "cursor-not-allowed border-[#F3F4F6] bg-[#FAFAFA] opacity-50";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#6B7280]">
          <Link
            href={mode === "teacher-preview" ? ctx.sitePath("teacher/content") : ctx.sitePath("student/learn")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E8EEF5] bg-white text-[#374151] shadow-sm transition hover:bg-[#F3F6FB]"
            aria-label={mode === "teacher-preview" ? "Back to Topic Studio" : "Back to Learn"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <nav className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
            <Link
              href={mode === "teacher-preview" ? ctx.sitePath("teacher/content") : ctx.sitePath("student/learn")}
              className="font-medium hover:text-[var(--sp-brand-text)]"
            >
              {mode === "teacher-preview" ? "Topic Studio" : "Learn"}
            </Link>
            <span className="text-[#D1D5DB]">/</span>
            <span>{topic.subjectName}</span>
            <span className="text-[#D1D5DB]">/</span>
            <span>Chapter {topic.chapterNumber}</span>
            <span className="text-[#D1D5DB]">/</span>
            <span className="font-medium text-[#374151]">{topic.chapterName}</span>
          </nav>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: STUDENT_ACCENT_SOFT, color: STUDENT_ACCENT }}
            >
              Topic {topic.topicPosition} of {topic.topicTotal}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#111827] sm:text-[1.75rem]">
              {topic.number} {topic.title}
            </h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              {topic.subjectName} · Ch {topic.chapterNumber}: {topic.chapterName}
            </p>
          </div>
          <div className="flex shrink-0 items-stretch gap-2">
            {topic.prevSlug ? (
              <Link
                href={topicHref(topic.prevSlug)}
                className={cn(navBtnBase, navBtnEnabled)}
                title={topic.prevTitle ?? "Previous topic"}
              >
                <span className="flex items-center gap-1 text-sm font-semibold text-[#374151]">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
                {topic.prevTitle ? (
                  <span className="line-clamp-1 max-w-[9rem] text-[11px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                    {topic.prevTitle}
                  </span>
                ) : null}
              </Link>
            ) : (
              <button type="button" disabled className={cn(navBtnBase, navBtnDisabled)}>
                <span className="flex items-center gap-1 text-sm font-semibold text-[#9CA3AF]">
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </span>
                <span className="text-[11px] text-[#D1D5DB]">First topic</span>
              </button>
            )}
            {topic.nextSlug ? (
              <Link
                href={topicHref(topic.nextSlug)}
                className={cn(navBtnBase, navBtnEnabled, "items-end text-right")}
                title={topic.nextTitle ?? "Next topic"}
              >
                <span className="flex items-center gap-1 text-sm font-semibold text-[#374151]">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
                {topic.nextTitle ? (
                  <span className="line-clamp-1 max-w-[9rem] text-[11px] text-[#9CA3AF] group-hover:text-[#6B7280]">
                    {topic.nextTitle}
                  </span>
                ) : null}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className={cn(navBtnBase, navBtnDisabled, "items-end text-right")}
              >
                <span className="flex items-center gap-1 text-sm font-semibold text-[#9CA3AF]">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </span>
                <span className="text-[11px] text-[#D1D5DB]">Last topic</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setFocusOpen(true)}
              className="inline-flex h-auto w-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-[#E8EEF5] bg-white text-[#6B7280] transition hover:border-[var(--sp-brand)]/25 hover:bg-[#F3F6FB] hover:text-[var(--sp-brand-text)]"
              aria-label="Open focus mode"
              title="Focus mode (F)"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8EEF5] bg-white px-2 shadow-sm">
        <SeniorsTabBar
          tabs={tabs}
          active={tab}
          onChange={(id) => setTab(id as TopicTabId)}
        />
      </div>

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid items-stretch gap-5 lg:grid-cols-5">
            <div className="flex flex-col gap-5 lg:col-span-3">
              <StudentLiftCard className="relative overflow-hidden p-5">
                <div
                  className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
                  style={{ backgroundColor: STUDENT_ACCENT }}
                />
                <div className="flex items-start gap-3 pl-2">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm"
                    style={{ backgroundColor: STUDENT_ACCENT_SOFT, color: STUDENT_ACCENT }}
                  >
                    <Target className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111827]">Learning Objective</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                      {looksLikeHtml(topic.learningObjective) ? (
                        <RichHtmlContent html={topic.learningObjective} className="text-sm leading-relaxed" />
                      ) : (
                        topic.learningObjective || "—"
                      )}
                    </p>
                  </div>
                </div>
              </StudentLiftCard>

              <StudentLiftCard className="flex min-h-0 flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#111827]">Teacher Explanation</p>
                  <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    School content
                  </span>
                </div>
                <div className="mt-3 max-h-[min(52vh,420px)] flex-1 overflow-y-auto pr-1 text-sm text-[#4B5563]">
                  {looksLikeHtml(topic.teacherExplanation) ? (
                    <RichHtmlContent html={topic.teacherExplanation} className="text-sm leading-relaxed" />
                  ) : (
                    highlightKeywords(topic.teacherExplanation, topic.keywords)
                  )}
                </div>
              </StudentLiftCard>
            </div>

            <StudentLiftCard className="group relative flex flex-col p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#111827]">
                  {topic.slug.includes("photosynthesis")
                    ? "Photosynthesis in Leaf"
                    : "Visual diagram"}
                </p>
                <button
                  type="button"
                  onClick={() => setFocusOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#6B7280] opacity-0 transition group-hover:opacity-100 hover:bg-[#F3F6FB] hover:text-[var(--sp-brand-text)]"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  Expand
                </button>
              </div>
              <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#E8EEF5] bg-gradient-to-b from-[#F8FAFC] to-white p-3">
                <TopicDiagramCarousel
                  topic={topic}
                  diagramFailed={diagramFailed}
                  onDiagramError={() => setDiagramFailed(true)}
                  className="h-auto max-h-[300px] w-full cursor-zoom-in object-contain"
                  compact
                />
              </div>
              <button
                type="button"
                onClick={() => setFocusOpen(true)}
                className="mt-2 text-center text-[11px] text-[#9CA3AF] hover:text-[var(--sp-brand-text)]"
              >
                Tap Expand to open focus mode
              </button>
            </StudentLiftCard>
          </div>

          {topic.keywords.length > 0 ? (
            <StudentLiftCard className="p-5">
              <p className="text-sm font-bold text-[#111827]">Keywords to remember</p>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                {topic.keywords.length} key terms highlighted in the explanation above
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topic.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full px-3.5 py-1.5 text-xs font-semibold transition hover:brightness-95"
                    style={{ backgroundColor: STUDENT_ACCENT_SOFT, color: STUDENT_ACCENT }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </StudentLiftCard>
          ) : null}

          {mode === "student" ? (
            <section className="flex flex-col gap-4 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
                  {recommendedStep.eyebrow}
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--sp-text-strong)]">
                  {recommendedStep.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--sp-muted)]">
                  {recommendedStep.description}
                </p>
                <p className="mt-2 text-xs font-medium text-[var(--sp-muted)]">
                  {recommendedStep.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab(recommendedStep.tab)}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: "var(--sp-accent, #18181B)" }}
              >
                {recommendedStep.action}
                <ChevronRight className="h-4 w-4" />
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "notes" ? (
        notes.length === 0 ? (
          <StudentEmptyState
            title="Notes being prepared"
            description="Your teacher will upload school notes for this topic soon."
          />
        ) : (
          <div className="space-y-3">
            {notes.map((n) => (
              <ContentBlock
                key={n.id}
                icon={FileText}
                tint="bg-[var(--sp-brand-soft-2)] text-[var(--sp-brand-text)]"
                title={n.title}
                body={n.body}
                fileUrl={n.fileUrl}
                embedNotes
                meta={`Uploaded by ${n.uploadedByName || "Teacher"} · ${formatDate(n.updatedAt)}`}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === "practice" ? (
        practice.length === 0 && topic.homework.length === 0 ? (
          <StudentEmptyState
            title="No practice yet"
            description="Practice questions and linked homework will show up here."
          />
        ) : (
          <div className="space-y-3">
            {practice.map((p) => (
              <ContentBlock
                key={p.id}
                icon={Pencil}
                tint="bg-[#FEF3C7] text-[#D97706]"
                title={p.title}
                body={p.body}
              />
            ))}
            {topic.homework.length > 0 ? (
              <StudentLiftCard className="p-5">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-[var(--sp-brand-text)]" />
                  <p className="font-bold text-[#111827]">Homework for this topic</p>
                </div>
                <ul className="mt-3 space-y-2">
                  {topic.homework.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={ctx.sitePath(`student/homework/${h.id}`)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#E8EEF5] bg-[#F8FAFD] px-4 py-3 text-sm transition hover:border-[var(--sp-brand)]/30 hover:bg-[var(--sp-brand-soft)]"
                      >
                        <span className="font-medium text-[#111827]">{h.title}</span>
                        <span className="shrink-0 text-xs text-[#6B7280]">
                          due {formatDate(h.dueAt)} · {h.questionCount} Qs
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </StudentLiftCard>
            ) : null}
          </div>
        )
      ) : null}

      {tab === "revision" ? (
        revision.length === 0 ? (
          <StudentEmptyState
            title="Revision pack coming soon"
            description="Checklists, model answers and previous-paper style questions will appear here."
          />
        ) : (
          <div className="space-y-3">
            {revision.map((r) => (
              <ContentBlock
                key={r.id}
                icon={RefreshCw}
                tint="bg-[#E0E7FF] text-[#4F46E5]"
                title={r.title}
                body={r.body}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === "quiz" ? (
        topicQuizzes.length > 0 ? (
          <div className="space-y-4">
            {topicQuizzes.map((quiz) => (
              <StudentLiftCard key={quiz.id} className="p-5">
                {topicQuizzes.length > 1 ? (
                  <p className="mb-4 text-base font-semibold text-[#111827]">{quiz.title}</p>
                ) : null}
                <StudentQuizPanel quiz={quiz} />
              </StudentLiftCard>
            ))}
          </div>
        ) : (
          <StudentEmptyState
            title="No quiz yet"
            description="Your teacher will publish a topic quiz soon."
          />
        )
      ) : null}

      {tab === "need-help" ? (
        mode === "student" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("notes")}
                className="rounded-full border border-[#E8EEF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#3C4852]"
              >
                Read notes
              </button>
              <button
                type="button"
                onClick={() => setTab("revision")}
                className="rounded-full border border-[#E8EEF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#3C4852]"
              >
                Revision
              </button>
              <button
                type="button"
                onClick={() => setTab("quiz")}
                className="rounded-full border border-[#E8EEF5] bg-white px-3 py-1.5 text-xs font-semibold text-[#3C4852]"
              >
                Topic quiz
              </button>
            </div>
            <StudentAiDoubtChat
              tenant={site.tenant}
              topicId={topic.id}
              topicSlug={topic.slug}
              topicTitle={topic.title}
            />
          </div>
        ) : (
          <StudentLiftCard className="p-5">
            <p className="font-semibold text-[#111827]">Ask a Doubt -student view</p>
            <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
              After you publish Topic Studio notes, students get structured tutoring here:
              school method, marking points, and answer format -not a generic syllabus.
            </p>
          </StudentLiftCard>
        )
      ) : null}

      <div
        className="flex items-start gap-2.5 rounded-2xl px-4 py-3.5 text-sm"
        style={{ backgroundColor: STUDENT_ACCENT_SOFT, color: STUDENT_ACCENT }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This content is created by your school teachers and is aligned to{" "}
          <span className="font-semibold">{ctx.academyName}</span>&apos;s teaching
          methodology and exam pattern.
        </p>
      </div>

      {focusOpen ? (
        <TopicFocusOverlay
          topic={topic}
          diagramFailed={diagramFailed}
          onDiagramError={() => setDiagramFailed(true)}
          onClose={closeFocus}
          ctx={ctx}
          topicHref={topicHref}
        />
      ) : null}
    </div>
  );
}
