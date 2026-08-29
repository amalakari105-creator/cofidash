import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Avatar from "./Avatar";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-16 flex items-center justify-end px-6 border-b border-navy-100 bg-white relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2">
            <span className="text-sm text-navy-700 hidden sm:block">
              {profile?.full_name ?? profile?.coficab_id}
            </span>
            <Avatar name={profile?.full_name ?? profile?.coficab_id} size={34} />
          </button>

          {menuOpen && (
            <div className="absolute top-14 right-6 bg-white border border-navy-100 rounded-card shadow-md py-1 w-44 z-10">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/mon-compte");
                }}
                className="w-full text-left px-4 py-2 text-sm text-navy-700 hover:bg-navy-100"
              >
                Mon compte
              </button>
              <button
                onClick={signOut}
                className="w-full text-left px-4 py-2 text-sm text-alert-red hover:bg-navy-100"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
