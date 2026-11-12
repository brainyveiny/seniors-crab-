"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Atom,
  BookOpen,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Globe2,
  Info,
  Languages,
  Search,
} from "lucide-react";
import type { SiteContext } from "@/application/hooks/use-site-context";
import type {
  SeniorsChapterSummary,
  SeniorsSubjectSummary,
} from "@/domain/seniors/types";
import { SeniorsProgressRing } from "@/presentation/components/templates/seniors/shared/SeniorsUi";
import { StudentHeaderActions } from "@/presentation/components/templates/seniors/student/StudentHeaderActions";
import { pingSeniorsGamification } from "@/presentation/components/templates/seniors/gamification/ping-seniors-gamification";
import { prefetchStudentTopic } from "@/presentation/components/templates/seniors/shared/useSeniorsCachedJson";
import { cn } from "@/shared/lib/utils";

const ACCENT = "var(--sp-accent, #1a4696)";
const ACCENT_SOFT = "var(--sp-accent-soft, #E8F0FE)";

export type StudentLearnMeta = {
  fullName: string;
  className: string;
  sectionName: string;
  board: string;
  academicYear: string;
};

function subjectVisual(name: string): {
  Icon: typeof BookOpen;
  bg: string;
  fg: string;
} {
  const n = name.toLowerCase();
  if (n.includes("math") || n.includes("maths")) {
    return { Icon: Calculator, bg: "bg-[var(--sp-brand-soft-2)]", fg: "text-[var(--sp-brand-text)]" };
  }
  if (n.includes("science") || n.includes("chem") || n.includes("bio") || n.includes("phy")) {
    return { Icon: FlaskConical, bg: "bg-[#DCFCE7]", fg: "text-[#16A34A]" };
  }
  if (n.includes("english") || n.includes("hindi") || n.includes("language")) {
    return { Icon: Languages, bg: "bg-[#FEF3C7]", fg: "text-[#D97706]" };
  }
  if (n.includes("social") || n.includes("history") || n.includes("geo") || n.includes("civics")) {
    return { Icon: Globe2, bg: "bg-[#E0E7FF]", fg: "text-[#4F46E5]" };
  }
  if (n.includes("computer") || n.includes("it")) {
    return { Icon: Atom, bg: "bg-[#F3E8FF]", fg: "text-[#9333EA]" };
  }
  return { Icon: BookOpen, bg: "bg-[var(--sp-brand-soft)]", fg: "text-[var(--sp-brand-text)]" };
}

function chapterStatus(ch: SeniorsChapterSummary, selected: boolean) {
  if (ch.topicCount > 0 && ch.completedCount >= ch.topicCount) return "done" as const;
  if (selected) return "current" as const;
  if (ch.completedCount > 0) return "current" as const;
  return "todo" as const;
}

function ChapterStatusIcon({
  status,
}: {
  status: "done" | "current" | "todo";
}) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A] text-white">
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white"
        style={{ borderColor: ACCENT }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-[#CBD5E1] bg-white" />
  );
}

function TopicStatusRight({
  progressPercent,
}: {
  progressPercent: number;
}) {
  if (progressPercent >= 100) {
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
      >
        <ChevronRight className="h-4 w-4" />
      </span>
    );
  }
  if (progressPercent > 0) {
    return (
      <SeniorsProgressRing
        percent={progressPercent}
        size={36}
        stroke={3.5}
        color={ACCENT}
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8FAFC]" />
  );
}

export function StudentLearnPage({
  ctx,
  subjects,
  student,
}: {
  ctx: SiteContext;
  subjects: SeniorsSubjectSummary[];
  student: StudentLearnMeta;
}) {
  const resumeTarget = useMemo(() => {
    const curriculumTopics = subjects.flatMap((subject) =>
      subject.chapters.flatMap((chapter) =>
        chapter.topics.map((topic) => ({
          ...topic,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterId: chapter.id,
          chapterName: chapter.name,
        })),
      ),
    );

    return (
      curriculumTopics.find(
        (topic) => topic.progressPercent > 0 && topic.progressPercent < 100,
      ) ??
      curriculumTopics.find((topic) => topic.progressPercent < 100) ??
      curriculumTopics[0] ??
      null
    );
  }, [subjects]);

  const [selectedSubjectId, setSelectedSubjectId] = useState(
    resumeTarget?.subjectId ?? subjects[0]?.id ?? "",
  );
  const [selectedChapterId, setSelectedChapterId] = useState(
    resumeTarget?.chapterId ?? subjects[0]?.chapters[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [chapterOverviewOpen, setChapterOverviewOpen] = useState(false);

  useEffect(() => {
    setChapterOverviewOpen(false);
  }, [selectedChapterId]);

  useEffect(() => {
    void pingSeniorsGamification(ctx.tenant, "learn");
  }, [ctx.tenant]);

  const subject = subjects.find((s) => s.id === selectedSubjectId) ?? subjects[0];
  const chapter =
    subject?.chapters.find((c) => c.id === selectedChapterId) ?? subject?.chapters[0];

  useEffect(() => {
    if (!ctx.tenant || !chapter?.topics.length) return;
    // Warm the first topics so the next click opens from cache.
    for (const topic of chapter.topics.slice(0, 6)) {
      prefetchStudentTopic(ctx.tenant, topic.slug);
    }
  }, [ctx.tenant, chapter?.id, chapter?.topics]);

  function warmTopic(slug: string) {
    prefetchStudentTopic(ctx.tenant, slug);
  }

  const totalTopicsInSubject =
    subject?.chapters.reduce((n, c) => n + c.topicCount, 0) ?? 0;

  const filteredChapters = useMemo(() => {
    if (!subject) return [];
    const q = query.trim().toLowerCase();
    if (!q) return subject.chapters;
    return subject.chapters.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.topics.some(
          (t) =>
            t.title.toLowerCase().includes(q) || t.number.toLowerCase().includes(q),
        ),
    );
  }, [subject, query]);

  const visibleChapters = showAllChapters
    ? filteredChapters
    : filteredChapters.slice(0, 8);

  const filteredTopics = useMemo(() => {
    if (!chapter) return [];
    const q = query.trim().toLowerCase();
    if (!q) return chapter.topics;
    return chapter.topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.number.toLowerCase().includes(q) ||
        chapter.name.toLowerCase().includes(q),
    );
  }, [chapter, query]);

  const chapterProgressPercent =
    chapter && chapter.topicCount > 0
      ? Math.round((chapter.completedCount / chapter.topicCount) * 100)
      : 0;

  const continueTopic = useMemo(() => {
    if (!chapter) return null;
    const inProgress = chapter.topics.find(
      (t) => t.progressPercent > 0 && t.progressPercent < 100,
    );
    if (inProgress) return inProgress;
    const notStarted = chapter.topics.find((t) => t.progressPercent < 100);
    return notStarted ?? chapter.topics[0] ?? null;
  }, [chapter]);

  const classLabel = `${student.className} - ${student.board}`;
  const yearLabel = `Academic Year ${student.academicYear}`;

  return (
    <div className="flex h-full min-h-[calc(100vh-2rem)] flex-col gap-4">
      {/* Header -matches mockup */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#0F172A]">Learn</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Explore your syllabus and start learning
          </p>
        </div>
        <StudentHeaderActions
          ctx={ctx}
          displayName={student.fullName}
          subtitle={`${student.className} • Section ${student.sectionName}`}
          variant="chip"
        />
      </div>

      {resumeTarget ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
              {resumeTarget.progressPercent > 0 && resumeTarget.progressPercent < 100
                ? "Pick up where you left off"
                : resumeTarget.progressPercent >= 100
                  ? "Ready for a review"
                  : "Your next topic"}
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--sp-text-strong)]">
              {resumeTarget.number} {resumeTarget.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--sp-muted)]">
              {resumeTarget.subjectName} · {resumeTarget.chapterName}
              {resumeTarget.progressPercent > 0 && resumeTarget.progressPercent < 100
                ? ` · ${resumeTarget.progressPercent}% complete`
                : ""}
            </p>
          </div>
          <Link
            href={ctx.sitePath(`student/learn/${resumeTarget.slug}`)}
            onMouseEnter={() => warmTopic(resumeTarget.slug)}
            onTouchStart={() => warmTopic(resumeTarget.slug)}
            onFocus={() => warmTopic(resumeTarget.slug)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: ACCENT }}
          >
            {resumeTarget.progressPercent > 0 && resumeTarget.progressPercent < 100
              ? "Continue topic"
              : resumeTarget.progressPercent >= 100
                ? "Review topic"
                : "Start topic"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm">
            <BookOpen className="h-4 w-4 text-[#64748B]" />
            <span className="font-medium">{classLabel}</span>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#0F172A] shadow-sm">
            <CalendarDays className="h-4 w-4 text-[#64748B]" />
            <span className="font-medium">{yearLabel}</span>
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" />
          </div>
        </div>
        <label className="relative block w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subjects, chapters or topics..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] shadow-sm outline-none focus:border-[var(--sp-brand)] focus:ring-2 focus:ring-[var(--sp-brand)]/15"
          />
        </label>
      </div>

      {/* Three panes */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm lg:grid-cols-[minmax(220px,0.9fr)_minmax(280px,1.1fr)_minmax(280px,1.15fr)]">
        {/* Subjects */}
        <div className="flex min-h-0 flex-col border-b border-[#E5E7EB] lg:border-b-0 lg:border-r">
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <p className="text-sm font-bold text-[#0F172A]">Subjects</p>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {subjects.length === 0 ? (
              <li className="px-2 py-6 text-center text-sm text-[#64748B]">
                No subjects yet
              </li>
            ) : (
              subjects.map((s) => {
                const { Icon, bg, fg } = subjectVisual(s.name);
                const selected = selectedSubjectId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(s.id);
                        setSelectedChapterId(s.chapters[0]?.id ?? "");
                        setShowAllChapters(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition",
                        selected
                          ? "border-[var(--sp-brand)] bg-[var(--sp-brand-soft)] shadow-sm"
                          : "border-transparent bg-white hover:bg-[#F8FAFC]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          bg,
                          fg,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#0F172A]">
                          {s.name}
                        </span>
                        <span className="block text-xs text-[#64748B]">
                          {s.chapters.length} Chapter{s.chapters.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        {/* Chapters */}
        <div className="flex min-h-0 flex-col border-b border-[#E5E7EB] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2.5 border-b border-[#F1F5F9] px-4 py-3">
            {subject ? (
              (() => {
                const { Icon, bg, fg } = subjectVisual(subject.name);
                return (
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      bg,
                      fg,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })()
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0F172A]">
                {subject?.name ?? "Chapters"}
              </p>
              <p className="text-xs text-[#64748B]">
                {subject?.chapters.length ?? 0} Chapters • {totalTopicsInSubject} Topics
              </p>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {visibleChapters.map((ch) => {
              const selected = selectedChapterId === ch.id;
              const status = chapterStatus(ch, selected);
              return (
                <li key={ch.id} className="border-b border-[#F8FAFC] last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelectedChapterId(ch.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition",
                      selected ? "bg-[var(--sp-brand-soft)]" : "hover:bg-[#F8FAFC]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        selected
                          ? "text-white"
                          : "bg-[#F1F5F9] text-[#64748B]",
                      )}
                      style={selected ? { backgroundColor: ACCENT } : undefined}
                    >
                      {ch.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm font-medium",
                          selected ? "text-[var(--sp-brand-text)]" : "text-[#0F172A]",
                        )}
                      >
                        {ch.name}
                      </span>
                      <span className="block text-xs text-[#64748B]">
                        {ch.topicCount} topic{ch.topicCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    <ChapterStatusIcon status={status} />
                  </button>
                </li>
              );
            })}
            {filteredChapters.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#64748B]">
                No chapters match your search
              </li>
            ) : null}
          </ul>
          {filteredChapters.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAllChapters((v) => !v)}
              className="flex items-center justify-center gap-1 border-t border-[#F1F5F9] px-4 py-3 text-sm font-semibold"
              style={{ color: ACCENT }}
            >
              {showAllChapters
                ? "Show fewer chapters"
                : `View all ${filteredChapters.length} chapters`}
              <ChevronDown
                className={cn("h-4 w-4 transition", showAllChapters && "rotate-180")}
              />
            </button>
          ) : null}
        </div>

        {/* Topics / Chapter overview */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
            <div>
              <p className="text-sm font-bold text-[#0F172A]">
                {chapterOverviewOpen ? "Chapter Overview" : "Topics in Selected Chapter"}
              </p>
              <p className="text-xs text-[#64748B]">
                {chapterOverviewOpen
                  ? chapter
                    ? `Chapter ${chapter.number} · ${chapter.name}`
                    : "Select a chapter"
                  : `${filteredTopics.length} Topic${filteredTopics.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>

          {chapterOverviewOpen && chapter ? (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <div className="flex items-center gap-4">
                  <SeniorsProgressRing
                    percent={chapterProgressPercent}
                    size={72}
                    stroke={6}
                    color={ACCENT}
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                      {subject?.name}
                    </p>
                    <p className="mt-1 text-base font-bold text-[#0F172A]">
                      Chapter {chapter.number}: {chapter.name}
                    </p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {chapter.completedCount} of {chapter.topicCount} topics completed
                    </p>
                  </div>
                </div>
              </div>

              {continueTopic ? (
                <Link
                  href={ctx.sitePath(`student/learn/${continueTopic.slug}`)}
                  onMouseEnter={() => warmTopic(continueTopic.slug)}
                  onTouchStart={() => warmTopic(continueTopic.slug)}
                  onFocus={() => warmTopic(continueTopic.slug)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
                  style={{ backgroundColor: ACCENT }}
                >
                  {continueTopic.progressPercent > 0 && continueTopic.progressPercent < 100
                    ? "Continue learning"
                    : continueTopic.progressPercent >= 100
                      ? "Review chapter"
                      : "Start chapter"}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : null}

              <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                All topics in this chapter
              </p>
              <ul className="mt-2 space-y-1">
                {chapter.topics.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      href={ctx.sitePath(`student/learn/${topic.slug}`)}
                      onMouseEnter={() => warmTopic(topic.slug)}
                      onTouchStart={() => warmTopic(topic.slug)}
                      onFocus={() => warmTopic(topic.slug)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-[#F8FAFC]"
                    >
                      <span className="w-8 shrink-0 text-xs font-semibold text-[#64748B]">
                        {topic.number}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium text-[#0F172A]">
                        {topic.title}
                      </span>
                      {topic.progressPercent >= 100 ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A] text-white">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : topic.progressPercent > 0 ? (
                        <SeniorsProgressRing
                          percent={topic.progressPercent}
                          size={28}
                          stroke={3}
                          color={ACCENT}
                        />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-[#CBD5E1]" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
          <ul className="flex-1 overflow-y-auto">
            {filteredTopics.map((topic) => (
              <li key={topic.id} className="border-b border-[#F8FAFC] last:border-0">
                <Link
                  href={ctx.sitePath(`student/learn/${topic.slug}`)}
                  onMouseEnter={() => warmTopic(topic.slug)}
                  onTouchStart={() => warmTopic(topic.slug)}
                  onFocus={() => warmTopic(topic.slug)}
                  className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#F8FAFC]"
                >
                  <span className="w-8 shrink-0 text-xs font-semibold text-[#64748B]">
                    {topic.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#0F172A]">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                      {topic.progressPercent > 0 && topic.progressPercent < 100 ? (
                        <span className="font-medium" style={{ color: ACCENT }}>
                          In progress
                        </span>
                      ) : topic.progressPercent >= 100 ? (
                        <span className="font-medium text-[#16A34A]">Completed</span>
                      ) : topic.hasNotes ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
                          <span className="text-[#16A34A]">Notes available</span>
                        </>
                      ) : (
                        <span className="text-[#94A3B8]">Not started</span>
                      )}
                    </span>
                  </span>
                  <TopicStatusRight progressPercent={topic.progressPercent} />
                </Link>
              </li>
            ))}
            {!chapter || filteredTopics.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#64748B]">
                {chapter ? "No topics match your search" : "Select a chapter"}
              </li>
            ) : null}
          </ul>
          )}
          {chapter ? (
            <div className="border-t border-[#F1F5F9] px-4 py-3">
              <button
                type="button"
                onClick={() => setChapterOverviewOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: ACCENT }}
              >
                {chapterOverviewOpen ? "Back to topic list" : "View chapter overview"}
                <ChevronRight
                  className={cn("h-4 w-4 transition", chapterOverviewOpen && "rotate-180")}
                />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Info bar */}
      <div
        className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
        style={{
          backgroundColor: ACCENT_SOFT,
          borderColor: "var(--sp-brand-border)",
          color: "var(--sp-brand-text)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Select a topic to start learning. You can access notes, practice questions,
          worksheets, quizzes and more on the topic page.
        </p>
      </div>
    </div>
  );
}
