import { useState, useRef } from "react";
import {
  Users, Plus, Upload, Download, Trash2, Pencil, Search,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  getStudents, saveStudents, addStudent, updateStudent, deleteStudent,
} from "@/lib/store";
import { newId } from "@/lib/paper-types";
import type { Student } from "@/lib/app-types";

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>(() => getStudents());
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", rollNumber: "", className: "", section: "",
  });
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = () => setStudents(getStudents());

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
      s.className.toLowerCase().includes(search.toLowerCase()),
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", rollNumber: "", className: "", section: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditingId(s.id);
    setForm({
      name: s.name, rollNumber: s.rollNumber,
      className: s.className, section: s.section,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.rollNumber.trim() || !form.className.trim()) {
      toast.error("Name, Roll Number, and Class are required");
      return;
    }
    const dup = students.find(
      (s) =>
        s.rollNumber.trim().toLowerCase() === form.rollNumber.trim().toLowerCase() &&
        s.id !== editingId,
    );
    if (dup) { toast.error("Roll number already exists"); return; }

    if (editingId) {
      updateStudent({ id: editingId, ...form });
      toast.success("Student updated");
    } else {
      addStudent(form);
      toast.success("Student added");
    }
    setDialogOpen(false);
    refresh();
  };

  const handleDelete = (id: string) => {
    deleteStudent(id);
    refresh();
    toast.success("Student removed");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        let added = 0, skipped = 0;
        const current = getStudents();
        const next = [...current];
        for (const row of rows) {
          const name = (
            row["Name"] ?? row["name"] ?? row["Student Name"] ?? ""
          ).toString().trim();
          const roll = (
            row["Roll Number"] ?? row["Roll"] ?? row["roll"] ??
            row["rollNumber"] ?? row["Roll No"] ?? ""
          ).toString().trim();
          const cls = (
            row["Class"] ?? row["class"] ?? row["className"] ?? ""
          ).toString().trim();
          const section = (
            row["Section"] ?? row["section"] ?? ""
          ).toString().trim();
          if (!name || !roll) { skipped++; continue; }
          if (next.find((s) => s.rollNumber.toLowerCase() === roll.toLowerCase())) {
            skipped++; continue;
          }
          next.push({ id: newId(), name, rollNumber: roll, className: cls, section });
          added++;
        }
        saveStudents(next);
        refresh();
        toast.success(
          `Imported ${added} student${added !== 1 ? "s" : ""}` +
          (skipped > 0 ? `, skipped ${skipped} duplicates/invalid` : ""),
        );
      } catch {
        toast.error("Failed to read Excel file. Use columns: Name, Roll Number, Class, Section");
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    if (students.length === 0) { toast.error("No students to export"); return; }
    const data = students.map((s) => ({
      Name: s.name,
      "Roll Number": s.rollNumber,
      Class: s.className,
      Section: s.section,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students.xlsx");
    toast.success("Exported students.xlsx");
  };

  const downloadTemplate = () => {
    const data = [
      { Name: "Priya Sharma", "Roll Number": "2024001", Class: "10", Section: "A" },
      { Name: "Rahul Gupta",  "Roll Number": "2024002", Class: "10", Section: "A" },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_template.xlsx");
    toast.success("Template downloaded");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Students</h2>
          <p className="text-sm text-slate-400">{students.length} enrolled</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm" variant="outline"
            onClick={downloadTemplate}
            className="border-white/10 text-slate-400 hover:text-white"
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Template
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => importRef.current?.click()}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <Upload className="mr-1.5 h-4 w-4" /> Import Excel
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={handleExport}
            className="border-white/10 text-slate-300 hover:text-white"
          >
            <Download className="mr-1.5 h-4 w-4" /> Export Excel
          </Button>
          <Button
            size="sm" onClick={openAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add Student
          </Button>
        </div>
        <input
          ref={importRef} type="file" accept=".xlsx,.xls,.csv"
          className="sr-only" onChange={handleImport}
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Search by name, roll number, or class…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/5 border-white/10 pl-9 text-white placeholder:text-slate-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 font-medium">
              {search ? "No students match your search" : "No students yet"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Add students manually or import from Excel
            </p>
            {!search && (
              <Button
                size="sm" onClick={openAdd}
                className="mt-4 bg-indigo-600 hover:bg-indigo-500"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add First Student
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-left font-semibold text-slate-400 w-12">#</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400">Roll No.</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400">Class</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-400">Section</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors last:border-0"
                >
                  <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-indigo-300 text-xs">{s.rollNumber}</td>
                  <td className="px-4 py-3 text-slate-300">{s.className}</td>
                  <td className="px-4 py-3 text-slate-300">{s.section || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#13131f] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Student" : "Add Student"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Full Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Priya Sharma"
                className="bg-white/5 border-white/10 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Roll Number *</label>
              <Input
                value={form.rollNumber}
                onChange={(e) => setForm((f) => ({ ...f, rollNumber: e.target.value }))}
                placeholder="e.g. 2024001"
                className="bg-white/5 border-white/10 text-white"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Class *</label>
                <Input
                  value={form.className}
                  onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  placeholder="e.g. 10"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Section</label>
                <Input
                  value={form.section}
                  onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                  placeholder="e.g. A"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500"
              >
                {editingId ? "Save Changes" : "Add Student"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-white/10 text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
