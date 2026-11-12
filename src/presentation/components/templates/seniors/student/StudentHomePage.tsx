"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Crosshair,
  Megaphone,
  TrendingUp,
  X,
} from "lucide-react";
import type { SeniorsHomeworkItem, SeniorsStudentDashboardData } from "@/domain/seniors/types";
import type { SiteContext } from "@/application/hooks/use-site-context";
import {
  SeniorsCard,
  SeniorsLinkButton,
  SeniorsProgressRing,
} from "@/presentation/components/templates/seniors/shared/SeniorsUi";
import { SENIORS_GREEN } from "@/presentation/components/templates/seniors/shared/seniors-nav";
import { StudentHeaderActions } from "@/presentation/components/templates/seniors/student/StudentHeaderActions";
import { formatDate } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";
import {
  findCurrentOrNextPeriod,
  isoWeekday,
  weekdayLabel,
} from "@/domain/seniors/timetable-utils";
import {
  dismissSeniorsNotification,
  getDismissedNotificationIds,
  SENIORS_NOTIFICATIONS_CHANGED_EVENT,
} from "@/presentation/components/templates/seniors/shared/seniors-notifications-cache";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function daysUntilDue(dueAt: Date) {
  const due = new Date(dueAt);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function homeworkStatusLabel(hw: SeniorsHomeworkItem) {
  const days = daysUntilDue(hw.dueAt);
  if (hw.status === "overdue" || days < 0) {
    return { text: "Overdue", tone: "danger" as const };
  }
  if (days === 0) {
    return { text: "Due today", tone: "danger" as const };
  }
  if (days === 1) {
    return { text: "Due tomorrow", tone: "warn" as const };
  }
  return { text: `Due in ${days} days`, tone: "muted" as const };
}

function returnedNotifId(homeworkId: string) {
  return `hw-returned-${homeworkId}`;
}

function schoolAnnouncementsNotifId(ids: string[]) {
  return `home-school-announcements:${[...ids].sort().join(",")}`;
}

function teacherAnnouncementsNotifId(ids: string[]) {
  return `home-teacher-announcements:${[...ids].sort().join(",")}`;
}

function DismissButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "absolute right-2.5 top-2.5 rounded-lg p-1.5 text-[var(--sp-muted,#9CA3AF)] transition",
        "hover:bg-[var(--sp-surface-3,#F3F4F6)] hover:text-[var(--sp-text-strong,#374151)]",
        className,
      )}
      aria-label={label}
      title="Dismiss"
      onClick={onClick}
    >
      <X className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sp-accent,#2563EB)] transition hover:gap-2"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function StatusPill({
  text,
  tone,
}: {
  text: string;
  tone: "danger" | "warn" | "muted" | "success";
}) {
  const styles =
    tone === "danger"
      ? "bg-[#FEF2F2] text-[#B91C1C]"
      : tone === "warn"
        ? "bg-[#FFF7ED] text-[#C2410C]"
        : tone === "success"
          ? "bg-[#F0FDF4] text-[#15803D]"
          : "bg-[var(--sp-surface-3,#F3F4F6)] text-[var(--sp-muted,#6B7280)]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        styles,
      )}
    >
      {text}
    </span>
  );
}

function SectionTitle({
  icon,
  iconClassName,
  title,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-[var(--sp-text-strong,#111827)]">
        {title}
      </h3>
    </div>
  );
}

export function StudentHomePage({
  ctx,
  data,
}: {
  ctx: SiteContext;
  data: SeniorsStudentDashboardData;
}) {
  const cl = data.continueLearning;
  const isUrgent = cl.type === "overdue-homework" || cl.type === "exam-revision";
  const firstName = data.studentName.split(" ")[0];
  const returned = data.homeworkReturned ?? [];
  const [dismissedTick, setDismissedTick] = useState(0);
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    const onChanged = () => setDismissedTick((n) => n + 1);
    window.addEventListener(SENIORS_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SENIORS_NOTIFICATIONS_CHANGED_EVENT, onChanged);
  }, []);

  const latestReturned = useMemo(() => {
    void dismissedTick;
    const dismissed = getDismissedNotificationIds(ctx.tenant, "student");
    return returned.find((hw) => !dismissed.has(returnedNotifId(hw.id))) ?? null;
  }, [ctx.tenant, returned, dismissedTick]);

  const visibleReturned = useMemo(() => {
    void dismissedTick;
    const dismissed = getDismissedNotificationIds(ctx.tenant, "student");
    return returned.filter((hw) => !dismissed.has(returnedNotifId(hw.id)));
  }, [ctx.tenant, returned, dismissedTick]);

  // The primary next step stays visible; students should not be able to dismiss it.
  const showContinueLearning = true;

  const schoolAnnouncementIds = useMemo(
    () => data.announcements.map((a) => a.id),
    [data.announcements],
  );
  const teacherAnnouncementIds = useMemo(
    () => data.teacherUpdates.map((a) => a.id),
    [data.teacherUpdates],
  );

  const showSchoolAnnouncements = useMemo(() => {
    void dismissedTick;
    if (schoolAnnouncementIds.length === 0) return false;
    const dismissed = getDismissedNotificationIds(ctx.tenant, "student");
    return !dismissed.has(schoolAnnouncementsNotifId(schoolAnnouncementIds));
  }, [ctx.tenant, schoolAnnouncementIds, dismissedTick]);

  const showTeacherAnnouncements = useMemo(() => {
    void dismissedTick;
    if (teacherAnnouncementIds.length === 0) return false;
    const dismissed = getDismissedNotificationIds(ctx.tenant, "student");
    return !dismissed.has(teacherAnnouncementsNotifId(teacherAnnouncementIds));
  }, [ctx.tenant, teacherAnnouncementIds, dismissedTick]);

  function dismissReturned(homeworkId: string) {
    dismissSeniorsNotification(ctx.tenant, "student", returnedNotifId(homeworkId));
  }

  const dueCount = data.homeworkDue.length;
  const returnedCount = returned.length;
  const timetable = data.timetable ?? {
    className: data.className,
    schoolPeriods: [],
    personalPeriods: [],
    periods: [],
    subjectOptions: [],
    todayDayOfWeek: 1,
  };
  const schoolPeriods = timetable.schoolPeriods ?? timetable.periods ?? [];
  const personalPeriods = timetable.personalPeriods ?? [];
  const { current, next, today: todayPeriods } = useMemo(
    () => findCurrentOrNextPeriod(schoolPeriods),
    [schoolPeriods],
  );
  const personalCount = personalPeriods.filter((p) => !p.isBreak).length;
  const nextExam = data.upcomingExams[0] ?? null;

  return (
    <div className="relative space-y-6 pb-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-40 rounded-3xl opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 10% 0%, color-mix(in srgb, var(--sp-accent, #2563EB) 10%, transparent), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-30 flex items-start justify-between gap-4">
        <div className="min-w-0 animate-[fadeSlideIn_0.45s_ease-out]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-muted,#6B7280)]">
            Student dashboard
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight text-[var(--sp-text-strong,#111827)] sm:text-[1.875rem]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--sp-muted,#6B7280)]">
            <span className="font-medium text-[var(--sp-text,#374151)]">{data.className}</span>
            <span className="mx-1.5 text-[var(--sp-border-2,#D1D5DB)]">·</span>
            {data.schoolName}
          </p>
        </div>
        <div className="relative z-30 animate-[fadeSlideIn_0.45s_ease-out_0.05s_both]">
          <StudentHeaderActions
            ctx={ctx}
            displayName={data.studentName}
            subtitle={`${data.className} • ${data.schoolName}`}
          />
        </div>
      </header>

      {/* The next best learning action comes before dashboard metrics. */}
      {showContinueLearning ? (
        <div
          className="relative flex animate-[fadeSlideIn_0.4s_ease-out] flex-col gap-5 rounded-2xl border px-5 py-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={
            isUrgent
              ? {
                  backgroundColor: "var(--sp-danger-soft, #FEF2F2)",
                  borderColor: "var(--sp-danger-border, #FECACA)",
                }
              : {
                  backgroundColor: "var(--sp-accent-soft, #EFF6FF)",
                  borderColor: "color-mix(in srgb, var(--sp-accent, #2563EB) 28%, white)",
                }
          }
        >
          <div className="flex min-w-0 gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
              style={{
                color: isUrgent ? "var(--sp-danger, #DC2626)" : "var(--sp-accent, #2563EB)",
              }}
            >
              <Crosshair className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
                {isUrgent ? "Priority for today" : "Continue learning"}
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--sp-text-strong)]">{cl.title}</p>
              <p className="mt-0.5 text-sm text-[var(--sp-text)]">{cl.subtitle}</p>
              <p
                className="mt-1 text-sm font-medium"
                style={{ color: isUrgent ? "var(--sp-danger, #DC2626)" : "var(--sp-muted)" }}
              >
                {cl.meta}
              </p>
            </div>
          </div>
          <SeniorsLinkButton
            href={ctx.sitePath(cl.href.replace(`/${ctx.tenant}/`, "").replace(/^\//, ""))}
            variant={isUrgent ? "danger" : "primary"}
          >
            {cl.ctaLabel}
          </SeniorsLinkButton>
        </div>
      ) : null}

      {/* Overview */}
      <section className="relative grid gap-4 lg:grid-cols-2">
        <SeniorsCard pastel="green" className="p-5 transition duration-200 hover:border-[color-mix(in_srgb,var(--sp-accent,#2563EB)_22%,var(--sp-border,#E5E7EB))]">
          <SectionTitle
            icon={<TrendingUp className="h-4 w-4" strokeWidth={2.25} />}
            iconClassName="bg-[#ECFDF5] text-[#059669]"
            title="Progress summary"
          />
          <div className="mt-5 flex items-center gap-5">
            <SeniorsProgressRing
              percent={data.progressSummary.percent}
              size={84}
              stroke={7}
              color={SENIORS_GREEN}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-baseline justify-between gap-3 border-b border-[var(--sp-border,#F3F4F6)] pb-2.5">
                <p className="text-xs font-medium text-[var(--sp-muted,#6B7280)]">
                  Topics completed
                </p>
                <p className="text-sm font-semibold tabular-nums text-[var(--sp-text-strong,#111827)]">
                  {data.progressSummary.topicsCompleted}
                  <span className="font-medium text-[var(--sp-muted,#9CA3AF)]">
                    {" "}
                    / {data.progressSummary.topicsTotal}
                  </span>
                </p>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-medium text-[var(--sp-muted,#6B7280)]">
                  Test average
                </p>
                <p className="text-sm font-semibold tabular-nums text-[var(--sp-text-strong,#111827)]">
                  {data.progressSummary.testAverage}%
                </p>
              </div>
            </div>
          </div>
          <CardLink href={ctx.sitePath("student/progress")}>View full progress</CardLink>
        </SeniorsCard>

        <SeniorsCard pastel="blue" className="p-5 transition duration-200 hover:border-[color-mix(in_srgb,var(--sp-accent,#2563EB)_22%,var(--sp-border,#E5E7EB))]">
          <SectionTitle
            icon={<ClipboardList className="h-4 w-4" strokeWidth={2.25} />}
            iconClassName="bg-[var(--sp-accent-soft,#EFF6FF)] text-[var(--sp-accent,#2563EB)]"
            title="Classwork & homework"
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--sp-border,#E5E7EB)] bg-[var(--sp-page,#F9FAFB)] px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sp-muted,#6B7280)]">
                Due
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
                  dueCount > 0
                    ? "text-[#B91C1C]"
                    : "text-[var(--sp-text-strong,#111827)]",
                )}
              >
                {dueCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--sp-border,#E5E7EB)] bg-[var(--sp-page,#F9FAFB)] px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sp-muted,#6B7280)]">
                Returned
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--sp-text-strong,#111827)]">
                {returnedCount}
              </p>
            </div>
          </div>
          <p className="mt-3.5 text-sm leading-relaxed text-[var(--sp-muted,#6B7280)]">
            {dueCount > 0
              ? `${dueCount} assignment${dueCount === 1 ? "" : "s"} awaiting submission.`
              : "You're clear for now. Open classwork to review past work."}
          </p>
          <CardLink href={ctx.sitePath("student/homework")}>Open classwork</CardLink>
        </SeniorsCard>
      </section>

      <section className="relative grid gap-4 sm:grid-cols-2">
        <Link
          href={ctx.sitePath("student/timetable")}
          className="group block rounded-xl border border-[var(--sp-border,#E5E7EB)] bg-[var(--sp-surface,#fff)] p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--sp-accent,#2563EB)_28%,var(--sp-border,#E5E7EB))] hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-muted,#6B7280)]">
                Timetable
              </p>
              <p className="mt-1 text-base font-semibold tracking-tight text-[var(--sp-text-strong,#111827)]">
                {current
                  ? `Now · ${current.subjectName}`
                  : next
                    ? `Next · ${next.subjectName}`
                    : todayPeriods.length > 0
                      ? weekdayLabel(isoWeekday())
                      : "Set timetable"}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--sp-muted,#6B7280)]">
                {current || next
                  ? `${(current ?? next)!.startTime}–${(current ?? next)!.endTime}`
                  : personalCount > 0
                    ? `${personalCount} personal slots`
                    : "School + personal calendar"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sp-accent-soft,#EFF6FF)] text-[var(--sp-accent,#2563EB)] transition group-hover:scale-105">
              <CalendarDays className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--sp-accent,#2563EB)]">
            Set timetable →
          </p>
        </Link>

        <Link
          href={ctx.sitePath("student/exam-prep")}
          className="group block rounded-xl border border-[var(--sp-border,#E5E7EB)] bg-[var(--sp-surface,#fff)] p-4 shadow-sm transition hover:border-[color-mix(in_srgb,var(--sp-accent,#2563EB)_28%,var(--sp-border,#E5E7EB))] hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sp-muted,#6B7280)]">
                Exams
              </p>
              <p className="mt-1 truncate text-base font-semibold tracking-tight text-[var(--sp-text-strong,#111827)]">
                {nextExam ? nextExam.title : "No exams soon"}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--sp-muted,#6B7280)]">
                {nextExam
                  ? `${formatDate(nextExam.examAt)} · ${nextExam.daysLeft} day${nextExam.daysLeft === 1 ? "" : "s"} left`
                  : data.upcomingExams.length > 0
                    ? `${data.upcomingExams.length} upcoming`
                    : "View exam prep"}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#EA580C] transition group-hover:scale-105">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-[var(--sp-accent,#2563EB)]">
            {data.upcomingExams.length > 0
              ? `${data.upcomingExams.length} upcoming →`
              : "Open exam prep →"}
          </p>
        </Link>
      </section>

      {latestReturned ? (
        <div
          className="relative flex flex-col gap-3 rounded-xl border px-4 py-4 pr-11 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          style={{
            backgroundColor: "var(--sp-success-soft, #F0FDF4)",
            borderColor: "var(--sp-success-border, #BBF7D0)",
          }}
        >
          <DismissButton
            label="Dismiss notification"
            onClick={() => dismissReturned(latestReturned.id)}
            className="text-[var(--sp-success,#166534)]/70 hover:bg-white/70 hover:text-[var(--sp-success,#166534)]"
          />
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#16A34A] shadow-sm">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--sp-success, #166534)" }}>
                Homework returned
              </p>
              <p className="mt-0.5 text-sm" style={{ color: "var(--sp-success, #15803D)" }}>
                {latestReturned.subjectName}: {latestReturned.title}
                {latestReturned.score != null ? ` · Score ${latestReturned.score}` : ""}
              </p>
              {latestReturned.feedback?.trim() ? (
                <p
                  className="mt-1 line-clamp-2 text-xs"
                  style={{ color: "var(--sp-success, #166534)" }}
                >
                  Teacher: {latestReturned.feedback.trim()}
                </p>
              ) : null}
            </div>
          </div>
          <SeniorsLinkButton
            href={ctx.sitePath(`student/homework/${latestReturned.id}`)}
            variant="primary"
          >
            View feedback
          </SeniorsLinkButton>
        </div>
      ) : null}

      {(visibleReturned.length > 0 || dueCount > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          {visibleReturned.length > 0 ? (
            <SeniorsCard className="relative p-5 pr-11">
              <DismissButton
                label="Dismiss returned homework"
                onClick={() => {
                  for (const hw of visibleReturned) dismissReturned(hw.id);
                }}
              />
              <SectionTitle
                icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />}
                iconClassName="bg-[#ECFDF5] text-[#059669]"
                title={`Returned (${visibleReturned.length})`}
              />
              <ul className="mt-4 divide-y divide-[var(--sp-border,#F3F4F6)]">
                {visibleReturned.slice(0, 3).map((hw) => (
                  <li key={`returned-${hw.id}`} className="group flex items-center gap-2 py-3 first:pt-0 last:pb-0">
                    <Link
                      href={ctx.sitePath(`student/homework/${hw.id}`)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg transition hover:bg-[var(--sp-page,#F9FAFB)]"
                    >
                      <div className="min-w-0 py-0.5">
                        <p className="truncate text-sm font-semibold text-[var(--sp-text-strong,#111827)]">
                          {hw.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--sp-muted,#6B7280)]">
                          {hw.subjectName}
                          {hw.feedback?.trim() ? ` · ${hw.feedback.trim()}` : ""}
                        </p>
                      </div>
                      <StatusPill
                        text={hw.score != null ? `Score ${hw.score}` : "Returned"}
                        tone="success"
                      />
                    </Link>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg p-1.5 text-[var(--sp-muted,#9CA3AF)] opacity-0 transition hover:bg-[var(--sp-surface-3,#F3F4F6)] hover:text-[var(--sp-text-strong,#374151)] group-hover:opacity-100"
                      aria-label={`Dismiss ${hw.title}`}
                      title="Dismiss"
                      onClick={() => dismissReturned(hw.id)}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                  </li>
                ))}
              </ul>
              <CardLink href={ctx.sitePath("student/homework")}>View all classwork</CardLink>
            </SeniorsCard>
          ) : null}

          {dueCount > 0 ? (
            <SeniorsCard pastel="orange" className="p-5">
              <SectionTitle
                icon={<BookOpen className="h-4 w-4" strokeWidth={2.25} />}
                iconClassName="bg-[#FFF7ED] text-[#EA580C]"
                title={`Due soon (${dueCount})`}
              />
              <ul className="mt-4 divide-y divide-[var(--sp-border,#F3F4F6)]">
                {data.homeworkDue.slice(0, 3).map((hw) => {
                  const st = homeworkStatusLabel(hw);
                  return (
                    <li key={hw.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={ctx.sitePath(`student/homework/${hw.id}`)}
                        className="-mx-1.5 flex items-center justify-between gap-3 rounded-lg px-1.5 py-0.5 transition hover:bg-[var(--sp-page,#F9FAFB)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--sp-text-strong,#111827)]">
                            {hw.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-[var(--sp-muted,#6B7280)]">
                            {hw.subjectName}
                            {hw.chapterName ? ` · ${hw.chapterName}` : ""}
                          </p>
                        </div>
                        <StatusPill text={st.text} tone={st.tone} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <CardLink href={ctx.sitePath("student/homework")}>View all homework</CardLink>
            </SeniorsCard>
          ) : null}
        </section>
      )}

      {showSchoolAnnouncements || showTeacherAnnouncements ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {showSchoolAnnouncements ? (
            <SeniorsCard pastel="pink" className="relative p-5 pr-11">
              <DismissButton
                label="Dismiss school announcements"
                onClick={() => {
                  dismissSeniorsNotification(
                    ctx.tenant,
                    "student",
                    schoolAnnouncementsNotifId(schoolAnnouncementIds),
                  );
                }}
              />
              <SectionTitle
                icon={<Megaphone className="h-4 w-4" strokeWidth={2.25} />}
                iconClassName="bg-[#FDF2F8] text-[#DB2777]"
                title="School announcements"
              />
              <ul className="mt-4 space-y-3.5">
                {data.announcements.slice(0, 3).map((a) => (
                  <li
                    key={a.id}
                    className="border-l-2 border-[color-mix(in_srgb,#DB2777_35%,transparent)] pl-3 text-sm leading-relaxed text-[var(--sp-text,#4B5563)]"
                  >
                    <span className="font-semibold text-[var(--sp-text-strong,#111827)]">
                      {a.title}
                    </span>
                    {a.body?.trim() ? (
                      <>
                        {" -"}
                        {a.body.trim()}
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              <CardLink href={ctx.sitePath("student/school")}>View all announcements</CardLink>
            </SeniorsCard>
          ) : null}

          {showTeacherAnnouncements ? (
            <SeniorsCard pastel="cyan" className="relative p-5 pr-11">
              <DismissButton
                label="Dismiss teacher announcements"
                onClick={() => {
                  dismissSeniorsNotification(
                    ctx.tenant,
                    "student",
                    teacherAnnouncementsNotifId(teacherAnnouncementIds),
                  );
                }}
              />
              <SectionTitle
                icon={<Megaphone className="h-4 w-4" strokeWidth={2.25} />}
                iconClassName="bg-[var(--sp-accent-soft,#EFF6FF)] text-[var(--sp-accent,#2563EB)]"
                title="Teacher announcements"
              />
              <ul className="mt-4 space-y-3.5">
                {data.teacherUpdates.slice(0, 3).map((a) => (
                  <li
                    key={a.id}
                    className="border-l-2 border-[color-mix(in_srgb,var(--sp-accent,#2563EB)_35%,transparent)] pl-3 text-sm leading-relaxed text-[var(--sp-text,#4B5563)]"
                  >
                    <span className="font-semibold text-[var(--sp-text-strong,#111827)]">
                      {a.title}
                    </span>
                    {a.body?.trim() ? (
                      <>
                        {" -"}
                        {a.body.trim()}
                      </>
                    ) : null}
                    {a.teacherName ? (
                      <span className="mt-1 block text-xs font-medium text-[var(--sp-muted,#9CA3AF)]">
                        {a.teacherName}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <CardLink href={ctx.sitePath("student/school")}>View all announcements</CardLink>
            </SeniorsCard>
          ) : null}
        </section>
      ) : null}

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
