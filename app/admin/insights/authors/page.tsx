"use client";

import React, { useState, useEffect } from "react";
import { PlusIcon } from "@/components/admin/icons";

export default function InsightsAuthorsPage() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAuthors = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights/authors");
      if (res.ok) {
        const data = await res.json();
        setAuthors(data.authors || []);
      }
    } catch (e) {
      console.error("Failed to load authors:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthors();
  }, []);

  const handleAddAuthor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/insights/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole.trim() })
      });
      if (res.ok) {
        setNewName("");
        setNewRole("");
        fetchAuthors();
      }
    } catch (e) {
      alert("Failed to add author.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
          Editorial Team
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
          Editorial Authors & Desks
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manage editorial desk signatures and author profiles credited on published insights.
        </p>
      </div>

      {/* Add Author Form */}
      <form onSubmit={handleAddAuthor} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Add Author / Editorial Desk</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Author / Desk Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. K-Beauty Supply Chain Desk"
              className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Role / Subtitle</label>
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              placeholder="e.g. K SELECT Operations Research"
              className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !newName.trim()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusIcon size={14} />
          <span>Add Author</span>
        </button>
      </form>

      {/* Authors List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading authors...</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
            {authors.map((a: any) => (
              <div key={a.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                <div>
                  <div className="font-extrabold text-zinc-900 dark:text-white">{a.name}</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">{a.role || "Editorial Desk"}</div>
                </div>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Active Signature
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
