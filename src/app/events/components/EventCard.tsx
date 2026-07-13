
"use client";

import { ResearchEvent, User } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { TrendingItemFooter } from "@/components/feed/TrendingItemFooter";
import { ClockIcon } from "@/components/icons/ClockIcon";

type EventWithAuthor = ResearchEvent & { author: User, isLiked: boolean, _count: { likes: number, comments: number } };

export function EventCard({ event }: { event: EventWithAuthor }) {
    return (
        <div
            key={event.id}
            className="sb-card sb-card-hover group flex flex-col"
        >
            <div className="flex items-center gap-3 mb-4">
                <Link href={`/scholar/${event.author.id}`} className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-blue-100 transition">
                        {event.author.avatarUrl ? (
                            <Image
                                src={event.author.avatarUrl}
                                alt="Author"
                                width={40}
                                height={40}
                                unoptimized
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="font-semibold text-slate-400 text-base">
                                {event.author.name?.charAt(0).toUpperCase() || "?"}
                            </span>
                        )}
                    </div>
                </Link>
                <div>
                    <Link
                        href={`/scholar/${event.author.id}`}
                        className="font-semibold text-slate-950 text-sm hover:text-blue-700 hover:underline transition"
                    >
                        {event.author.name || "Scholar"}
                    </Link>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                        @{event.author.handle}
                    </div>
                </div>
            </div>
            
            <Link href={`/events/${event.id}`} className="flex-grow">
                <h2 className="mb-2 text-lg font-semibold leading-tight text-slate-950">
                    {event.title}
                </h2>
                <p className="mb-4 text-sm font-medium text-slate-600">
                    Event Date:{" "}
                    {new Date(event.date).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                    })}
                </p>

                <p className="text-sm leading-relaxed text-slate-600 line-clamp-3">
                    {event.description}
                </p>
            </Link>

            <div className="mt-auto border-t border-slate-100 pt-4">
                {event.deadline && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-100/50 bg-red-50/50 p-2 text-xs font-semibold text-red-600">
                        <ClockIcon className="w-4 h-4" />
                        Deadline: {new Date(event.deadline).toLocaleDateString("en-US")}
                    </div>
                )}

                <div className="flex gap-3 mb-4">
                    {event.notificationLink && (
                        <a
                            href={event.notificationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 rounded-lg bg-slate-100 py-2 text-center text-xs font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-200"
                        >
                            Brochure
                        </a>
                    )}

                    {event.applyLink && (
                        <a
                            href={event.applyLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 rounded-lg bg-slate-950 py-2 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-slate-800"
                        >
                            Submit
                        </a>
                    )}
                </div>
                <TrendingItemFooter item={{...event, type: 'event'}} />
            </div>
        </div>
    )
}
