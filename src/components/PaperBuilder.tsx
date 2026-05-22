import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Wand2, Loader2 } from "lucide-react";
import type { QuestionType } from "@/lib/paper-types";
import type { GenerateBrief } from "@/lib/ai-paper";

const INDIA_BOARDS = [
  {
    group: "National Boards",
    boards: [
      { value: "CBSE", label: "CBSE – Central Board of Secondary Education" },
      { value: "ICSE/ISC", label: "ICSE / ISC – Council for Indian School Certificate" },
      { value: "NIOS", label: "NIOS – National Institute of Open Schooling" },
    ],
  },
  {
    group: "International (India)",
    boards: [
      { value: "IB (MYP/DP)", label: "IB – International Baccalaureate (MYP/DP)" },
      { value: "Cambridge IGCSE/A-Level", label: "Cambridge – IGCSE / A-Level" },
    ],
  },
  {
    group: "State Boards",
    boards: [
      { value: "GSEB (Gujarat)", label: "GSEB – Gujarat Secondary & Higher Secondary" },
      { value: "MSBSHSE (Maharashtra)", label: "MSBSHSE – Maharashtra State Board" },
      { value: "TNBSE (Tamil Nadu)", label: "TNBSE – Tamil Nadu Board" },
      { value: "KSEEB (Karnataka)", label: "KSEEB – Karnataka Secondary Education" },
      { value: "KBPE (Kerala)", label: "KBPE – Kerala Board of Public Examinations" },
      { value: "WBBSE/WBCHSE (West Bengal)", label: "WBBSE / WBCHSE – West Bengal Board" },
      { value: "UPMSP (Uttar Pradesh)", label: "UPMSP – Uttar Pradesh Madhyamik Shiksha Parishad" },
      { value: "RBSE (Rajasthan)", label: "RBSE – Rajasthan Board of Secondary Education" },
      { value: "MPBSE (Madhya Pradesh)", label: "MPBSE – Madhya Pradesh Board" },
      { value: "BSEB (Bihar)", label: "BSEB – Bihar School Examination Board" },
      { value: "BSEAP (Andhra Pradesh)", label: "BSEAP – Andhra Pradesh Board" },
      { value: "TSBIE (Telangana)", label: "TSBIE – Telangana Board of Intermediate Education" },
      { value: "PSEB (Punjab)", label: "PSEB – Punjab School Education Board" },
      { value: "HBSE (Haryana)", label: "HBSE – Haryana Board of School Education" },
      { value: "HPBOSE (Himachal Pradesh)", label: "HPBOSE – Himachal Pradesh Board" },
      { value: "UBSE (Uttarakhand)", label: "UBSE – Uttarakhand Board of School Education" },
      { value: "JAC (Jharkhand)", label: "JAC – Jharkhand Academic Council" },
      { value: "CHSE (Odisha)", label: "CHSE – Council of Higher Secondary Education, Odisha" },
      { value: "SEBA/AHSEC (Assam)", label: "SEBA / AHSEC – Assam Board" },
      { value: "CGBSE (Chhattisgarh)", label: "CGBSE – Chhattisgarh Board" },
      { value: "GBSHSE (Goa)", label: "GBSHSE – Goa Board of Secondary & Higher Secondary" },
      { value: "JKBOSE (J&K)", label: "JKBOSE – J&K Board of School Education" },
      { value: "DBSE (Delhi)", label: "DBSE – Delhi Board of School Education" },
      { value: "BSEH (Manipur)", label: "BSEM – Board of Secondary Education Manipur" },
      { value: "MBSE (Meghalaya)", label: "MBOSE – Meghalaya Board of School Education" },
      { value: "NBSE (Nagaland)", label: "NBSE – Nagaland Board of School Education" },
      { value: "TBSE (Tripura)", label: "TBSE – Tripura Board of Secondary Education" },
      { value: "COHSEM (Manipur)", label: "COHSEM – Council of Higher Secondary Education Manipur" },
    ],
  },
];

const TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple Choice",
  short: "Short Answer",
  long: "Long Answer",
  truefalse: "True / False",
  fillblank: "Fill in the Blank",
};

export interface BuilderProps {
  onGenerate: (brief: GenerateBrief) => void;
  loading: boolean;
}

export function PaperBuilder({ onGenerate, loading }: BuilderProps) {
  const [schoolName, setSchoolName] = useState("");
  const [className, setClassName] = useState("Class 10");
  const [subject, setSubject] = useState("Mathematics");
  const [examName, setExamName] = useState("Mid-Term Examination");
  const [duration, setDuration] = useState(120);
  const [totalMarks, setTotalMarks] = useState(50);
  const [topics, setTopics] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [language, setLanguage] = useState("English");
  const [board, setBoard] = useState("CBSE");
  const [extra, setExtra] = useState("");
  const [types, setTypes] = useState<GenerateBrief["types"]>([
    { type: "mcq", count: 10, marksEach: 1 },
    { type: "short", count: 5, marksEach: 4 },
    { type: "long", count: 2, marksEach: 10 },
  ]);

  const computed = types.reduce((s, t) => s + t.count * t.marksEach, 0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { setTotalMarks(computed); }, [computed]);

  return (
    <form
      ref={formRef}
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!schoolName.trim()) return;
        onGenerate({
          schoolName, className, subject, examName,
          durationMinutes: duration, totalMarks, topics, difficulty, language, board, extra, types,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="School / Institution"><Input required value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="St. Xavier's High School" /></Field>
        <Field label="Class / Grade"><Input value={className} onChange={(e) => setClassName(e.target.value)} /></Field>
        <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Exam Title"><Input value={examName} onChange={(e) => setExamName(e.target.value)} /></Field>
        <Field label="Duration (minutes)"><Input type="number" min={5} value={duration} onChange={(e) => setDuration(+e.target.value)} /></Field>
        <Field label="Language">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["English","Hindi","Bengali","Tamil","Telugu","Marathi","Gujarati","Kannada","Malayalam","Punjabi","Odia"].map((l)=>(<SelectItem key={l} value={l}>{l}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Board / Curriculum">
          <Select value={board} onValueChange={setBoard}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDIA_BOARDS.map((group) => (
                <div key={group.group}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground select-none">
                    {group.group}
                  </div>
                  {group.boards.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Total Marks (auto)"><Input type="number" value={totalMarks} readOnly className="opacity-70" /></Field>
      </div>

      <Field label="Topics / Syllabus (optional)">
        <Textarea rows={2} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. Quadratic Equations, Trigonometry, Coordinate Geometry" />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Question Breakdown</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setTypes([...types, { type: "mcq", count: 5, marksEach: 1 }])}>
            <Plus className="mr-1 h-4 w-4" /> Add type
          </Button>
        </div>
        <div className="space-y-2">
          {types.map((t, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
              <div className="col-span-12 sm:col-span-5">
                <Select value={t.type} onValueChange={(v) => { const c = [...types]; c[i] = { ...c[i], type: v as QuestionType }; setTypes(c); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Input type="number" min={1} value={t.count} onChange={(e) => { const c = [...types]; c[i] = { ...c[i], count: +e.target.value }; setTypes(c); }} placeholder="Count" />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <Input type="number" min={1} value={t.marksEach} onChange={(e) => { const c = [...types]; c[i] = { ...c[i], marksEach: +e.target.value }; setTypes(c); }} placeholder="Marks each" />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => setTypes(types.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Field label="Additional notes for the AI (optional)">
        <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. include 2 numerical problems, avoid trick questions, etc." />
      </Field>

      <Button type="submit" size="lg" className="w-full glow" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
        {loading ? "Crafting your paper…" : "Generate Question Paper"}
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
