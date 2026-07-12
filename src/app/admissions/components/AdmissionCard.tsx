"use client";

import { PhdAdmission, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { TrendingItemFooter } from "@/components/feed/TrendingItemFooter";

import { ClockIcon } from "@/components/icons/ClockIcon";

type AdmissionWithAuthor = PhdAdmission & {
  author: User;
  isLiked: boolean;
  _count: { likes: number; comments: number };
};

export function AdmissionCard({
  admission,
}: {
  admission: AdmissionWithAuthor;
}) {
  return (
    <div
      key={admission.id}
      className="sb-card sb-card-hover group flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <Link href={`/scholar/${admission.author.id}`} className="shrink-0">
          <div className="w-10 h-10 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
            {admission.author.avatarUrl ? (
              <Image
                src={admission.author.avatarUrl}
                alt="Author"
                width={40}
                height={40}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-semibold text-slate-400 text-base">
                {admission.author.name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
        </Link>
        <div>
          <Link
            href={`/scholar/${admission.author.id}`}
            className="font-semibold text-slate-950 text-sm hover:text-blue-700 hover:underline transition"
          >
            {admission.author.name || "Scholar"}
          </Link>
          <div className="mt-0.5 text-xs font-medium text-slate-500">
            @{admission.author.handle}
          </div>
        </div>
      </div>

      <Link href={`/admissions/${admission.id}`} className="flex-grow">
        <div className="mb-4">
          <h2 className="text-lg font-semibold leading-tight text-slate-950">
            {admission.university}
          </h2>
          <p className="mt-1 text-sm font-semibold text-blue-700">
            {admission.department}
          </p>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-600 line-clamp-4">
          {admission.description}
        </p>
      </Link>

      <div className="mt-auto border-t border-slate-100 pt-4">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-2 text-xs font-semibold text-red-600">
          <ClockIcon className="w-4 h-4" />
          Closing Date:{" "}
          {new Date(admission.deadline).toLocaleDateString("en-US")}
        </div>

        <div className="flex gap-3 mb-4">
          {admission.notificationLink && (
            <a
              href={admission.notificationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
            >
              Circular
            </a>
          )}

          {admission.applyLink && (
            <a
              href={admission.applyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
            >
              Portal
            </a>
          )}
        </div>
        <TrendingItemFooter
          item={{
            id: admission.id,
            type: "admission",
            isLiked: admission.isLiked,
            _count: admission._count,
          }}
        />
      </div>
    </div>
  );
}
