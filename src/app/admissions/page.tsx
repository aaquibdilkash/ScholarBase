import Link from "next/link";
import prisma from "@/lib/db";

export default async function AdmissionsPage() {
  const admissions = await prisma.phdAdmission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          PhD Admissions
        </h1>
        <Link
          href="/admissions/new"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200"
        >
          + Post Admission
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {admissions.map((item) => (
          <div
            key={item.id}
            className="group border border-slate-200/60 rounded-2xl p-6 bg-white shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 hover:border-blue-100 transition-all duration-300 flex flex-col"
          >
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900 leading-tight">
                {item.university}
              </h2>
              <p className="text-blue-600 font-semibold text-sm mt-1">
                {item.department}
              </p>
            </div>

            <p className="text-sm text-slate-500 line-clamp-4 mb-6 flex-grow leading-relaxed">
              {item.description}
            </p>

            <div className="mt-auto pt-5 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-red-600 font-bold mb-5 bg-red-50/50 p-3 rounded-xl border border-red-100/50">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Closing Date: {new Date(item.deadline).toLocaleDateString()}
              </div>

              <div className="flex gap-3">
                {item.notificationLink && (
                  <a
                    href={item.notificationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition-colors duration-200"
                  >
                    Circular
                  </a>
                )}

                {item.applyLink && (
                  <a
                    href={item.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-sm font-semibold text-white bg-slate-900 hover:bg-black py-2.5 rounded-xl transition-colors duration-200"
                  >
                    Portal
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
