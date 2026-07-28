import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import prisma from "@/lib/db";
import {
  approveContribution,
  rejectContribution,
  getAllContributionsAdmin,
} from "@/app/actions/contributions";
import Link from "next/link";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?message=Please log in to access admin.");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    notFound();
  }

  const contributions = await getAllContributionsAdmin(user.id);

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-slate-600">
          Manage contributions and other site content.
        </p>
      </div>

      <div className="sb-surface-strong overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Title
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Author
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Amount
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Method
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Screenshot
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Approved At
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contributions.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No contributions yet.
                  </td>
                </tr>
              ) : (
                contributions.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : c.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contributions/${c.id}`}
                        className="font-medium text-slate-900 hover:text-blue-700 transition-colors"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.author.name || c.author.handle || c.author.email}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.amount ? `₹${c.amount}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.paymentMethod || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {c.screenshotUrl ? (
                        <a
                          href={c.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-xs"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {c.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {c.approvedAt
                        ? c.approvedAt.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.status === "PENDING" && (
                          <>
                            <form action={approveContribution.bind(null, c.id)}>
                              <button
                                type="submit"
                                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
                              >
                                Approve
                              </button>
                            </form>
                            <details className="relative">
                              <summary className="cursor-pointer rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700">
                                Reject
                              </summary>
                              <form
                                action={rejectContribution.bind(null, c.id)}
                                className="absolute right-0 top-full mt-2 z-10 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg min-w-[280px]"
                              >
                                <textarea
                                  name="rejectionReason"
                                  placeholder="Provide a reason for rejection..."
                                  className="sb-input text-xs h-20 resize-none"
                                  required
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="submit"
                                    className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                                  >
                                    Confirm Reject
                                  </button>
                                </div>
                              </form>
                            </details>
                          </>
                        )}
                        {c.status !== "PENDING" && (
                          <span className="text-xs text-slate-400 italic">
                            {c.status === "APPROVED" ? "Approved" : "Rejected"}
                          </span>
                        )}
                      </div>
                      {c.rejectionReason && c.status === "REJECTED" && (
                        <div className="mt-1 text-[10px] text-red-500 max-w-[200px] truncate" title={c.rejectionReason}>
                          Reason: {c.rejectionReason}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
