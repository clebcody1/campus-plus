"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, RotateCcw, Target, Calculator,
  TrendingUp, AlertTriangle, CheckCircle2, Info,
} from "lucide-react";

/* ------------------------------------------------------------------
   Grading scales.
 
   Most Nigerian universities grade out of 5.00, but a number of private
   ones and a few others use 4.00, where a First Class starts at 3.50
   rather than 4.50. The two are not convertible by arithmetic: the 4.00
   scale has no E grade at all, and D covers a different range.
 
   So the student picks. Guessing their school's scale from a list I
   cannot verify would produce a number that quietly disagrees with their
   portal, and students make real decisions on that number.
 
   The 5.00 scale below is confirmed against sta.lautech.edu.ng.
------------------------------------------------------------------- */

type ScaleId = "5" | "4";

type Grade = { letter: string; points: number; range: string };
type DegreeClass = { name: string; short: string; min: number };

type Scale = {
  id: ScaleId;
  max: number;
  label: string;
  grades: Grade[];
  classes: DegreeClass[];
};

const SCALES: Record<ScaleId, Scale> = {
  "5": {
    id: "5",
    max: 5,
    label: "Nigerian 5 point scale",
    grades: [
      { letter: "A", points: 5, range: "70 - 100" },
      { letter: "B", points: 4, range: "60 - 69" },
      { letter: "C", points: 3, range: "50 - 59" },
      { letter: "D", points: 2, range: "45 - 49" },
      { letter: "E", points: 1, range: "40 - 44" },
      { letter: "F", points: 0, range: "Below 40" },
    ],
    classes: [
      { name: "First Class", short: "First Class", min: 4.5 },
      { name: "Second Class Upper", short: "2:1", min: 3.5 },
      { name: "Second Class Lower", short: "2:2", min: 2.4 },
      { name: "Third Class", short: "Third Class", min: 1.5 },
      { name: "Pass", short: "Pass", min: 1.0 },
    ],
  },
  "4": {
    id: "4",
    max: 4,
    label: "Nigerian 4 point scale",
    grades: [
      { letter: "A", points: 4, range: "70 - 100" },
      { letter: "B", points: 3, range: "60 - 69" },
      { letter: "C", points: 2, range: "50 - 59" },
      { letter: "D", points: 1, range: "45 - 49" },
      { letter: "F", points: 0, range: "Below 45" },
    ],
    classes: [
      { name: "First Class", short: "First Class", min: 3.5 },
      { name: "Second Class Upper", short: "2:1", min: 3.0 },
      { name: "Second Class Lower", short: "2:2", min: 2.0 },
      { name: "Third Class", short: "Third Class", min: 1.0 },
    ],
  },
};

const pointsFor = (scale: Scale, letter: string) =>
  scale.grades.find((g) => g.letter === letter)?.points ?? 0;

function classFor(scale: Scale, cgpa: number) {
  return scale.classes.find((c) => cgpa >= c.min)?.name ?? "Below Pass";
}

/**
 * Someone typing 201 almost certainly means 2.01, and 342 means 3.42.
 * Shifting the decimal point is by far the most common slip on this field,
 * so guess at it rather than just saying "wrong".
 */
function decimalHint(value: number, max: number) {
  if (!Number.isFinite(value) || value <= max || value >= 1000) return "";
  const digits = String(Math.trunc(value)).length;
  const guess = value / Math.pow(10, digits - 1);
  return guess > 0 && guess <= max ? ` Did you mean ${guess.toFixed(2)}?` : "";
}

/**
 * Turns a required GPA into something a student can picture.
 * Expressed as a share of the maximum, so it reads correctly on either scale.
 */
function describeEffort(gpa: number, max: number) {
  const share = gpa / max;
  if (share >= 0.95) return "That is almost straight A's.";
  if (share >= 0.9) return "That is mostly A's with maybe one B.";
  if (share >= 0.8) return "That is an A and B mix, leaning towards A.";
  if (share >= 0.7) return "That is a solid B average.";
  if (share >= 0.6) return "That is a B and C average.";
  if (share >= 0.4) return "C's across the board will get you there.";
  return "You mainly need to pass everything.";
}

const UNIT_OPTIONS = [1, 2, 3, 4, 5, 6];
const STORAGE_KEY = "campus_plus_gpa";

type Course = {
  id: string;
  code: string;
  units: number;
  grade: string | null;
};

type TargetState =
  | { state: "empty" }
  | { state: "error"; message: string }
  | {
      state: "ok";
      goal: number;
      requiredGpa: number;
      maxReachable: number;
      alreadySafe: boolean;
      impossible: boolean;
    };

/* Fixed ids so the server render and the first client render match.
   Random ids here would cause a hydration mismatch. */
const BLANK_COURSES: Course[] = [
  { id: "r1", code: "", units: 3, grade: null },
  { id: "r2", code: "", units: 3, grade: null },
  { id: "r3", code: "", units: 3, grade: null },
];

let rowCounter = 0;
const nextRowId = () => `c${Date.now()}${rowCounter++}`;

export default function GpaCalculatorPage() {
  const [tab, setTab] = useState<"semester" | "target">("semester");

  const [scaleId, setScaleId] = useState<ScaleId>("5");
  const scale = SCALES[scaleId];

  const [courses, setCourses] = useState<Course[]>(BLANK_COURSES);

  // Optional previous standing, so the semester tab can also roll a CGPA.
  const [prevCgpa, setPrevCgpa] = useState("");
  const [prevUnits, setPrevUnits] = useState("");

  // Target tab inputs.
  const [tCgpa, setTCgpa] = useState("");
  const [tDone, setTDone] = useState("");
  const [tNext, setTNext] = useState("");
  const [tTarget, setTTarget] = useState("3.50");

  const [loaded, setLoaded] = useState(false);

  /* ---------- persistence (per device, no backend) ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.scale === "4" || saved.scale === "5") setScaleId(saved.scale);
        if (Array.isArray(saved.courses) && saved.courses.length) {
          setCourses(saved.courses);
        }
        if (typeof saved.prevCgpa === "string") setPrevCgpa(saved.prevCgpa);
        if (typeof saved.prevUnits === "string") setPrevUnits(saved.prevUnits);
        if (typeof saved.tCgpa === "string") setTCgpa(saved.tCgpa);
        if (typeof saved.tDone === "string") setTDone(saved.tDone);
        if (typeof saved.tNext === "string") setTNext(saved.tNext);
        if (typeof saved.tTarget === "string") setTTarget(saved.tTarget);
      }
    } catch {
      // Private mode or blocked storage. The page still works, it just
      // will not remember anything.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          scale: scaleId, courses, prevCgpa, prevUnits, tCgpa, tDone, tNext, tTarget,
        })
      );
    } catch {
      // Ignore. Nothing here is worth interrupting the user over.
    }
  }, [loaded, scaleId, courses, prevCgpa, prevUnits, tCgpa, tDone, tNext, tTarget]);

  /* ---------- switching scale ---------- */

  const changeScale = useCallback((id: ScaleId) => {
    setScaleId((current) => {
      if (current === id) return current;

      const next = SCALES[id];
      const allowed = new Set(next.grades.map((g) => g.letter));

      /*
       | An E picked on the 5 point scale does not exist on the 4 point one.
       | Left alone it would silently score zero, which is the worst kind of
       | wrong: quiet and plausible. Clear those rows instead.
       */
      setCourses((rows) =>
        rows.map((row) =>
          row.grade && !allowed.has(row.grade) ? { ...row, grade: null } : row
        )
      );

      // A 4.20 CGPA is impossible out of 4.00. Anything still in range is
      // left alone, so switching back and forth does not wipe your work.
      setPrevCgpa((value) => (parseFloat(value) > next.max ? "" : value));
      setTCgpa((value) => (parseFloat(value) > next.max ? "" : value));

      // Re-aim at the equivalent target on the new scale.
      setTTarget(next.classes[1].min.toFixed(2));

      return id;
    });
  }, []);

  /* ---------- row editing ---------- */

  const updateCourse = useCallback(
    (id: string, patch: Partial<Course>) => {
      setCourses((rows) =>
        rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const addCourse = useCallback(() => {
    setCourses((rows) => [
      ...rows,
      { id: nextRowId(), code: "", units: 3, grade: null },
    ]);
  }, []);

  const removeCourse = useCallback((id: string) => {
    setCourses((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.id !== id)
    );
  }, []);

  const resetAll = useCallback(() => {
    setCourses(BLANK_COURSES.map((row) => ({ ...row, id: nextRowId() })));
    setPrevCgpa("");
    setPrevUnits("");
  }, []);

  /* ---------- semester maths ---------- */

  const semester = useMemo(() => {
    const scored = courses.filter((c) => c.grade !== null);
    const units = scored.reduce((sum, c) => sum + c.units, 0);
    const qualityPoints = scored.reduce(
      (sum, c) => sum + c.units * pointsFor(scale, c.grade as string),
      0
    );

    return {
      counted: scored.length,
      units,
      qualityPoints,
      gpa: units > 0 ? qualityPoints / units : null,
    };
  }, [courses, scale]);

  /* A plain-language reason when the previous standing cannot be used.
     Empty string means nothing is wrong. */
  const prevError = useMemo(() => {
    const cgpaTyped = prevCgpa.trim();
    const unitsTyped = prevUnits.trim();

    if (!cgpaTyped && !unitsTyped) return "";

    const pc = parseFloat(cgpaTyped);
    const pu = parseInt(unitsTyped, 10);

    if (!cgpaTyped || Number.isNaN(pc)) return "Enter your current CGPA.";
    if (pc < 0 || pc > scale.max) {
      return `A CGPA is between 0.00 and ${scale.max.toFixed(2)}.${decimalHint(pc, scale.max)}`;
    }
    if (!unitsTyped || Number.isNaN(pu)) {
      return "Enter how many units you have done so far.";
    }
    if (pu <= 0) return "Units so far must be more than 0.";

    return "";
  }, [prevCgpa, prevUnits, scale]);

  const cumulative = useMemo(() => {
    if (prevError) return null;
    if (!prevCgpa.trim() || !prevUnits.trim()) return null;
    if (semester.units === 0) return null;

    const pc = parseFloat(prevCgpa);
    const pu = parseInt(prevUnits, 10);

    const totalUnits = pu + semester.units;
    const totalPoints = pc * pu + semester.qualityPoints;

    return { cgpa: totalPoints / totalUnits, totalUnits };
  }, [prevError, prevCgpa, prevUnits, semester]);

  /* ---------- target maths ---------- */

  const target = useMemo<TargetState>(() => {
    const cgpaTyped = tCgpa.trim();
    const doneTyped = tDone.trim();
    const nextTyped = tNext.trim();

    if (!cgpaTyped && !doneTyped && !nextTyped) return { state: "empty" };

    const curr = parseFloat(cgpaTyped);
    const done = parseInt(doneTyped, 10);
    const next = parseInt(nextTyped, 10);
    const goal = parseFloat(tTarget);

    if (!cgpaTyped || Number.isNaN(curr)) {
      return { state: "error", message: "Enter your current CGPA." };
    }
    if (curr < 0 || curr > scale.max) {
      return {
        state: "error",
        message: `A CGPA is between 0.00 and ${scale.max.toFixed(2)}.${decimalHint(curr, scale.max)}`,
      };
    }
    if (!doneTyped || Number.isNaN(done)) {
      return { state: "error", message: "Enter how many units you have completed." };
    }
    if (done <= 0) {
      return { state: "error", message: "Units completed must be more than 0." };
    }
    if (!nextTyped || Number.isNaN(next)) {
      return {
        state: "error",
        message: "Enter how many units you are taking next semester.",
      };
    }
    if (next <= 0) {
      return { state: "error", message: "Units next semester must be more than 0." };
    }
    if (Number.isNaN(goal) || goal <= 0 || goal > scale.max) {
      return {
        state: "error",
        message: `Pick a target above, or type a CGPA between 0.00 and ${scale.max.toFixed(2)}.`,
      };
    }

    const currentPoints = curr * done;
    const neededPoints = goal * (done + next) - currentPoints;
    const requiredGpa = neededPoints / next;
    const maxReachable = (currentPoints + scale.max * next) / (done + next);

    return {
      state: "ok",
      goal,
      requiredGpa,
      maxReachable,
      alreadySafe: requiredGpa <= 0,
      impossible: requiredGpa > scale.max,
    };
  }, [tCgpa, tDone, tNext, tTarget, scale]);

  /* ---------- shared bits ---------- */

  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-[#0B1F3A] outline-none transition placeholder:text-slate-400 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/15";

  const badFieldClass =
    "w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-base text-[#0B1F3A] outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-2 focus:ring-red-100";

  const targetHasError = target.state === "error";

  // Tailwind needs both class names written out, so a template string
  // would not survive the build.
  const gradeGridClass =
    scale.grades.length === 6 ? "grid-cols-6" : "grid-cols-5";

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-20 text-[#0B1F3A]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold">GPA Calculator</h1>
            <p className="truncate text-xs text-slate-500">{scale.label}</p>
          </div>

          {/* Schools do not all grade the same way, and the two scales are
              not convertible by arithmetic. One tap is better than a wrong
              number. */}
          <div
            role="group"
            aria-label="Grading scale"
            className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-0.5"
          >
            {(["5", "4"] as const).map((id) => {
              const active = scaleId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeScale(id)}
                  aria-pressed={active}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition ${
                    active ? "bg-[#0B1F3A] text-white" : "text-slate-500 hover:text-[#0B1F3A]"
                  }`}
                >
                  {id}.0
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto flex max-w-2xl gap-2 px-4 pb-3">
          <button
            type="button"
            onClick={() => setTab("semester")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              tab === "semester"
                ? "bg-[#0B1F3A] text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            <Calculator size={15} />
            This semester
          </button>
          <button
            type="button"
            onClick={() => setTab("target")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              tab === "target"
                ? "bg-[#0B1F3A] text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            <Target size={15} />
            Reach a target
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {tab === "semester" ? (
          <>
            {/* ---------- live result ---------- */}
            <section className="mb-5 overflow-hidden rounded-3xl bg-[#0B1F3A] text-white shadow-sm">
              <div className="px-6 py-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7900]">
                  Semester GPA
                </p>
                <p className="mt-1 text-5xl font-extrabold tabular-nums">
                  {semester.gpa === null ? "0.00" : semester.gpa.toFixed(2)}
                  <span className="ml-2 text-xl font-bold text-white/40">
                    / {scale.max.toFixed(2)}
                  </span>
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {semester.counted === 0
                    ? "Pick a grade for each course below."
                    : `${semester.counted} course${
                        semester.counted === 1 ? "" : "s"
                      } · ${semester.units} units · ${
                        semester.qualityPoints
                      } quality points`}
                </p>
              </div>

              {cumulative && (
                <div className="border-t border-white/10 bg-white/5 px-6 py-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                        New CGPA
                      </p>
                      <p className="mt-0.5 text-3xl font-extrabold tabular-nums">
                        {cumulative.cgpa.toFixed(2)}
                      </p>
                    </div>
                    <div className="pb-1 text-right">
                      <p className="text-sm font-bold text-[#FF7900]">
                        {classFor(scale, cumulative.cgpa)}
                      </p>
                      <p className="text-xs text-white/60">
                        over {cumulative.totalUnits} units
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ---------- courses ---------- */}
            <section className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wide">
                  Your courses
                </h2>
                <button
                  type="button"
                  onClick={resetAll}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-[#0B1F3A]"
                >
                  <RotateCcw size={13} />
                  Reset
                </button>
              </div>

              <ul className="space-y-3">
                {courses.map((course, index) => (
                  <li
                    key={course.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={course.code}
                        onChange={(e) =>
                          updateCourse(course.id, {
                            code: e.target.value.toUpperCase(),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (index === courses.length - 1) addCourse();
                          }
                        }}
                        maxLength={12}
                        placeholder={`Course ${index + 1}`}
                        aria-label={`Course code for row ${index + 1}`}
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/15"
                      />

                      <select
                        value={course.units}
                        onChange={(e) =>
                          updateCourse(course.id, {
                            units: Number(e.target.value),
                          })
                        }
                        aria-label={`Units for row ${index + 1}`}
                        className="shrink-0 rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-base font-semibold outline-none focus:border-[#FF7900]"
                      >
                        {UNIT_OPTIONS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit} {unit === 1 ? "unit" : "units"}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => removeCourse(course.id)}
                        disabled={courses.length === 1}
                        aria-label={`Remove row ${index + 1}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className={`mt-2.5 grid gap-1.5 ${gradeGridClass}`}>
                      {scale.grades.map((grade) => {
                        const active = course.grade === grade.letter;
                        return (
                          <button
                            key={grade.letter}
                            type="button"
                            onClick={() =>
                              updateCourse(course.id, {
                                grade: active ? null : grade.letter,
                              })
                            }
                            title={grade.range}
                            aria-pressed={active}
                            className={`rounded-lg py-2 text-sm font-extrabold transition ${
                              active
                                ? "bg-[#FF7900] text-white shadow-sm"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                          >
                            {grade.letter}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={addCourse}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 py-3.5 text-sm font-bold text-slate-600 transition hover:border-[#FF7900] hover:text-[#FF7900]"
              >
                <Plus size={17} />
                Add another course
              </button>
            </section>

            {/* ---------- optional previous standing ---------- */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold">Already have a CGPA?</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Enter what the portal currently shows and this semester rolls
                into it.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Current CGPA
                  </span>
                  <input
                    value={prevCgpa}
                    onChange={(e) => setPrevCgpa(e.target.value)}
                    inputMode="decimal"
                    placeholder={scale.max === 5 ? "3.42" : "2.85"}
                    aria-invalid={Boolean(prevError)}
                    className={prevError ? badFieldClass : fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Units so far
                  </span>
                  <input
                    value={prevUnits}
                    onChange={(e) => setPrevUnits(e.target.value)}
                    inputMode="numeric"
                    placeholder="40"
                    aria-invalid={Boolean(prevError)}
                    className={prevError ? badFieldClass : fieldClass}
                  />
                </label>
              </div>

              {prevError && (
                <p
                  role="alert"
                  className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
                >
                  <Info size={16} className="mt-0.5 shrink-0" />
                  {prevError}
                </p>
              )}
            </section>

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">
              Saved on this device only. If your school grades out of 4.00,
              switch the scale at the top. Always check the portal for your
              official result.
            </p>
          </>
        ) : (
          <>
            {/* ---------- target tab ---------- */}
            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold">Where you are now</h2>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Current CGPA
                  </span>
                  <input
                    value={tCgpa}
                    onChange={(e) => setTCgpa(e.target.value)}
                    inputMode="decimal"
                    placeholder={scale.max === 5 ? "3.42" : "2.85"}
                    aria-invalid={targetHasError}
                    className={targetHasError ? badFieldClass : fieldClass}
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    Between 0.00 and {scale.max.toFixed(2)}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Units completed
                  </span>
                  <input
                    value={tDone}
                    onChange={(e) => setTDone(e.target.value)}
                    inputMode="numeric"
                    placeholder="40"
                    className={fieldClass}
                  />
                  <span className="mt-1.5 block text-[11px] text-slate-400">
                    All units so far
                  </span>
                </label>
              </div>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Units you are taking next
                </span>
                <input
                  value={tNext}
                  onChange={(e) => setTNext(e.target.value)}
                  inputMode="numeric"
                  placeholder="18"
                  className={fieldClass}
                />
              </label>
            </section>

            <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold">What you are aiming for</h2>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {scale.classes.slice(0, 4).map((item) => {
                  const value = item.min.toFixed(2);
                  const active = tTarget === value;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setTTarget(value)}
                      className={`rounded-xl px-3 py-3 text-left transition ${
                        active
                          ? "bg-[#0B1F3A] text-white"
                          : "border border-slate-200 bg-white text-[#0B1F3A] hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-sm font-extrabold">
                        {item.short}
                      </span>
                      <span
                        className={`block text-xs ${
                          active ? "text-white/60" : "text-slate-500"
                        }`}
                      >
                        {value} and above
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Or type an exact CGPA
                </span>
                <input
                  value={tTarget}
                  onChange={(e) => setTTarget(e.target.value)}
                  inputMode="decimal"
                  placeholder={scale.classes[1].min.toFixed(2)}
                  className={fieldClass}
                />
              </label>
            </section>

            {/* ---------- verdict ---------- */}
            {target.state === "empty" ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Fill in the boxes above and the answer appears here.
              </p>
            ) : target.state === "error" ? (
              <div
                role="alert"
                className="rounded-2xl border border-red-200 bg-red-50 p-5"
              >
                <div className="flex items-start gap-3">
                  <Info size={20} className="mt-0.5 shrink-0 text-red-600" />
                  <div>
                    <h3 className="font-extrabold text-red-800">
                      Check one of the boxes
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-red-800">
                      {target.message}
                    </p>
                  </div>
                </div>
              </div>
            ) : target.alreadySafe ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-green-700" />
                  <div>
                    <h3 className="font-extrabold text-green-800">
                      You are already past it
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-green-800">
                      Even a bad semester leaves you at or above{" "}
                      {target.goal.toFixed(2)}. Hold your ground.
                    </p>
                  </div>
                </div>
              </div>
            ) : target.impossible ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <h3 className="font-extrabold text-amber-900">
                      Not reachable with those units
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-amber-900">
                      Even with straight A&apos;s next semester you would finish on{" "}
                      <strong className="tabular-nums">
                        {target.maxReachable.toFixed(2)}
                      </strong>
                      , which is {classFor(scale, target.maxReachable)}.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                      You would need more units than that, or more than one
                      semester.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl bg-[#0B1F3A] text-white shadow-sm">
                <div className="px-6 py-6">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#FF7900]">
                    <TrendingUp size={14} />
                    You need
                  </p>
                  <p className="mt-1 text-5xl font-extrabold tabular-nums">
                    {target.requiredGpa.toFixed(2)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    next semester to reach a CGPA of{" "}
                    {target.goal.toFixed(2)} ({classFor(scale, target.goal)}).
                  </p>
                </div>
                <div className="border-t border-white/10 bg-white/5 px-6 py-4">
                  <p className="text-sm font-semibold text-white/90">
                    {describeEffort(target.requiredGpa, scale.max)}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    Best case if you take straight A&apos;s:{" "}
                    {target.maxReachable.toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            <p className="mt-5 text-center text-xs leading-5 text-slate-400">
              An estimate based on units and grade points. Your department may
              apply extra rules.
            </p>
          </>
        )}
      </div>
    </main>
  );
};