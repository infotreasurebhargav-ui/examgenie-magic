import { useState } from "react";
import { Settings, Save, AlertTriangle, Trash2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { getSettings, saveSettings, getSessions, clearBank, clearAllData } from "@/lib/store";
import type { AppSettings } from "@/lib/app-types";

function clearSessions() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("pf_sessions");
  }
}

export function SettingsPage({ onSettingsChange }: { onSettingsChange: () => void }) {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [showPass, setShowPass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const handleSaveGeneral = () => {
    if (!settings.schoolName.trim()) { toast.error("School name cannot be empty"); return; }
    if (!settings.adminUsername.trim()) { toast.error("Username cannot be empty"); return; }
    saveSettings(settings);
    onSettingsChange();
    toast.success("Settings saved");
  };

  const handleChangePassword = () => {
    if (!newPass.trim()) { toast.error("Password cannot be empty"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords do not match"); return; }
    saveSettings({ ...getSettings(), adminPassword: newPass });
    setNewPass("");
    setConfirmPass("");
    toast.success("Password updated — use new password on next login");
  };

  const sessionCount = getSessions().length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-slate-400">Manage school info, credentials, and data</p>
      </div>

      {/* General */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-400" />
          <h3 className="font-semibold text-white">General</h3>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">School Name</label>
          <Input
            value={settings.schoolName}
            onChange={(e) => setSettings((s) => ({ ...s, schoolName: e.target.value }))}
            placeholder="e.g. St. Xavier's High School"
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Admin Username</label>
          <Input
            value={settings.adminUsername}
            onChange={(e) => setSettings((s) => ({ ...s, adminUsername: e.target.value }))}
            placeholder="admin"
            className="bg-white/5 border-white/10 text-white"
          />
        </div>
        <Button onClick={handleSaveGeneral} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Save className="mr-1.5 h-4 w-4" /> Save Changes
        </Button>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-indigo-400" />
          <h3 className="font-semibold text-white">Change Password</h3>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">New Password</label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Enter new password"
              className="bg-white/5 border-white/10 text-white pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">Confirm Password</label>
          <Input
            type={showPass ? "text" : "password"}
            value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Re-enter new password"
            className="bg-white/5 border-white/10 text-white"
            onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
          />
        </div>
        <Button
          onClick={handleChangePassword}
          variant="outline"
          className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
        >
          Update Password
        </Button>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-400" />
          <h3 className="font-semibold text-rose-400">Danger Zone</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/3 p-3">
            <div>
              <p className="text-sm font-medium text-white">Clear Test History</p>
              <p className="text-xs text-slate-400">{sessionCount} sessions · cannot be undone</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 shrink-0">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#13131f] border-white/10 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all test history?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    Permanently deletes all {sessionCount} test session records. Student data is kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 text-slate-300">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 hover:bg-rose-500 text-white"
                    onClick={() => { clearSessions(); toast.success("Test history cleared"); }}
                  >
                    Yes, Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-white/3 p-3">
            <div>
              <p className="text-sm font-medium text-white">Clear Question Bank</p>
              <p className="text-xs text-slate-400">All saved questions · cannot be undone</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 shrink-0">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#13131f] border-white/10 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear question bank?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    All saved questions will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 text-slate-300">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 hover:bg-rose-500 text-white"
                    onClick={() => { clearBank(); toast.success("Question bank cleared"); }}
                  >
                    Yes, Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
            <div>
              <p className="text-sm font-medium text-white">Reset All Data</p>
              <p className="text-xs text-slate-400">Wipes students, sessions, bank, and papers</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white shrink-0">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Reset App
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#13131f] border-white/10 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset ALL app data?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    Permanently deletes every student, test session, saved question, and paper. Cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-white/10 text-slate-300">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 hover:bg-rose-500 text-white"
                    onClick={() => {
                      clearAllData();
                      toast.success("All data cleared — refreshing…");
                      setTimeout(() => window.location.reload(), 1200);
                    }}
                  >
                    Yes, Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
