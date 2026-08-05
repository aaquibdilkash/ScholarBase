"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { RejectionModal } from "@/components/ui/RejectionModal";

const ADMIN_SECTIONS = [
  { id: "feed", title: "Feed", href: "/feed" },
  { id: "blog", title: "Blog", href: "/blog" },
  { id: "publications", title: "Publications", href: "/publications" },
  { id: "journals", title: "Journals", href: "/journals" },
  { id: "researchTools", title: "Research Tools", href: "/research-tools" },
  { id: "admissions", title: "Admissions", href: "/admissions" },
  { id: "events", title: "Events", href: "/events" },
  { id: "vacancies", title: "Vacancies", href: "/vacancies" },
  { id: "help", title: "Help", href: "/help" },
  { id: "results", title: "Results", href: "/results" },
  { id: "contributions", title: "Contributions", href: "/contributions" },
  { id: "supervisors", title: "Supervisors", href: "/supervisor" },
  { id: "recommendations", title: "Recommendations", href: "/supervisor" },
  { id: "surveys", title: "Surveys", href: "/surveys" },
  { id: "users", title: "Users", href: "#" },
];

type Stats = {
  totalUsers: number;
  totalContent: number;
  sections: Record<string, number>;
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("feed");
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{
    contentType: string;
    contentId: string;
  } | null>(null);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [itemToReject, setItemToReject] = useState<{
    contentId: string;
    reason: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/content?type=stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load admin stats:", error);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadContent = useCallback(
    async (sectionId: string) => {
      setLoading(true);
      try {
        const url =
          sectionId === "users"
            ? "/api/admin/users"
            : `/api/admin/content?type=${sectionId}`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setContent(data);
        }
      } catch (error) {
        toast("Failed to load content", "error");
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadContent(activeTab);
  }, [activeTab, loadContent]);

  const handleTabClick = (sectionId: string) => {
    setActiveTab(sectionId);
  };

  const handleFreeze = async (contentType: string, contentId: string) => {
    try {
      const response = await fetch("/api/admin/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, contentId }),
      });
      if (response.ok) {
        toast("Content frozen/unfrozen successfully", "success");
        loadContent(activeTab);
        loadStats();
      }
    } catch (error) {
      toast("Failed to update freeze status", "error");
    }
  };

  const handleDelete = (contentType: string, contentId: string) => {
    setItemToDelete({ contentType, contentId });
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      const response = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemToDelete),
      });
      if (response.ok) {
        toast("Content deleted successfully", "success");
        loadContent(activeTab);
        loadStats();
      }
    } catch (error) {
      toast("Failed to delete content", "error");
    } finally {
      setItemToDelete(null);
    }
  };

  const handleApprove = async (contentId: string) => {
    setIsApproving(true);
    try {
      const response = await fetch("/api/admin/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, status: "APPROVED" }),
      });
      if (response.ok) {
        toast("Contribution approved successfully", "success");
        loadContent(activeTab);
        loadStats();
      }
    } catch (error) {
      toast("Failed to approve contribution", "error");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = (contentId: string) => {
    setItemToReject({ contentId, reason: "" });
    setIsRejectionModalOpen(true);
  };

  const confirmReject = async (reason: string) => {
    if (!itemToReject) return;
    setIsRejecting(true);
    try {
      const response = await fetch("/api/admin/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: itemToReject.contentId,
          status: "REJECTED",
          reason,
        }),
      });
      if (response.ok) {
        toast("Contribution rejected successfully", "success");
        loadContent(activeTab);
        loadStats();
      }
    } catch (error) {
      toast("Failed to reject contribution", "error");
    } finally {
      setItemToReject(null);
      setIsRejecting(false);
      setIsRejectionModalOpen(false);
    }
  };

  const sectionCount = (sectionId: string) => stats?.sections?.[sectionId] ?? 0;

  return (
    <>
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="sb-shell py-6 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Manage content, moderate posts, and control user access
            </p>
          </div>

          {/* Stats Overview */}
          {stats && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Users
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalUsers}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Content
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.totalContent}
                </p>
              </div>
              {ADMIN_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleTabClick(section.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    activeTab === section.id
                      ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {section.title}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {sectionCount(section.id)}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar Tabs */}
            <aside className="lg:w-64 shrink-0">
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Content Sections
                  </h2>
                </div>
                <nav className="p-2">
                  {ADMIN_SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => handleTabClick(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition mb-1 ${
                        activeTab === section.id
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        {section.title}
                        <span className="text-xs font-semibold text-slate-400">
                          {sectionCount(section.id)}
                        </span>
                      </span>
                    </button>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Content Area */}
            <div className="flex-1">
              <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {ADMIN_SECTIONS.find((s) => s.id === activeTab)?.title}{" "}
                    Management
                  </h3>
                </div>

                {loading ? (
                  <div className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
                  </div>
                ) : content.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    No content found
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                            {activeTab === "users" ? "Name" : "Title"}
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                            {activeTab === "users" ? "Email" : "Author"}
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                            Status
                          </th>
                          <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {content.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                          >
                            <td className="px-4 py-3">
                              {activeTab === "users" ? (
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {item.name}
                                </p>
                              ) : item.detailHref ? (
                                <Link
                                  href={item.detailHref}
                                  className="font-medium text-slate-900 transition hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                                >
                                  {item.title ||
                                    item.content?.substring(0, 50) ||
                                    "Untitled"}
                                </Link>
                              ) : (
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {item.title ||
                                    item.content?.substring(0, 50) ||
                                    "Untitled"}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                              {activeTab === "users"
                                ? item.email
                                : item.author?.name ||
                                  item.author?.email ||
                                  "Unknown"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  activeTab === "contributions"
                                    ? item.status === "APPROVED"
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                      : item.status === "REJECTED"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    : item.isFrozen
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                }`}
                              >
                                {activeTab === "contributions"
                                  ? item.status
                                  : item.isFrozen
                                    ? "Frozen"
                                    : "Active"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {activeTab === "contributions" &&
                                item.status === "PENDING" ? (
                                  <>
                                    <button
                                      onClick={() => handleApprove(item.id)}
                                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
                                      disabled={isApproving}
                                    >
                                      {isApproving ? "Approving..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => handleReject(item.id)}
                                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                                      disabled={isRejecting}
                                    >
                                      {isRejecting ? "Rejecting..." : "Reject"}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleFreeze(
                                          activeTab === "users"
                                            ? "user"
                                            : activeTab.slice(0, -1),
                                          item.id,
                                        )
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        item.isFrozen
                                          ? "bg-green-600 text-white hover:bg-green-700"
                                          : "bg-amber-600 text-white hover:bg-amber-700"
                                      }`}
                                    >
                                      {item.isFrozen ? "Unfreeze" : "Freeze"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDelete(
                                          activeTab === "users"
                                            ? "user"
                                            : activeTab.slice(0, -1),
                                          item.id,
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
          <ConfirmationModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onConfirm={confirmDelete}
            title="Confirm Deletion"
            message="Are you sure you want to delete this item? This action cannot be undone."
          />
          <RejectionModal
            isOpen={isRejectionModalOpen}
            onClose={() => setIsRejectionModalOpen(false)}
            onConfirm={confirmReject}
            title="Confirm Rejection"
            message="Are you sure you want to reject this item? Please provide a reason."
            isConfirming={isRejecting}
          />
        </div>
      </main>
    </>
  );
}
