import { useState, useRef } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/AuthContext";
import { API_URL } from "../config/api";

const PRESETS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCN2G52zKcQynqcDn68fQ0l2-2R_sUyjlQmzSidfD1KEUB5swEGfwLzkKOhJP0mC1tzXR0Q57ZOkSgT_e1p3tDFFFZsXgBqsH4EwxfR4F9FNKK_rBUJpYot5FbVS4pZ2FuLqMjGGvEMVOABhj0FGFzZo0v8g1cPPe2qmc9bkGd_od-WQD_OFNhw_3OIxnlcDQht8cuEyYEKPT1tSon0qRPzTiGEMegm0S1-eUm1r0P3w3-wLo0lnv4f9z0itnBiUGdB9HebRcIrMwg",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
];

export default function AdminProfile() {
  const { profile, updateProfile } = useAuth();
  const [avatar, setAvatar] = useState(profile?.avatar || PRESETS[0]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const handlePresetSelect = (url) => {
    setAvatar(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large! Please select an image under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        setAvatar(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id, avatar }),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      const data = await res.json();
      updateProfile(data.user);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Error saving profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-white tracking-tight">Your Profile</h1>
        <p className="text-sm text-slate-400">Manage your account information and avatar.</p>
      </div>

      <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-950 shadow-lg">
              <img src={avatar} alt="Current Avatar" className="w-full h-full object-cover" />
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors border border-slate-700"
            >
              Upload Picture
            </button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
          </div>

          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <div className="text-lg font-bold text-slate-200 bg-slate-950/50 px-4 py-2 rounded-lg border border-slate-800">
                  {profile?.name || "Administrator"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="text-lg font-bold text-slate-200 bg-slate-950/50 px-4 py-2 rounded-lg border border-slate-800">
                  {profile?.email || "admin@example.com"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Role
                </label>
                <div className="inline-block px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold rounded-lg uppercase tracking-widest text-xs">
                  {profile?.role || "Admin"}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">Or choose a preset avatar:</h3>
              <div className="flex flex-wrap gap-3">
                {PRESETS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => handlePresetSelect(url)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                      avatar === url ? "border-cyan-500 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.4)]" : "border-slate-800 hover:border-slate-500"
                    }`}
                  >
                    <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
