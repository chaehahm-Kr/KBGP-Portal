"use client";

import React, { useState, useEffect } from "react";
import { PlusIcon } from "@/components/admin/icons";

export default function InsightsCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/insights/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (e) {
      console.error("Failed to load categories:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setIsSubmitting(true);
      const res = await fetch("/api/admin/insights/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() })
      });
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        fetchCategories();
      }
    } catch (e) {
      alert("Failed to add category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
          Editorial Taxonomy
        </span>
        <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
          Insight Categories
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manage topic categories used to classify market intelligence, compliance guides, and retail trend articles.
        </p>
      </div>

      {/* Add Category Form */}
      <form onSubmit={handleAddCategory} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Add New Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Category Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. INGREDIENT INNOVATION"
              className="w-full rounded-md border border-zinc-300 bg-white p-2 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Short category scope explanation..."
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
          <span>Add Category</span>
        </button>
      </form>

      {/* Categories List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-zinc-500">Loading categories...</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
            {categories.map((c: any) => (
              <div key={c.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                <div>
                  <div className="font-extrabold text-zinc-900 dark:text-white">{c.name}</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">{c.description || "No description provided."}</div>
                </div>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
